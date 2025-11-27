# Build Pipeline: Browser-First

> **Siehe auch:** [Platform-Strategie](./platform-strategy.md) für Gesamtübersicht

## Strategie: Browser-First

Rust-Server + Browser für alle Plattformen.
Tauri optional/später (nur wenn NoorSigner-Nachfrage besteht).

## Scope

| Phase | Plattform | Architektur | Format | App-Typ |
|-------|-----------|-------------|--------|---------|
| 1 | macOS | ARM64 | .app | Rust-Server |
| 1 | macOS | AMD64 | .app | Rust-Server |
| 1 | Linux Desktop | AMD64 | Binary | Rust-Server |
| 1 | Windows | AMD64 | .exe | Rust-Server |
| 2 | Linux Mobile (Librem 5) | ARM64 | ? | TBD |
| - | (Optional: Tauri) | alle | .dmg/.AppImage | Tauri + NoorSigner |

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

## Librem 5 - Offene Frage

**Problem:** Gibt es NIP-07 Browser-Extensions für Librem 5?

**Optionen:**
1. Falls ja → Rust-Server wie andere Plattformen
2. Falls nein → Tauri + NoorSigner reaktivieren
3. Falls nein → Remote Signer (bunker://) als einzige Option

**TODO:** Recherchieren

---

## Tauri (Optional/Später)

Falls NoorSigner-Nachfrage besteht, bestehende Integration nutzen:

### Bestehende Dateien
- `KeySignerClient.ts` - Frontend-Kommunikation
- `key_signer.rs` - Rust-Backend
- `tauri.conf.json` - Resources-Eintrag
- `noorsigner/` - Separates Projekt

### Status
- Code existiert und funktioniert
- Wird nicht aktiv weiterentwickelt
- Kann bei Bedarf reaktiviert werden

---

## CI/CD (später)

GitHub Actions für automatische Releases:
- Trigger: Git Tag (v1.0.0)
- Build: Alle Plattformen parallel
- Release: GitHub Releases mit Binaries

---

## Notizen

- Entwicklung erfolgt auf macOS
- Browser-Extension (Alby/nos2x) für Key-Management
- Unzensierbar: Alles lokal, keine Server-Infrastruktur
