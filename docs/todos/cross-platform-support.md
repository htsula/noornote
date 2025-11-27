# Cross-Platform Support: Linux & Windows

**Status:** Planned
**Priority:** HIGH (Linux) / MEDIUM (Windows)
**Total Effort:** 12-18 hours
**Created:** 2025-11-21

---

## Executive Summary

Noornote is **95% cross-platform ready** thanks to Tauri. The remaining work focuses on:
- **Linux:** Testing existing code (4-8 hours)
- **Windows:** NoorSigner Named Pipe implementation (8-10 hours)

**Key Insight:** No browser extensions (Alby, nos2x) work in Tauri apps - only KeySigner provides secure auth.

---

## Current Platform Status

| Platform | Build Ready | KeySigner IPC | Auth Methods | Status |
|----------|-------------|---------------|--------------|--------|
| **macOS** | ✅ | ✅ Unix Socket | nsec, npub, KeySigner | Production |
| **Linux** | ✅ | ✅ Unix Socket | nsec, npub, KeySigner | Testing needed |
| **Windows** | ✅ | ❌ Not impl. | nsec, npub only | Blocked |

### Cross-Platform Components (Already Working)

✅ **File Storage**
- Uses Tauri's `homeDir()` API
- Path: `~/.noornote/` (all platforms)
- Windows: `%USERPROFILE%/.noornote/` (automatic)

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

## Authentication Methods in Tauri

**CRITICAL:** Browser extensions (Alby, nos2x) **DO NOT WORK** in Tauri apps!

| Method | Security | macOS | Linux | Windows | Notes |
|--------|----------|-------|-------|---------|-------|
| **nsec direct** | ⚠️ Low | ✅ | ✅ | ✅ | Plaintext input, not recommended |
| **npub** | ✅ Safe | ✅ | ✅ | ✅ | Read-only (cannot sign) |
| **Browser Extension** | N/A | ❌ | ❌ | ❌ | Requires browser, not WebView |
| **KeySigner IPC** | ✅ High | ✅ | ✅ | ❌ | **Secure option, Windows blocked** |
| **NIP-46 Remote** | ✅ High | ❌ | ❌ | ❌ | Future (see NIP46-Learning.md) |

**Without KeySigner on Windows:**
- Users must enter nsec directly (insecure)
- Or use npub only (read-only mode)

**→ Windows support REQUIRES KeySigner implementation!**

---

## Phase 1: Linux Support (Week 1-2)

**Effort:** 4-8 hours
**Priority:** HIGH
**ROI:** High (large Linux user base in Nostr community)

### Current State

✅ **Code is ready** - No changes needed!
- Unix Socket: `~/.noornote/noorsigner.sock` (same as macOS)
- Terminal launch: Fallbacks for gnome-terminal, konsole, xterm
- File paths: `~/.noornote/` (works automatically)
- All Tauri APIs are cross-platform

### TODO

1. **Testing (2-3h)**
   - Set up Ubuntu 22.04 LTS VM/machine
   - Test `npm run tauri build`
   - Verify KeySigner daemon launch and auth
   - Test Unix socket communication
   - Verify file storage operations

2. **Dependencies Check (30min)**
   ```bash
   sudo apt-get update
   sudo apt-get install -y libwebkit2gtk-4.1-dev \
     libgtk-3-dev \
     libsoup-3.0-dev \
     libjavascriptcoregtk-4.1-dev
   ```

3. **Documentation (1-2h)**
   - Add Linux section to README.md
   - Installation instructions for different distros
   - Troubleshooting guide

4. **Binary Verification (30min)**
   - Verify NoorSigner Linux binaries work:
     - `noorsigner-linux-amd64` (4.3 MB)
     - `noorsigner-linux-arm64` (4.2 MB)

5. **Desktop Integration (1h)**
   - Test .desktop file creation
   - Test system tray (if implemented)
   - Verify window management (X11/Wayland)

### Package Scripts to Add

```json
"tauri:dev:linux": "TAURI_DEV_MODE=wide tauri dev",
"tauri:build:linux": "tauri build --target x86_64-unknown-linux-gnu"
```

### Testing Checklist

- [ ] Build completes without errors
- [ ] App launches and displays UI
- [ ] KeySigner daemon starts in terminal
- [ ] Auth with KeySigner works
- [ ] Can sign events (create posts)
- [ ] File storage creates `~/.noornote/` directory
- [ ] Keyboard shortcuts work (Super+K)
- [ ] Clipboard operations work
- [ ] Native GTK dialogs display correctly

---

## Phase 2: Windows Support (Week 3-4)

**Effort:** 8-10 hours
**Priority:** MEDIUM
**ROI:** Medium (smaller Windows user base in Nostr)

### The Blocker: KeySigner Windows Named Pipe

**Current Issue:**
Noornote Tauri app expects Named Pipe IPC, but NoorSigner uses Unix sockets only.

**Files:**
- **Noornote:** `src-tauri/src/key_signer.rs:75-80` → Already has Windows client code (commented out)
- **NoorSigner:** `daemon.go:214` → Hardcoded `net.Listen("unix", socketPath)`

### Required Changes (ALL IN NOORSIGNER)

#### 1. Platform-Specific Listener (2-3h)

**File:** `/Users/jev/projects/noorsigner/daemon.go`

**Current Code (Line 214):**
```go
listener, err := net.Listen("unix", socketPath)
```

**New Code:**
```go
import "runtime"

var listener net.Listener
var err error

if runtime.GOOS == "windows" {
    // Windows Named Pipes
    // Option A: Use winio (Microsoft official)
    listener, err = winio.ListenPipe(`\\.\pipe\noorsigner`, nil)

    // Option B: Pure net package (no extra dependency)
    // listener, err = net.Listen("pipe", `\\.\pipe\noorsigner`)
} else {
    // Unix/Linux/macOS
    os.Remove(socketPath) // Remove stale socket
    listener, err = net.Listen("unix", socketPath)
    if err == nil {
        os.Chmod(socketPath, 0600) // Set permissions
    }
}
```

**Dependencies (if using winio):**
```bash
go get github.com/Microsoft/go-winio
```

#### 2. Update `getSocketPath()` (30min)

**File:** `/Users/jev/projects/noorsigner/daemon.go`

**Current Code:**
```go
func getSocketPath() (string, error) {
    storageDir, err := getStorageDir()
    if err != nil {
        return "", err
    }
    return filepath.Join(storageDir, "noorsigner.sock"), nil
}
```

**New Code:**
```go
import "runtime"

func getSocketPath() (string, error) {
    if runtime.GOOS == "windows" {
        return `\\.\pipe\noorsigner`, nil
    }

    storageDir, err := getStorageDir()
    if err != nil {
        return "", err
    }
    return filepath.Join(storageDir, "noorsigner.sock"), nil
}
```

#### 3. Socket Cleanup Logic (15min)

**File:** `/Users/jev/projects/noorsigner/daemon.go:509-515`

**Current Code:**
```go
func (d *Daemon) Stop() error {
    if d.listener != nil {
        d.listener.Close()
    }

    // Remove socket file
    if socketPath, err := getSocketPath(); err == nil {
        os.Remove(socketPath)
    }

    return nil
}
```

**New Code:**
```go
import "runtime"

func (d *Daemon) Stop() error {
    if d.listener != nil {
        d.listener.Close()
    }

    // Remove socket file (Unix only - Windows pipes auto-cleanup)
    if runtime.GOOS != "windows" {
        if socketPath, err := getSocketPath(); err == nil {
            os.Remove(socketPath)
        }
    }

    return nil
}
```

#### 4. Trust Session Path (Already Works!)

**File:** `/Users/jev/projects/noorsigner/storage.go`

Go's `os.UserHomeDir()` automatically returns:
- macOS/Linux: `$HOME`
- Windows: `%USERPROFILE%`

**No changes needed** - already cross-platform!

### Noornote Tauri App Changes (NONE!)

**File:** `src-tauri/src/key_signer.rs:75-80`

Windows Named Pipe client code **already exists**, just commented out:

```rust
#[cfg(windows)]
{
    // TODO: Implement Windows named pipe support
    Err("Windows named pipes not yet implemented".to_string())
}
```

**Action:** Uncomment and implement basic Named Pipe client (already drafted in code).

**Estimated Effort:** 1-2 hours (mostly testing)

### NPM Scripts Fix (15min)

**File:** `/Users/jev/projects/noornote/package.json:20-21`

**Current (Unix-only):**
```json
"tauri:dev": "TAURI_DEV_MODE=wide tauri dev",
"tauri:dev:clean": "TAURI_DEV_MODE=clean tauri dev"
```

**New (Cross-platform):**
```bash
npm install --save-dev cross-env
```

```json
"tauri:dev": "cross-env TAURI_DEV_MODE=wide tauri dev",
"tauri:dev:clean": "cross-env TAURI_DEV_MODE=clean tauri dev"
```

### Testing on Windows (2-3h)

**Requirements:**
- Windows 11 VM or physical machine
- Go installed for NoorSigner build
- Node.js 20+ and Rust for Noornote build

**Test Plan:**
1. Build NoorSigner: `./build.sh` (or manually on Windows)
2. Test NoorSigner standalone:
   ```cmd
   noorsigner-windows-amd64.exe init
   noorsigner-windows-amd64.exe daemon
   ```
3. Build Noornote: `npm run tauri build`
4. Test Noornote → KeySigner integration
5. Verify all auth flows work
6. Test file storage in `%USERPROFILE%\.noornote\`

### Testing Checklist

- [ ] NoorSigner builds on Windows
- [ ] Named Pipe `\\.\pipe\noorsigner` created
- [ ] Noornote can connect to Named Pipe
- [ ] Auth with KeySigner works
- [ ] Can sign events
- [ ] Trust session persists across daemon restarts
- [ ] File storage works in `%USERPROFILE%\.noornote\`
- [ ] Keyboard shortcuts work (Win+K)
- [ ] WebView2 renders correctly
- [ ] Native Windows dialogs work

### Documentation (2-3h)

**Add to README.md:**
- Windows installation guide
- WebView2 runtime requirements (usually pre-installed on Win11)
- Firewall/antivirus considerations
- Build instructions for Windows developers

---

## NoorSigner Binary Status

**Location:** `/Users/jev/projects/noorsigner/bin/`

| Platform | Binary | Size | Status |
|----------|--------|------|--------|
| macOS ARM64 | noorsigner-macos-arm64 | 5.9 MB | ✅ Production |
| macOS AMD64 | noorsigner-macos-amd64 | 4.4 MB | ✅ Ready |
| Linux AMD64 | noorsigner-linux-amd64 | 4.3 MB | ✅ Ready |
| Linux ARM64 | noorsigner-linux-arm64 | 4.2 MB | ✅ Ready |
| Windows AMD64 | noorsigner-windows-amd64.exe | 4.5 MB | ⚠️ Needs IPC update |

**Build Command:**
```bash
cd /Users/jev/projects/noorsigner
./build.sh
```

Produces all 5 binaries in one command (Go cross-compilation).

---

## Timeline & Effort Breakdown

### Week 1-2: Linux Support
| Task | Effort | Priority |
|------|--------|----------|
| Testing on Ubuntu | 2-3h | HIGH |
| Documentation | 1-2h | HIGH |
| Binary verification | 30min | HIGH |
| Desktop integration | 1h | MEDIUM |
| **Total** | **4-8h** | |

### Week 3-4: Windows Support

**NoorSigner Changes:**
| Task | Effort | Priority |
|------|--------|----------|
| Platform-specific listener | 2-3h | CRITICAL |
| Update getSocketPath() | 30min | CRITICAL |
| Socket cleanup logic | 15min | CRITICAL |
| Testing on Windows | 2-3h | HIGH |
| **Subtotal** | **5-7h** | |

**Noornote Changes:**
| Task | Effort | Priority |
|------|--------|----------|
| cross-env package | 15min | HIGH |
| Testing integration | 1-2h | HIGH |
| Documentation | 2-3h | MEDIUM |
| **Subtotal** | **3-5h** | |

**Total Windows:** 8-12 hours

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Linux terminal detection fails | Low | Multiple fallbacks exist (gnome-terminal, konsole, xterm) |
| Windows Named Pipe errors | Medium | Test thoroughly, fallback to nsec direct input |
| WebView2 not installed | Low | Usually pre-installed on Win11, auto-downloads if missing |
| Build toolchain issues | Low | Tauri CI examples exist, well-documented |

---

## CI/CD Recommendations (Future)

### GitHub Actions Workflow

**File:** `.github/workflows/release.yml` (not yet created)

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        platform: [macos-latest, ubuntu-22.04, windows-latest]

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies (Ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev \
            libgtk-3-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev

      - run: npm install
      - run: npm run tauri build

      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}
          path: src-tauri/target/release/bundle/**/*
```

**Estimated Setup:** 3-4 hours

---

## Platform-Specific Notes

### macOS (Current Production)
- **Socket:** `~/.noorsigner/noorsigner.sock`
- **Terminal:** Terminal.app (via AppleScript)
- **Daemon:** Process forking with `Setsid: true`
- **Storage:** `~/.noornote/`

### Linux (Ready for Testing)
- **Socket:** `~/.noorsigner/noorsigner.sock`
- **Terminal:** gnome-terminal → konsole → xterm (fallbacks)
- **Daemon:** Same as macOS (`Setsid: true`)
- **Storage:** `~/.noornote/`
- **Dependencies:** webkit2gtk, libsoup3, GTK3

### Windows (Needs IPC Implementation)
- **Named Pipe:** `\\.\pipe\noorsigner`
- **Terminal:** CMD (via `cmd /c start`)
- **Daemon:** Basic (no process forking)
- **Storage:** `%USERPROFILE%\.noornote\`
- **Dependencies:** WebView2 (auto-installed on Win11)

---

## Known Limitations

### Windows-Specific
- No process forking (Go limitation on Windows)
- Daemon runs in visible terminal window (unless launched as Windows Service)
- Named Pipe auto-cleanup on process exit (no manual removal needed)

### All Platforms
- **Browser extensions don't work** in Tauri (fundamental WebView limitation)
- NIP-46 Remote Signer not yet implemented (future enhancement)
- Autostart feature implemented but not verified on Linux/Windows

---

## Success Criteria

### Linux Release
- [ ] Binary builds successfully on Ubuntu 22.04
- [ ] KeySigner daemon launches and authenticates
- [ ] Can create and sign posts
- [ ] File storage persists across app restarts
- [ ] Documentation covers Linux-specific setup

### Windows Release
- [ ] NoorSigner Named Pipe implementation works
- [ ] Noornote connects via Named Pipe
- [ ] All auth methods work (nsec, npub, KeySigner)
- [ ] File storage works in correct Windows directories
- [ ] Documentation covers Windows-specific setup

---

## Next Steps

### Immediate (This Week)
1. Set up Ubuntu 22.04 test environment
2. Run existing build and verify KeySigner
3. Document any Linux-specific issues

### Short-Term (Next 2 Weeks)
1. Implement NoorSigner Windows Named Pipe support
2. Test on Windows 11
3. Update documentation for both platforms

### Long-Term (Future)
1. Set up GitHub Actions CI/CD
2. Implement NIP-46 Remote Signer (solves Windows elegantly)
3. Add automated multi-platform testing

---

## References

### Noornote Files
- **Tauri KeySigner:** `src-tauri/src/key_signer.rs`
- **Auth Service:** `src/services/AuthService.ts`
- **Tauri Config:** `src-tauri/tauri.conf.json`

### NoorSigner Files
- **Daemon:** `daemon.go` (IPC implementation)
- **Socket Path:** `getSocketPath()` function
- **Build Script:** `build.sh`
- **README:** Platform-specific notes

### External
- **Tauri Docs:** https://tauri.app/v2/guides/
- **Go Named Pipes:** https://pkg.go.dev/github.com/Microsoft/go-winio
- **NIP-46:** See `docs/todos/NIP46-Learning.md`

---

**Last Updated:** 2025-11-21
**Maintainer:** Development Team
