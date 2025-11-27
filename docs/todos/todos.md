## 📋 TODOs (volatile, user can request details)

### 🚀 Features (Pending Implementation)

1. **Connectivity Manager**: Watches general internet connection and relay health status
  - **Location:** `src/services/RelayHealthMonitor.ts`
  - **Implementation:** Must check independently whether internet connection exists or NN is connected to all of the configured relays.
  - **Issue:** App doesn't behave well when not connected: too many timeout logs in csl, no error messages anywhere. App just tries to connect endlessly.

2. **Legal/Support Static Page**: Implement static page with legal information, contact form, and support resources.
  - **Content:** Impressum, Datenschutz (DSGVO compliance), voluntary error reporting contact form
  - **Location:** TBD - likely `/legal` or `/about` route
  - **Implementation:** Static component accessible from Settings or Footer
  - **Requirements:** Privacy-first approach, opt-in contact form, no telemetry

3. Plug-in System:
  - On-boarding
  - Bookmarks
  - Freelancer MP
  - Seller MP
  - Discovery

4. **OS-Erkennung & Plattform-Konfiguration**: Plattformspezifische Vorkonfigurationen für macOS, Linux und Windows implementieren.
  - **Platforms:** macOS, Linux, Windows
  - **Scope:**
    - Verzeichnispfade für File Storage (aktuell: `~/.noornote/` für macOS/Linux, `%USERPROFILE%/.noornote/` für Windows)
    - Platform-specific default settings
    - Path resolution per OS
    - Keyboard shortcuts (Cmd vs Ctrl)
    - Window behavior (minimize to tray, etc.)
  - **Location:** TBD - ggf. `src/services/PlatformService.ts` oder `src/config/platform.ts`
  - **Current:** MuteFileStorage.ts nutzt bereits `homeDir()` von Tauri, aber keine zentrale OS-Detection
  - **Goal:** Zentrale Plattform-Erkennung mit OS-spezifischen Defaults für alle File-Storage-Services
  - **Benefits:**
    - Konsistente Pfadverwaltung across all platforms
    - Einheitliche OS-Detection für alle Services
    - Bessere User Experience per Platform
  

### 🐛 Bugs (Require Fixing)

- **ZapService Multiple Errors**: Post-NDK migration issues
  - **Location:** `src/services/ZapService.ts`
  - **Issues:**
    1. Line 9: `import { finishEvent }` → should be `finalizeEvent`
    2. Line 491: `getPool()` method doesn't exist on NostrTransport
    3. Line 500-506: Uses `pool.subscribeMany()` (old API) → should use `NostrTransport.subscribe()`
    4. Wrong callback names: `{ onevent, oneose }` → check NDK docs
  - **Impact:** Zaps broken - all zap operations fail at runtime
  - **Fix Required:** Complete refactor to use NostrTransport API instead of direct pool access


### 📊 Analytics & Monitoring

- **Zap Display Inconsistency in Notifications**: Systematisch untersuchen warum Zaps inkonsistent dargestellt werden. Aktuell gibt es 4 verschiedene Zustände: (1) Zap Line + Amount + gelbes Icon (vollständig), (2) nur gelbes Icon (kein Amount, keine Line), (3) Amount + gelbes Icon (keine Line), (4) Zap Line + Amount. Problem: Zap-Receipts (Kind 9735) kommen nicht immer oder fehlerhaft von NWC Wallets, obwohl Payment erfolgreich war. **Ziel:** Zap Line soll IMMER erscheinen wenn Payment erfolgreich war, unabhängig von Receipt-Status (optimistische UI). Mögliche Lösung: Fake Zap-Receipt Event nach erfolgreichem Payment erstellen oder EventBus-basiertes Update-System zwischen ISL und ZapsList implementieren.

### 🔍 Under Observation

- **KeySigner IPC Connection Lost - UNTER BEOBACHTUNG**: "Broken pipe" Fehler wenn NN im Hintergrund. **Fix implementiert:** (1) Transient Error Detection (Broken pipe, os error 32), (2) Retry-Logik (3x mit 1s Delay), (3) Grace Period (6 Failures = 30s vor Logout), (4) Adaptive Polling (stoppt im Hintergrund, resumed bei Focus). **Logs:** `[KeySigner] Transient connection error`, `[AuthService] Window blurred/focused`, `[AuthService] Daemon check failed (X/6)`, `[AuthService] Connection restored`. **Location:** KeySignerClient.ts, AuthService.ts. **Status:** Monitoring in Production - falls weiterhin Disconnects → Polling Interval erhöhen oder komplett auf EventBus-basierte Lifecycle Events umstellen.
