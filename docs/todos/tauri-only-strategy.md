# Tauri-Only Strategy

## Entscheidung

Browser-Version wird eingestellt. NoorNote wird ausschließlich als Tauri Desktop-App entwickelt.

## Begründung

Die Komplexität, für alle Tauri-Features Browser-Alternativen zu entwickeln, ist zu hoch:

| Feature | Tauri | Browser-Alternative | Problem |
|---------|-------|---------------------|---------|
| Per-user file storage | `~/.noornote/{npub}/` | IndexedDB | Nicht portabel zwischen Geräten |
| List-Sync (File) | Lokale JSON-Files | - | Keine Alternative |
| Bookmark Folders | Lokal gespeichert | Relay-only | Relays unterstützen keine Folders (kind:10003 ist flat) |
| Key-Management | NoorSigner + Keychain | NIP-07 Extensions | Abhängig von Drittanbieter-Extensions |
| Native Dialoge | Tauri FS API | Browser File API | Eingeschränkte Funktionalität |

**Key Insight:** Browser extensions (Alby, nos2x) funktionieren NICHT in Tauri WebViews - nur NoorSigner bietet sichere Auth.

---

## Plattform-Status

| Platform | Build Ready | NoorSigner IPC | Secure Storage | Status |
|----------|-------------|----------------|----------------|--------|
| **macOS** | ✅ | ✅ Unix Socket | ✅ Keychain | Production |
| **Linux** | ✅ | ✅ Unix Socket | ❌ Secret Service | Testing needed |
| **Windows** | ✅ | ❌ Named Pipe | ❌ Credential Manager | Blocked |

---

## Cross-Platform Components (Already Working)

✅ **File Storage**
- Uses Tauri's `homeDir()` API
- Path: `~/.noornote/{npub}/` (all platforms)
- Windows: `%USERPROFILE%/.noornote/{npub}/` (automatic)

✅ **Keyboard Shortcuts**
- Tauri's `Modifiers::SUPER` maps to Cmd/Win/Super automatically
- TypeScript fallback: `e.metaKey || e.ctrlKey`

✅ **All Dependencies**
- Rust: serde, tauri plugins (all cross-platform)
- Node.js: @nostr-dev-kit/ndk, bech32, marked (all pure JS)

✅ **Build System**
- `tauri.conf.json:31` - `"targets": "all"`
- Icons: icns (macOS), ico (Windows), png (Linux)

✅ **Tauri Plugins**
- keyring, dialog, fs, http, shell, global-shortcut (all platforms)

---

## NoorSigner Ports

NoorSigner muss für alle Plattformen verfügbar sein.

### macOS (✅ Fertig)
- Keychain für sichere Speicherung
- ARM64 + x86_64
- Unix Socket IPC

### Linux (❌ TODO)

**IPC:** Unix Socket (wie macOS) - bereits implementiert

**Secure Storage:** Secret Service API (GNOME Keyring / KWallet)
```rust
use keyring::Entry;

let entry = Entry::new("noorsigner", &npub)?;
entry.set_password(&encrypted_nsec)?;
```

**Schritte:**
1. [ ] Secret Service auf Linux testen (Ubuntu VM)
2. [ ] Fallback für Systeme ohne Secret Service (encrypted file?)
3. [ ] GitHub Actions: Linux Build hinzufügen
4. [ ] AppImage konfigurieren

**Terminal Launch Fallbacks:** gnome-terminal → konsole → xterm

**Dependencies:**
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev \
  libgtk-3-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
```

### Windows (❌ TODO)

**IPC:** Named Pipes (statt Unix Socket)

**NoorSigner Änderungen (daemon.go):**
```go
import "runtime"

if runtime.GOOS == "windows" {
    // Windows Named Pipes
    listener, err = winio.ListenPipe(`\\.\pipe\noorsigner`, nil)
} else {
    // Unix/Linux/macOS
    listener, err = net.Listen("unix", socketPath)
}
```

**Socket Path:**
```go
func getSocketPath() (string, error) {
    if runtime.GOOS == "windows" {
        return `\\.\pipe\noorsigner`, nil
    }
    // Unix path...
}
```

**Secure Storage:** Windows Credential Manager
```rust
use keyring::Entry;

let entry = Entry::new("noorsigner", &npub)?;
entry.set_password(&encrypted_nsec)?;
```

**Schritte:**
1. [ ] `keyring` crate evaluieren (cross-platform)
2. [ ] Windows Named Pipe in NoorSigner implementieren
3. [ ] Windows Credential Manager testen
4. [ ] GitHub Actions: Windows Build hinzufügen
5. [ ] Windows Installer (.msi) konfigurieren

**NoorNote Tauri Änderungen:** Bereits vorbereitet in `src-tauri/src/key_signer.rs:75-80` (auskommentiert)

---

## keyring-rs Crate

Cross-platform Lösung für alle drei Plattformen:

```toml
# Cargo.toml
[dependencies]
keyring = "2"
```

| Platform | Backend |
|----------|---------|
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | Secret Service (D-Bus) |

**Aktuell in NoorSigner:**
- Verwendet `security-framework` (macOS-only)
- Muss auf `keyring` umgestellt werden

---

## NoorNote Cleanup (Nach Cross-Platform)

### Phase 1: Browser-Code entfernen
- [ ] `noorserver/` Repo archivieren
- [ ] Browser-Fallbacks in Services entfernen
- [ ] `PlatformService.isBrowser` Checks entfernen

### Phase 2: Codebase vereinfachen
- [ ] `PlatformService` auf Tauri-only reduzieren
- [ ] Browser-spezifische File-APIs entfernen (Blob download, FileReader)
- [ ] NIP-07 Extension Support entfernen

### Phase 3: Docs aktualisieren
- [ ] README: Nur Tauri-Installation dokumentieren

---

## Testing Setup

| Plattform | Umgebung | Zweck |
|-----------|----------|-------|
| macOS | Host | Entwicklung + Build |
| Windows | Echter Laptop | Named Pipe + Credential Manager testen |
| Ubuntu | UTM VM | Secret Service testen |

---

## Testing Checklists

### Linux
- [ ] Build completes without errors
- [ ] App launches and displays UI
- [ ] NoorSigner daemon starts in terminal
- [ ] Auth with NoorSigner works
- [ ] Can sign events (create posts)
- [ ] File storage creates `~/.noornote/{npub}/` directory
- [ ] Keyboard shortcuts work (Super+K)

### Windows
- [ ] NoorSigner builds on Windows
- [ ] Named Pipe `\\.\pipe\noorsigner` created
- [ ] NoorNote can connect to Named Pipe
- [ ] Auth with NoorSigner works
- [ ] Can sign events
- [ ] File storage works in `%USERPROFILE%\.noornote\{npub}\`
- [ ] Keyboard shortcuts work (Win+K)

---

## Offene Fragen

- [ ] Librem 5: Unterstützt Secret Service? Falls nein → eigene Lösung
- [ ] NoorSigner als separates Projekt für andere Nostr-Apps?
