# Build Pipeline: Desktop-Only (Tauri)

> **Siehe auch:** [Platform-Strategie](./platform-strategy.md) für Gesamtübersicht

## Strategie: Desktop-Only

Tauri Desktop-App für alle Plattformen.

## Scope

| Phase | Plattform | Architektur | Format |
|-------|-----------|-------------|--------|
| 1 | macOS | ARM64 | .dmg |
| 1 | macOS | AMD64 | .dmg |
| 1 | Linux Desktop | AMD64 | .AppImage |
| 1 | Windows | AMD64 | .msi |
| 2 | Linux Mobile (Librem 5) | ARM64 | TBD |

**Entwicklung:** macOS (Host)

---

## Tauri Desktop

### Konzept

- Native Desktop-App
- NoorSigner für lokales Key-Management
- Secure Storage (Keychain/Credential Manager/Secret Service)
- Native File-Dialoge
- Per-User File Storage

### Build-Prozess

```bash
# Development
npm run tauri:dev

# Production Build (current platform)
npm run tauri build

# Cross-compile (via GitHub Actions)
# Siehe CI/CD Workflow
```

---

## NoorSigner Builds

NoorSigner muss separat für jede Plattform gebaut werden:

```bash
# macOS (aktuell)
cargo build --release

# Windows (TODO)
cross build --release --target x86_64-pc-windows-msvc

# Linux (TODO)
cross build --release --target x86_64-unknown-linux-gnu
```

---

## Librem 5

**Status:** TBD

Optionen:
1. Tauri mit NoorSigner (wenn Secret Service unterstützt)
2. Remote Signer (bunker://) als Fallback

**TODO:** Recherchieren ob Tauri auf Librem 5 läuft

---

## CI/CD

GitHub Actions für automatische Releases:

### NoorNote (Tauri)
- Trigger: Git Tag (v1.0.0)
- Build: macOS, Windows, Linux parallel
- Release: GitHub Releases mit Installers

### NoorSigner
- Trigger: Git Tag (v1.0.0)
- Build: macOS, Windows, Linux parallel
- Release: GitHub Releases mit Binaries

---

## Notizen

- Entwicklung erfolgt auf macOS
- Cross-Platform Testing: Windows Laptop + Ubuntu VM (UTM)
- Unzensierbar: Alles lokal, keine Server-Infrastruktur
