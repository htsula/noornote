# Platform-Strategie: Desktop-Only (Tauri)

## Übersicht

**Strategie:** Tauri Desktop-App für alle Plattformen

- [Login-Simplification](./login-simplification.md) - Auth-Flows
- [Build-Pipeline](./build-pipeline.md) - Deployment

---

## Ziel-Architektur

| Platform | App-Typ | Key-Management |
|----------|---------|----------------|
| macOS | Tauri-App | NoorSigner |
| Linux | Tauri-App | NoorSigner |
| Windows | Tauri-App | NoorSigner |

### Tauri Desktop App

Native Desktop-App mit NoorSigner:
- Volle Desktop-Integration
- NoorSigner für lokales Key-Management
- Secure Storage (Keychain/Credential Manager/Secret Service)
- Native File-Dialoge
- Per-User File Storage (`~/.noornote/{npub}/`)

---

## Feature-Matrix

| Feature | Tauri |
|---------|-------|
| **Auth** | |
| NoorSigner (Lokaler Key Signer) | ✅ |
| Hardware Remote Signer (bunker://) | ✅ |
| **Storage** | |
| IndexedDB | ✅ |
| localStorage | ✅ |
| Secure Storage (Keychain etc.) | ✅ |
| Per-User File Storage | ✅ |
| Relay-Sync | ✅ |
| **File-Operationen** | |
| Export/Import | ✅ (Native Dialog) |

---

## NoorSigner Cross-Platform

NoorSigner muss für alle Plattformen portiert werden:

| Platform | Secure Storage Backend | Status |
|----------|------------------------|--------|
| macOS | Keychain | ✅ Fertig |
| Windows | Credential Manager | ❌ TODO |
| Linux | Secret Service (D-Bus) | ❌ TODO |

### keyring-rs Crate

Cross-platform Lösung:

```rust
use keyring::Entry;

let entry = Entry::new("noorsigner", &npub)?;
entry.set_password(&encrypted_nsec)?;
let nsec = entry.get_password()?;
```

Siehe [tauri-only-strategy.md](../tauri-only-strategy.md) für Details.

---

## Betroffene Dateien

### PlatformService (zu vereinfachen)

Nach vollständiger Migration kann PlatformService reduziert werden:
- `isBrowser` Checks entfernen
- Browser-Fallbacks entfernen

| Datei | Kontext |
|-------|---------|
| `src/App.ts` | App-Init, Window-Close |
| `src/components/auth/AuthComponent.ts` | Login-Screen |
| `src/services/KeychainStorage.ts` | Secure Storage |
| `src/services/KeySignerClient.ts` | NoorSigner |
| `src/services/AuthService.ts` | Auth-Init |
| `src/services/storage/BaseFileStorage.ts` | File-Storage |

---

## Implementierungs-Plan

### Phase 1: PlatformService ✅
- [x] `src/services/PlatformService.ts` erstellen
- [x] Feature-Flags implementieren

### Phase 2: NoorSigner Ports ❌
- [ ] `keyring-rs` in NoorSigner integrieren
- [ ] Windows Build + Credential Manager testen
- [ ] Linux Build + Secret Service testen

### Phase 3: Browser-Code entfernen ❌
- [ ] NIP-07 Extension Support entfernen
- [ ] Browser File-APIs entfernen (Blob download, FileReader)
- [ ] `PlatformService.isBrowser` Checks entfernen
- [ ] noorserver Repo archivieren

---

## GitHub Repositories

| Repo | Beschreibung |
|------|--------------|
| [77elements/noornote](https://github.com/77elements/noornote) | Hauptprojekt (Vanilla JS + Vite + Tauri) |
| [77elements/noorsigner](https://github.com/77elements/noorsigner) | Lokaler Signer (Rust CLI) |
| ~~[77elements/noorserver](https://github.com/77elements/noorserver)~~ | ~~Rust-Server~~ (wird archiviert) |

---

## Offene Fragen

- [ ] Librem 5: Unterstützt Secret Service?
- [ ] NoorSigner als separates Projekt für andere Nostr-Apps?

---

## Nächste Schritte

1. [ ] NoorSigner Windows-Port (keyring-rs)
2. [ ] NoorSigner Linux-Port (keyring-rs)
3. [ ] GitHub Actions für alle Plattformen
4. [ ] Browser-Code aus NoorNote entfernen
5. [ ] Font-Optimierung (aktuell 53MB Fonts → Subset)
