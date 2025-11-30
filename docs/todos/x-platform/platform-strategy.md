# Platform-Strategie: Dual-Platform

## Übersicht

**Strategie:** Browser + Tauri parallel entwickelt

- [Login-Simplification](./login-simplification.md) - Auth-Flows
- [Build-Pipeline](./build-pipeline.md) - Deployment

---

## Ziel-Architektur

| Platform | App-Typ | Key-Management |
|----------|---------|----------------|
| macOS | Rust-Server + Browser | NIP-07 Extension |
| macOS | Tauri-App | NoorSigner |
| Linux | Rust-Server + Browser | NIP-07 Extension |
| Linux | Tauri-App | NoorSigner |
| Windows | Rust-Server + Browser | NIP-07 Extension |
| Windows | Tauri-App | NoorSigner |

### Rust-Server Konzept

Minimale Binary (~60MB inkl. Assets) für alle Plattformen:
- Eingebetteter Web-Server (axum)
- Bündelt Web-Assets (`npm run build` → `dist/`)
- Öffnet Default-Browser auf `localhost:PORT`
- Unzensierbar (keine Server-Infrastruktur, alles lokal)

### Tauri Desktop App

Native Desktop-App mit NoorSigner:
- Volle Desktop-Integration
- NoorSigner für lokales Key-Management
- Keychain-Integration für sichere Speicherung
- Native File-Dialoge

---

## Feature-Matrix

| Feature | Browser | Tauri |
|---------|---------|-------|
| **Auth** | | |
| Browser Extension (NIP-07) | ✅ | ❌ |
| NoorSigner (Lokaler Key Signer) | ❌ | ✅ |
| Hardware Remote Signer (bunker://) | ✅ | ✅ |
| **Storage** | | |
| IndexedDB | ✅ | ✅ |
| localStorage | ✅ | ✅ |
| Keychain | ❌ | ✅ |
| Relay-Sync | ✅ | ✅ |
| **File-Operationen** | | |
| Export (Download) | ✅ (Blob + anchor) | ✅ (Native Dialog) |
| Import (File Input) | ✅ (FileReader API) | ✅ (Native Dialog) |

---

## PlatformService

Zentrale Platform-Erkennung für beide Modi.

### Interface

```typescript
// src/services/PlatformService.ts

export type PlatformType = 'tauri' | 'browser';

export class PlatformService {
  private static instance: PlatformService;

  // Platform-Erkennung
  readonly platformType: PlatformType;
  readonly isTauri: boolean;
  readonly isBrowser: boolean;

  // Feature-Flags
  readonly supportsNoorSigner: boolean;       // Tauri only
  readonly supportsNip07: boolean;            // Browser (+ Tauri mit Extension)
  readonly supportsKeychain: boolean;         // Tauri only
  readonly supportsNativeFileDialog: boolean; // Tauri only

  static getInstance(): PlatformService;
}
```

### Verwendung

```typescript
import { PlatformService } from '../services/PlatformService';

const platform = PlatformService.getInstance();

if (platform.supportsNip07) {
  // NIP-07 Extension Login anzeigen
}

if (platform.supportsNoorSigner) {
  // NoorSigner Login anzeigen (nur Tauri)
}
```

---

## Betroffene Dateien

### Zu ersetzen: `__TAURI_INTERNALS__` Checks (20 Stellen)

| Datei | Zeilen | Kontext |
|-------|--------|---------|
| `src/App.ts` | 398, 466 | App-Init, Window-Close |
| `src/components/auth/AuthComponent.ts` | 86 | Login-Screen |
| `src/components/ui/ImageViewer.ts` | 24 | Image-Handling |
| `src/components/views/SettingsView.ts` | 42 | Settings UI |
| `src/services/KeychainStorage.ts` | 22 | Keychain-Verfügbarkeit |
| `src/services/KeySignerClient.ts` | 85, 198, 232, 267, 302, 394, 424, 443 | NoorSigner |
| `src/services/managers/KeySignerConnectionManager.ts` | 39, 62, 102 | Connection |
| `src/services/AuthService.ts` | 120 | Auth-Init |
| `src/services/storage/BaseFileStorage.ts` | 29 | File-Storage |

---

## Implementierungs-Plan

### Phase 1: PlatformService ✅
- [x] `src/services/PlatformService.ts` erstellen
- [x] Feature-Flags implementieren

### Phase 2: Checks ersetzen ✅
- [x] Alle 21 `__TAURI_INTERNALS__` Stellen umstellen
- [x] Build erfolgreich

### Phase 3: Login-View ✅
- [x] Browser: NIP-07 Extension prominent
- [x] Tauri: NoorSigner prominent
- [x] Beide: bunker://, npub (separate Felder)

### Phase 4: Storage ✅
- [x] KeychainStorage: Fallback auf IndexedDB (für nsec, NWC)
- [x] File-Export: Browser-API (Blob + Download)
- [x] File-Import: Browser-API (FileReader + File Input Dialog)

### Phase 5: Rust-Server ✅
- [x] Rust-Projekt erstellen (noorserver)
- [x] axum HTTP-Server + rust-embed für Assets
- [x] CLI-Optionen: `--port`, `--no-browser`
- [x] SPA-Fallback (unbekannte Routes → index.html)
- [x] GitHub Actions CI/CD für alle Plattformen
- [x] Automatische Releases bei Tag (`v*`)

---

## GitHub Repositories

| Repo | Beschreibung |
|------|--------------|
| [77elements/noornote](https://github.com/77elements/noornote) | Hauptprojekt (Vanilla JS + Vite) |
| [77elements/noorsigner](https://github.com/77elements/noorsigner) | Lokaler Signer (Tauri) |
| [77elements/noorserver](https://github.com/77elements/noorserver) | Rust-Server für Browser-Distribution |

---

## Noorserver Details

### Binaries (v0.1.2)

| Binary | Plattform | Größe |
|--------|-----------|-------|
| `noorserver-linux-x64` | Linux x64 | 60.4 MB |
| `noorserver-macos-arm64` | macOS ARM (M1/M2) | 60.6 MB |
| `noorserver-macos-x64` | macOS Intel | 60.2 MB |
| `noorserver-windows-x64.exe` | Windows x64 | 60.4 MB |

### Nutzung

```bash
# Standard (Port 3000, öffnet Browser)
./noorserver

# Custom Port
./noorserver --port 8080

# Ohne Browser öffnen
./noorserver --no-browser

# Hilfe
./noorserver --help
```

### CI/CD Workflow

Bei jedem Git-Tag (`v*`) wird automatisch:
1. noornote geklont und gebaut (`npm ci && npm run build`)
2. `dist/` in noorserver kopiert
3. Rust-Binary für alle 4 Plattformen kompiliert
4. GitHub Release mit allen Binaries erstellt

---

## Offene Fragen

- [ ] Librem 5: Gibt es Browser-Extensions? Falls nein → nur Tauri
- [ ] NoorSigner als separates Projekt für andere Nostr-Apps?

---

## Nächste Schritte

- [ ] Alle Plattformen durchtesten (Linux, Windows, macOS)
- [ ] Font-Optimierung (aktuell 53MB Fonts → Subset)
- [ ] README für noorserver Repo
