# Build Pipeline: Dual-Platform

> **Siehe auch:** [Platform-Strategie](./platform-strategy.md) für Gesamtübersicht

## Strategie: Dual-Platform

Rust-Server + Browser UND Tauri Desktop parallel für alle Plattformen.

## Scope

| Phase | Plattform | Architektur | Format | App-Typ |
|-------|-----------|-------------|--------|---------|
| 1 | macOS | ARM64 | .app | Rust-Server |
| 1 | macOS | ARM64 | .dmg | Tauri |
| 1 | macOS | AMD64 | .app | Rust-Server |
| 1 | macOS | AMD64 | .dmg | Tauri |
| 1 | Linux Desktop | AMD64 | Binary | Rust-Server |
| 1 | Linux Desktop | AMD64 | .AppImage | Tauri |
| 1 | Windows | AMD64 | .exe | Rust-Server |
| 1 | Windows | AMD64 | .msi | Tauri |
| 2 | Linux Mobile (Librem 5) | ARM64 | ? | TBD |

**Entwicklung:** macOS (Host)

---

## Rust-Server

### Konzept
- Minimale Rust-Binary (~10MB)
- Eingebetteter Web-Server (axum oder warp)
- Bündelt Web-Assets (`npm run build` → `dist/`)
- Öffnet Default-Browser auf `localhost:PORT`
- Key-Management via NIP-07 Extension

### Rust-Stack
- `axum` oder `warp` - HTTP-Server
- `rust-embed` - Web-Assets einbetten
- `open` crate - Browser öffnen
- `clap` - CLI-Argumente (optional: Port, etc.)

### Binary-Naming
```
noornote-server-aarch64-apple-darwin        (macOS ARM)
noornote-server-x86_64-apple-darwin         (macOS Intel)
noornote-server-x86_64-unknown-linux-gnu    (Linux Desktop)
noornote-server-x86_64-pc-windows-msvc.exe  (Windows)
```

### Build-Prozess
```bash
# 1. Web-Assets bauen
npm run build

# 2. Rust-Server kompilieren (bündelt dist/)
cd noornote-server
cargo build --release

# 3. Cross-compile für andere Plattformen
cross build --release --target x86_64-pc-windows-msvc
cross build --release --target x86_64-unknown-linux-gnu
```

---

## Tauri Desktop

### Konzept
- Native Desktop-App
- NoorSigner für lokales Key-Management
- Keychain-Integration
- Native File-Dialoge

### Build-Prozess
```bash
# Development
npm run tauri:dev

# Production Build
npm run tauri build
```

---

## Librem 5 - Offene Frage

**Problem:** Gibt es NIP-07 Browser-Extensions für Librem 5?

**Optionen:**
1. Falls ja → Rust-Server wie andere Plattformen
2. Falls nein → Nur Tauri mit NoorSigner
3. Falls nein → Remote Signer (bunker://) als einzige Option

**TODO:** Recherchieren

---

## CI/CD

GitHub Actions für automatische Releases:
- Trigger: Git Tag (v1.0.0)
- Build: Alle Plattformen parallel
- Release: GitHub Releases mit Binaries

---

## Notizen

- Entwicklung erfolgt auf macOS
- Beide Modi (Browser + Tauri) werden parallel entwickelt
- Unzensierbar: Alles lokal, keine Server-Infrastruktur
