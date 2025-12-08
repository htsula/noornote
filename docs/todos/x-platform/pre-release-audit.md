# Pre-Release Cross-Platform Audit

**Datum:** 2025-12-08
**Scope:** NoorNote + NoorSigner Cross-Platform-Readiness für Linux/Windows

---

## Zusammenfassung

| Kategorie | Status | Aufwand |
|-----------|--------|---------|
| **Tauri Config** | Ready | - |
| **TypeScript Services** | Ready (1 Minor Fix) | 1h |
| **Rust Backend** | Windows TODO | 4-6h |
| **NoorSigner (Go)** | Windows TODO | 8-12h |
| **Fonts/Assets** | 42MB zu löschen | 5min |

**Gesamt-Aufwand:** ~12-18h (wie in Roadmap geschätzt)

---

## 1. KRITISCHE CROSS-PLATFORM ISSUES

### 1.1 NoorSigner: Windows Named Pipes (BLOCKER)

**Datei:** `noorsigner/daemon.go:262-273`

```go
// Aktuell: Unix-only
listener, err := net.Listen("unix", socketPath)
```

**Problem:** NoorSigner nutzt Unix Domain Sockets - Windows hat keine Unix Sockets.

**Lösung (Windows):**
```go
import "github.com/Microsoft/go-winio"

if runtime.GOOS == "windows" {
    listener, err = winio.ListenPipe(`\\.\pipe\noorsigner`, nil)
} else {
    listener, err = net.Listen("unix", socketPath)
}
```

**Dateien zu ändern:**
- `daemon.go` - Listener-Logik
- `getSocketPath()` - Pfad-Logik (bereits vorbereitet)

**Dependency:** `go get github.com/Microsoft/go-winio`

---

### 1.2 NoorNote Rust: Windows IPC (BLOCKER)

**Datei:** `src-tauri/src/key_signer.rs:75-80`

```rust
#[cfg(windows)]
{
    // Windows Named Pipes implementation
    // TODO: Implement Windows named pipe support
    Err("Windows named pipes not yet implemented".to_string())
}
```

**Problem:** Windows-Kommunikation mit NoorSigner ist nicht implementiert.

**Lösung:** Named Pipe Client in Rust:
```rust
use std::fs::OpenOptions;
use std::io::{Read, Write};

let pipe_path = r"\\.\pipe\noorsigner";
let mut pipe = OpenOptions::new()
    .read(true)
    .write(true)
    .open(pipe_path)?;
```

---

### 1.3 NoorSigner: Windows Autostart (BLOCKER)

**Datei:** `noorsigner/autostart.go:193-207`

```go
func getAutostartStatusWindows() (bool, error) {
    return false, fmt.Errorf("Windows autostart not yet implemented")
}
```

**Problem:** Windows Registry Autostart nicht implementiert.

**Lösung:** Registry Key unter `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`

---

### 1.4 Rust: Hardcoded Production Path

**Datei:** `src-tauri/src/key_signer.rs:182-183`

```rust
// Production: installed in /usr/local/bin/
PathBuf::from("/usr/local/bin/noorsigner")
```

**Problem:** `/usr/local/bin/` existiert nicht auf Windows.

**Lösung:**
```rust
#[cfg(unix)]
let noorsigner_path = PathBuf::from("/usr/local/bin/noorsigner");

#[cfg(windows)]
let noorsigner_path = {
    let mut path = dirs::data_local_dir().unwrap_or_default();
    path.push("Programs");
    path.push("noorsigner");
    path.push("noorsigner.exe");
    path
};
```

---

### 1.5 Rust: HOME vs USERPROFILE

**Datei:** `src-tauri/src/key_signer.rs:89,178,277`

```rust
let home = std::env::var("HOME")
    .map_err(|_| "Failed to get HOME directory".to_string())?;
```

**Problem:** `$HOME` existiert nicht auf Windows (nur `%USERPROFILE%`).

**Lösung:**
```rust
let home = std::env::var("HOME")
    .or_else(|_| std::env::var("USERPROFILE"))
    .map_err(|_| "Failed to get home directory")?;
```

---

## 2. MEDIUM PRIORITY ISSUES

### 2.1 TypeScript: navigator.platform für OS-Detection

**Datei:** `src/services/KeySignerClient.ts:81`

```typescript
const isWindows = typeof navigator !== 'undefined' &&
  navigator.platform.toLowerCase().includes('win');
```

**Problem:** `navigator.platform` ist deprecated und unzuverlässig.

**Lösung:** Tauri OS API nutzen:
```typescript
import { type } from '@tauri-apps/api/os';
const osType = await type(); // 'Windows_NT', 'Darwin', 'Linux'
const isWindows = osType === 'Windows_NT';
```

---

### 2.2 Error Strings sind Unix-spezifisch

**Datei:** `src/services/KeySignerClient.ts:97-103`

```typescript
private isTransientError(errorMessage: string): boolean {
  return (
    errorMessage.includes('Broken pipe') ||
    errorMessage.includes('os error 32') ||  // Unix EPIPE
    errorMessage.includes('Connection reset') ||
    errorMessage.includes('EPIPE')
  );
}
```

**Problem:** Windows nutzt andere Error-Codes.

**Lösung:** Windows-spezifische Errors hinzufügen:
```typescript
// Windows pipe errors
errorMessage.includes('The pipe has been ended') ||
errorMessage.includes('os error 109')
```

---

## 3. PRE-RELEASE QUICK WINS (Risikolos)

### 3.1 Ungenutzte Fonts löschen (42MB!)

**Problem:** 53MB Fonts, aber nur Saira wird benutzt.

```
public/fonts/Noto_Serif/  - 40MB (UNGENUTZT!)
public/fonts/Playfair_Display/ - 2MB (UNGENUTZT!)
public/fonts/Saira/ - 10MB (Davon nur Saira-Bold.ttf genutzt)
```

**Lösung:**
```bash
rm -rf public/fonts/Noto_Serif/
rm -rf public/fonts/Playfair_Display/
# Saira/static/ auch prüfen - nur Bold wird geladen
```

**Einsparung:** ~42MB Bundle-Größe

---

### 3.2 .DS_Store Dateien

```
public/fonts/.DS_Store
```

**Lösung:** `.gitignore` prüfen, manuell löschen.

---

## 4. PLATTFORM-SPEZIFISCHE CHECKLISTE

### 4.1 NoorSigner Cross-Platform

| Feature | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Unix Socket IPC | Ready | Ready | TODO (Named Pipes) |
| Storage (`~/.noorsigner/`) | Ready | Ready | Ready* |
| Autostart | Ready | Ready | TODO (Registry) |
| Terminal Launch | Ready | Ready | TODO |
| Key Encryption | Ready | Ready | Ready |

*Windows nutzt `%USERPROFILE%` automatisch via `os.UserHomeDir()`

### 4.2 NoorNote Tauri

| Feature | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Named Pipe IPC | N/A | N/A | TODO |
| File Storage | Ready | Ready | Ready |
| Keyboard Shortcuts | Ready | Ready | Ready |
| Global Shortcut | Ready | Ready | Ready |
| Terminal Launch | Ready | Ready | TODO |

---

## 5. TESTING CHECKLIST

### Linux (Ubuntu VM)
- [ ] Build completes (`npm run tauri build`)
- [ ] App launches, UI displays correctly
- [ ] NoorSigner starts in terminal (gnome-terminal/konsole/xterm)
- [ ] Auth flow works
- [ ] Can sign events (create posts)
- [ ] File storage creates `~/.noornote/{npub}/`
- [ ] Keyboard shortcuts work (Super+K)
- [ ] DMs work (NIP-44 encrypt/decrypt)

### Windows (Real Hardware)
- [ ] NoorSigner builds (`go build`)
- [ ] Named Pipe `\\.\pipe\noorsigner` created
- [ ] NoorNote can connect to Named Pipe
- [ ] Auth flow works
- [ ] Can sign events
- [ ] File storage works in `%USERPROFILE%\.noornote\{npub}\`
- [ ] Keyboard shortcuts work (Win+K)
- [ ] Autostart works (Registry)

---

## 6. IMPLEMENTIERUNGS-REIHENFOLGE

### Phase 1: NoorSigner Windows Port (8-12h)
1. [ ] `go-winio` Dependency hinzufügen
2. [ ] `daemon.go` - Named Pipe Listener
3. [ ] `autostart.go` - Windows Registry
4. [ ] Build + Test auf Windows

### Phase 2: NoorNote Windows Support (4-6h)
1. [ ] `key_signer.rs` - Named Pipe Client
2. [ ] `key_signer.rs` - HOME/USERPROFILE Fix
3. [ ] `key_signer.rs` - Production Path Fix
4. [ ] `key_signer.rs` - Terminal Launch (cmd.exe)
5. [ ] `KeySignerClient.ts` - OS Detection Fix
6. [ ] Build + Test auf Windows

### Phase 3: Cleanup (1h)
1. [ ] Ungenutzte Fonts löschen
2. [ ] Error Strings erweitern
3. [ ] .DS_Store entfernen

---

## 7. DEPENDENCIES

### NoorSigner (Go)
```bash
go get github.com/Microsoft/go-winio  # Windows Named Pipes
```

### NoorNote (Rust)
Keine zusätzlichen Dependencies nötig - `std::fs::OpenOptions` für Named Pipes.

---

## 8. HINWEISE

### Warum Go für NoorSigner (nicht Rust)?
- NoorSigner ist bereits in Go geschrieben
- Go cross-compiles einfacher: `GOOS=windows go build`
- `go-winio` ist battle-tested für Windows Named Pipes
- Keine Migration nötig

### Socket vs Named Pipe Pfade
```
Unix:    ~/.noorsigner/noorsigner.sock
Windows: \\.\pipe\noorsigner
```

### Dev vs Production Paths
```
macOS Dev:    ~/projects/noorsigner/noorsigner
macOS Prod:   /usr/local/bin/noorsigner
Windows Prod: %LOCALAPPDATA%\Programs\noorsigner\noorsigner.exe
Linux Prod:   /usr/local/bin/noorsigner
```

---

## FAZIT

Der Code ist gut strukturiert mit klaren Platform-Abstraktionen. Die meiste Arbeit liegt in:

1. **NoorSigner Windows IPC** (Hauptaufwand)
2. **NoorNote Rust IPC Client** (Sekundär)
3. **Minor TypeScript Fixes** (Quick)

Nach diesen Änderungen sollte NoorNote + NoorSigner auf allen drei Plattformen laufen.
