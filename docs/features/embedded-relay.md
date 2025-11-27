# Embedded Local Relay - Production Feature

**Status:** Planned for Tauri production builds
**Priority:** High
**Target:** v1.0 Desktop Release

## Overview

Bundle a full-featured Nostr relay with Noornote as a local backup and offline-first solution. The relay runs invisibly in the background, providing:

- **Local Backup:** All user's events stored locally
- **Offline Support:** Write events when offline, sync when back online
- **Performance:** Zero network latency for reads
- **Privacy:** User's data stays on their device
- **Gateway Mode:** All traffic routes through local relay to public relays

## User Experience Flow (Tauri)

### Simple Activation

**Goal:** User enables local relay with ONE checkbox + ONE button click.

**Flow:**
1. User opens Settings → Relays section
2. User clicks checkbox: "☑ Use local relay as gateway (ws://localhost:7777)"
3. User clicks "Save Settings" button
4. **Relay starts automatically in background** (no manual commands needed!)
5. Status updates appear in:
   - Settings UI (relay-specific status)
   - CSM Global System Logs (system-wide logging)

### Status Indicators

**In Settings UI (Relay Section):**
```
┌─────────────────────────────────────────┐
│ Local Backup Relay                      │
├─────────────────────────────────────────┤
│ ☑ Use local relay as gateway            │
│     (ws://localhost:7777)                │
│                                          │
│ Status: ● Running                       │
│ Storage: 1.2 GB / 10 GB used           │
│ Uptime: 2h 34m                          │
│                                          │
│ Pending Events: 0                       │
│                                          │
│ [ ] Offline-first mode                  │
│     (Disable public relay writes)       │
│                                          │
│ [Advanced Settings]                     │
└─────────────────────────────────────────┘
```

**In CSM Global System Logs:**
```
✓ Local relay started successfully (ws://localhost:7777)
✓ Connected to 5 public relays for sync
✓ Database loaded: 1.2 GB (12,458 events)
→ Ready to accept events
```

### Event Triggers

**When "Save Settings" clicked:**
1. Frontend calls `TauriRelayService.startRelay(publicRelays)`
2. Tauri backend starts relay process
3. Wait for WebSocket ready (`ws://localhost:7777`)
4. Update Settings UI status: "Starting..." → "Running"
5. Log to CSM Global: "✓ Local relay started successfully"
6. Switch all Noornote traffic to `ws://localhost:7777`

**When app launches (if relay was enabled):**
1. Auto-start relay in background
2. Log to CSM Global: "✓ Local relay auto-started"
3. Wait for ready before showing UI

**When app closes:**
1. Gracefully stop relay
2. Flush pending events to disk
3. Log to CSM Global: "✓ Local relay stopped"

## Requirements

### Must Support All NIPs

The relay must be a **full-featured Nostr relay**, not a minimal implementation:

- ✅ **NIP-01:** Basic protocol (kinds 0-40000+)
- ✅ **NIP-02:** Contact List & Petnames
- ✅ **NIP-04:** Encrypted Direct Messages
- ✅ **NIP-09:** Event Deletion
- ✅ **NIP-11:** Relay Information Document
- ✅ **NIP-42:** Authentication
- ✅ **NIP-50:** Search
- ✅ **NIP-65:** Relay List Metadata
- ✅ **All other NIPs** that public relays support

**Why:** User expects local relay to be a drop-in replacement for public relays. Any missing NIPs would break features.

### Offline Queue & Sync

**Critical Feature:** Handle write operations when offline

**Behavior:**
1. User writes event (post, like, zap) while offline
2. Local relay accepts event immediately (instant UI feedback)
3. Event stored in **outbox queue**
4. When internet connection restored:
   - Relay automatically syncs queued events to configured public relays
   - Retry logic for failed sends
   - UI notification when sync complete
   - Log to CSM Global: "✓ Synced 3 events to public relays"

**Implementation:**
- Outbox queue stored in relay database
- Background sync process checks connectivity every 30s
- Events marked as "synced" or "pending"
- User can view pending events in Settings

### Bidirectional Sync

**Read (always):**
- Relay subscribes to public relays
- Caches all events matching user's subscriptions
- Noornote reads from local relay (fast, no network latency)

**Write (when online):**
- Noornote publishes to local relay
- Local relay immediately forwards to public relays
- If offline: queue for later

**Database:**
- LMDB (embedded, no external DB)
- Stores all events locally
- Configurable max size (default: 10GB)
- LRU eviction when limit reached

## Technical Implementation

### Architecture

```
Tauri Desktop App
├── Frontend (WebView)
│   ├── Noornote UI → ws://localhost:7777
│   │
│   └── Services
│       ├── TauriRelayService (controls relay)
│       └── NostrTransport (uses relay)
│
├── Backend (Rust)
│   ├── Relay Manager
│   │   ├── Start/Stop relay process
│   │   ├── Monitor health & auto-restart
│   │   ├── Status reporting to frontend
│   │   └── Lifecycle management
│   │
│   └── Embedded Relay Binary
│       ├── strfry (or alternative)
│       ├── Config: strfry.conf (auto-generated)
│       └── Database: ~/.noornote/relay/
│
└── Resources (bundled)
    └── bin/
        ├── strfry-macos-arm64
        ├── strfry-macos-x64
        ├── strfry-linux-x64
        └── strfry-windows-x64.exe
```

### Relay Software Options

**Option 1: strfry (Current Development Relay)**
- ✅ Pros: Full NIP support, battle-tested, high performance
- ❌ Cons: ~10MB binary, C++ (harder to bundle)
- Status: Used in development, proven reliable

**Option 2: nostr-rs-relay**
- ✅ Pros: Rust (easier Tauri integration), ~5MB binary
- ❌ Cons: Less mature than strfry
- Repo: https://github.com/scsibug/nostr-rs-relay

**Option 3: Custom Relay (Not Recommended)**
- ❌ Cons: Huge effort, incomplete NIP support, maintenance burden
- Decision: Use existing mature relay software

**Recommendation:** Start with **strfry**, evaluate **nostr-rs-relay** if binary size is critical.

### Tauri Backend (Rust)

**File:** `src-tauri/src/relay/manager.rs`

```rust
use std::process::{Command, Child, Stdio};
use std::path::PathBuf;
use tauri::api::path::app_data_dir;
use std::time::{Duration, Instant};

pub struct RelayManager {
    process: Option<Child>,
    config_path: PathBuf,
    db_path: PathBuf,
    start_time: Option<Instant>,
}

impl RelayManager {
    pub fn new() -> Result<Self, String> {
        let app_data = app_data_dir(&Config::default())
            .ok_or("Failed to get app data dir")?;

        let relay_dir = app_data.join("relay");
        std::fs::create_dir_all(&relay_dir)
            .map_err(|e| format!("Failed to create relay dir: {}", e))?;

        Ok(Self {
            process: None,
            config_path: relay_dir.join("strfry.conf"),
            db_path: relay_dir.join("db"),
            start_time: None,
        })
    }

    pub fn start(&mut self, public_relays: Vec<String>) -> Result<(), String> {
        // Generate config with public relay URLs
        self.generate_config(&public_relays)?;

        // Get relay binary path from resources
        let binary_path = self.get_relay_binary()?;

        // Start relay process
        let child = Command::new(binary_path)
            .arg("relay")
            .arg("--config")
            .arg(&self.config_path)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start relay: {}", e))?;

        self.process = Some(child);
        self.start_time = Some(Instant::now());

        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
            child.kill()
                .map_err(|e| format!("Failed to stop relay: {}", e))?;
        }
        self.start_time = None;
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.process.is_some()
    }

    pub fn get_uptime(&self) -> Option<Duration> {
        self.start_time.map(|start| start.elapsed())
    }

    pub fn get_storage_info(&self) -> Result<(u64, u64), String> {
        // Get database directory size
        let used = fs_extra::dir::get_size(&self.db_path)
            .map_err(|e| format!("Failed to get db size: {}", e))?;

        let max = 10 * 1024 * 1024 * 1024; // 10GB

        Ok((used, max))
    }

    fn generate_config(&self, public_relays: &[String]) -> Result<(), String> {
        let relay_urls = public_relays.iter()
            .map(|url| format!("\"{}\"", url))
            .collect::<Vec<_>>()
            .join("\n      ");

        let config = format!(r#"
##
## Noornote Embedded Relay Config
## Auto-generated by Tauri backend
##

relay {{
    bind = "127.0.0.1"
    port = 7777
    nofiles = 1000000
}}

db {{
    dbdir = "{}"
    max_size = 10737418240  # 10GB
}}

events {{
    rejectEventsOlderThanYears = 0  # Accept all
    rejectEphemeralEventsOlderThanSeconds = 0  # Accept all
}}

relay {{
    name = "Noornote Local Relay"
    description = "Personal backup relay bundled with Noornote"
    icon = ""
}}

# Sync with public relays
streams {{
    public-relays {{
        direction = "both"
        urls = [
            {}
        ]
    }}
}}
"#, self.db_path.display(), relay_urls);

        std::fs::write(&self.config_path, config)
            .map_err(|e| format!("Failed to write config: {}", e))?;

        Ok(())
    }

    fn get_relay_binary(&self) -> Result<PathBuf, String> {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        let binary_name = "strfry-macos-arm64";

        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        let binary_name = "strfry-macos-x64";

        #[cfg(target_os = "linux")]
        let binary_name = "strfry-linux-x64";

        #[cfg(target_os = "windows")]
        let binary_name = "strfry-windows-x64.exe";

        // Binary bundled in resources
        let resource_dir = std::env::current_exe()
            .ok().and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .ok_or("Failed to get exe dir")?;

        let binary_path = resource_dir.join("resources").join("bin").join(binary_name);

        if !binary_path.exists() {
            return Err(format!("Relay binary not found: {:?}", binary_path));
        }

        Ok(binary_path)
    }
}
```

**Tauri Commands:**

```rust
#[tauri::command]
async fn start_local_relay(
    state: State<'_, Arc<Mutex<RelayManager>>>,
    public_relays: Vec<String>
) -> Result<(), String> {
    let mut manager = state.lock().unwrap();
    manager.start(public_relays)
}

#[tauri::command]
async fn stop_local_relay(
    state: State<'_, Arc<Mutex<RelayManager>>>
) -> Result<(), String> {
    let mut manager = state.lock().unwrap();
    manager.stop()
}

#[tauri::command]
async fn relay_status(
    state: State<'_, Arc<Mutex<RelayManager>>>
) -> Result<RelayStatus, String> {
    let manager = state.lock().unwrap();

    let uptime = manager.get_uptime()
        .map(|d| format!("{}h {}m", d.as_secs() / 3600, (d.as_secs() % 3600) / 60))
        .unwrap_or_else(|| "Not running".to_string());

    let (used, max) = manager.get_storage_info()?;

    Ok(RelayStatus {
        running: manager.is_running(),
        uptime,
        storage_used: used,
        storage_max: max,
        pending_events: 0, // TODO: implement queue tracking
    })
}

#[derive(serde::Serialize)]
struct RelayStatus {
    running: bool,
    uptime: String,
    storage_used: u64,
    storage_max: u64,
    pending_events: u32,
}
```

### Frontend Integration

**File:** `src/services/TauriRelayService.ts`

```typescript
/**
 * TauriRelayService - Embedded Relay Management
 * Controls the bundled relay via Tauri backend
 * Only available in Tauri builds (not browser)
 */

import { invoke } from '@tauri-apps/api/tauri';
import { DebugLogger } from '../components/debug/DebugLogger';

export interface RelayStatus {
  running: boolean;
  uptime: string;
  storage_used: number;
  storage_max: number;
  pending_events: number;
}

export class TauriRelayService {
  private static instance: TauriRelayService;
  private debugLogger: DebugLogger;

  private constructor() {
    this.debugLogger = DebugLogger.getInstance();
  }

  public static getInstance(): TauriRelayService {
    if (!TauriRelayService.instance) {
      TauriRelayService.instance = new TauriRelayService();
    }
    return TauriRelayService.instance;
  }

  /**
   * Check if running in Tauri environment
   */
  public isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  /**
   * Start embedded relay with configured public relays
   * Logs to CSM Global system logs
   */
  public async startRelay(publicRelays: string[]): Promise<void> {
    if (!this.isTauri()) {
      throw new Error('Embedded relay only available in Tauri builds');
    }

    try {
      this.debugLogger.info('TauriRelayService', 'Starting local relay...');

      await invoke('start_local_relay', { publicRelays });

      // Wait for WebSocket to be ready
      await this.waitForReady();

      this.debugLogger.info(
        'TauriRelayService',
        '✓ Local relay started successfully (ws://localhost:7777)'
      );

      this.debugLogger.info(
        'TauriRelayService',
        `✓ Connected to ${publicRelays.length} public relays for sync`
      );

      const status = await this.getStatus();
      const storageGB = (status.storage_used / (1024 * 1024 * 1024)).toFixed(2);
      this.debugLogger.info(
        'TauriRelayService',
        `✓ Database loaded: ${storageGB} GB`
      );

      this.debugLogger.info('TauriRelayService', '→ Ready to accept events');

    } catch (error) {
      this.debugLogger.error('TauriRelayService', `Failed to start relay: ${error}`);
      throw error;
    }
  }

  /**
   * Stop embedded relay
   */
  public async stopRelay(): Promise<void> {
    if (!this.isTauri()) return;

    try {
      await invoke('stop_local_relay');
      this.debugLogger.info('TauriRelayService', '✓ Local relay stopped');
    } catch (error) {
      this.debugLogger.error('TauriRelayService', `Failed to stop relay: ${error}`);
      throw error;
    }
  }

  /**
   * Get relay status for UI display
   */
  public async getStatus(): Promise<RelayStatus> {
    if (!this.isTauri()) {
      return {
        running: false,
        uptime: 'Not available',
        storage_used: 0,
        storage_max: 0,
        pending_events: 0
      };
    }

    return await invoke('relay_status');
  }

  /**
   * Wait for relay WebSocket to be ready
   */
  private async waitForReady(timeoutMs: number = 10000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const ws = new WebSocket('ws://localhost:7777');

        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            ws.close();
            resolve();
          };
          ws.onerror = reject;
        });

        return; // Success
      } catch {
        // Retry after 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    throw new Error('Relay did not become ready in time');
  }
}
```

**Settings Integration:**

```typescript
// In SettingsView.ts - handleSave()
private async handleSave(): Promise<void> {
  const currentUser = this.authService.getCurrentUser();
  if (!currentUser) {
    this.showMessage('Please log in to save relay settings', 'error');
    return;
  }

  try {
    // Save public relays and local relay settings to localStorage
    this.savePublicRelays(this.tempRelays);
    this.saveLocalRelaySettings();

    // Clear existing relays from RelayConfig
    const existingRelays = this.relayConfig.getAllRelays();
    existingRelays.forEach(relay => {
      this.relayConfig.removeRelay(relay.url);
    });

    // TAURI: Start/stop embedded relay based on settings
    if (this.isTauriEnvironment()) {
      const relayService = TauriRelayService.getInstance();

      if (this.localRelaySettings.enabled) {
        // START RELAY: User enabled local relay
        const publicRelayUrls = this.tempRelays.map(r => r.url);

        this.showMessage('Starting local relay...', 'info');

        await relayService.startRelay(publicRelayUrls);

        // Add only localhost to RelayConfig
        this.relayConfig.addRelay({
          url: 'ws://localhost:7777',
          name: 'Local Relay',
          types: ['read', 'write', 'inbox'],
          isPaid: false,
          requiresAuth: false,
          isActive: true
        });

        this.showMessage('Local relay started successfully!', 'success');

      } else {
        // STOP RELAY: User disabled local relay
        await relayService.stopRelay();

        // Add public relays to RelayConfig
        this.tempRelays.forEach(relay => {
          this.relayConfig.addRelay(relay);
        });

        this.showMessage('Local relay stopped', 'success');
      }
    } else {
      // BROWSER: Standard relay switching (existing logic)
      if (this.localRelaySettings.enabled) {
        this.relayConfig.addRelay({
          url: this.localRelaySettings.url,
          name: 'Local Relay',
          types: ['read', 'write', 'inbox'],
          isPaid: false,
          requiresAuth: false,
          isActive: true
        });
      } else {
        this.tempRelays.forEach(relay => {
          this.relayConfig.addRelay(relay);
        });
      }
    }

    // Publish NIP-65 relay list to network
    await this.publishRelayList();

    // Start polling relay status updates (Tauri only)
    if (this.isTauriEnvironment() && this.localRelaySettings.enabled) {
      this.startStatusPolling();
    }

  } catch (error) {
    this.showMessage('Failed to save settings: ' + error, 'error');
  }
}

/**
 * Poll relay status for UI updates (Tauri only)
 */
private startStatusPolling(): void {
  if (this.statusPollingInterval) {
    clearInterval(this.statusPollingInterval);
  }

  const relayService = TauriRelayService.getInstance();

  this.statusPollingInterval = setInterval(async () => {
    try {
      const status = await relayService.getStatus();
      this.updateRelayStatusUI(status);
    } catch (error) {
      console.error('Failed to get relay status:', error);
    }
  }, 2000); // Update every 2 seconds
}

/**
 * Update relay status in UI
 */
private updateRelayStatusUI(status: RelayStatus): void {
  const statusEl = this.container.querySelector('.relay-status-value');
  if (statusEl) {
    statusEl.textContent = status.running ? '● Running' : '○ Stopped';
  }

  const uptimeEl = this.container.querySelector('.relay-uptime-value');
  if (uptimeEl) {
    uptimeEl.textContent = status.uptime;
  }

  const storageEl = this.container.querySelector('.relay-storage-value');
  if (storageEl) {
    const usedGB = (status.storage_used / (1024 * 1024 * 1024)).toFixed(2);
    const maxGB = (status.storage_max / (1024 * 1024 * 1024)).toFixed(0);
    storageEl.textContent = `${usedGB} GB / ${maxGB} GB used`;
  }

  const pendingEl = this.container.querySelector('.relay-pending-value');
  if (pendingEl) {
    pendingEl.textContent = status.pending_events.toString();
  }
}

private isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
```

## Building Relay Binaries

### Cross-Platform Compilation

**For strfry:**

```bash
# macOS ARM64 (Apple Silicon)
cargo build --release --target aarch64-apple-darwin

# macOS x64 (Intel)
cargo build --release --target x86_64-apple-darwin

# Linux x64
cargo build --release --target x86_64-unknown-linux-gnu

# Windows x64
cargo build --release --target x86_64-pc-windows-msvc
```

**Size Optimization:**

```toml
# Cargo.toml
[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link-time optimization
codegen-units = 1   # Better optimization
strip = true        # Strip symbols
```

Expected sizes after optimization:
- macOS: ~8MB
- Linux: ~7MB
- Windows: ~9MB

**Total bundle increase:** ~30-35MB (acceptable for desktop app)

## Testing Strategy

### Development Testing

1. **Browser Mode:** Use Docker relay (current setup)
2. **Tauri Dev Mode:** Test embedded relay in `tauri dev`
3. **Production Build:** Full E2E testing in bundled app

### Test Cases

**Settings UI Flow:**
- [ ] Click "Use local relay as gateway" checkbox
- [ ] Click "Save Settings" button
- [ ] Status changes: "Starting..." → "Running" within 2 seconds
- [ ] CSM Global logs show startup messages
- [ ] WebSocket connects successfully
- [ ] Timeline loads events from localhost:7777

**Lifecycle:**
- [ ] Relay starts automatically on app launch (if enabled)
- [ ] Relay stops cleanly on app close
- [ ] Relay survives app restart (persistent queue)
- [ ] Config updates reload relay correctly

**Write Operations:**
- [ ] Write events while **online** → immediate sync
- [ ] Write events while **offline** → queued
- [ ] Reconnect to internet → queued events sync
- [ ] CSM logs show sync status

**Error Handling:**
- [ ] Binary not found → graceful error message
- [ ] Relay crash → auto-restart + log
- [ ] Port 7777 conflict → error message
- [ ] WebSocket timeout → retry logic

## Rollout Plan

### Phase 1: Tauri Basics (v0.9)
- Bundle relay binary in resources
- Implement RelayManager in Rust backend
- Start/stop via Tauri commands
- Basic config generation
- Settings UI integration (checkbox + save button)

### Phase 2: Status & Monitoring (v1.0)
- Real-time status polling
- Storage usage tracking
- CSM Global logging integration
- Uptime display

### Phase 3: Offline Queue (v1.1)
- Implement outbox queue
- Network connectivity detection
- Auto-sync when online
- Pending events counter

### Phase 4: Polish (v1.2)
- Advanced settings (storage limits, cleanup)
- Relay logs viewer
- Performance stats dashboard
- Export/import database

## Future Enhancements

- **P2P Sync:** Sync between user's devices (phone ↔ laptop)
- **Selective Sync:** Only sync events from followed users
- **Backup to Cloud:** Optional encrypted backup to user's cloud storage
- **Relay Stats Dashboard:** View relay performance metrics
- **Custom NIP Support:** User-installable relay plugins

## References

- **strfry:** https://github.com/hoytech/strfry
- **nostr-rs-relay:** https://github.com/scsibug/nostr-rs-relay
- **Tauri:** https://tauri.app/
- **NIP-01:** https://github.com/nostr-protocol/nips/blob/master/01.md
