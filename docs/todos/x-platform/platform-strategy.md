# Platform-Strategie: Browser-First

## Übersicht

**Strategie:** Browser-first, Tauri optional/später

- [Login-Simplification](./login-simplification.md) - Auth-Flows
- [Build-Pipeline](./build-pipeline.md) - Deployment

---

## Ziel-Architektur

| Platform | App-Typ | Key-Management |
|----------|---------|----------------|
| macOS | Rust-Server + Browser | NIP-07 Extension |
| Linux | Rust-Server + Browser | NIP-07 Extension |
| Windows | Rust-Server + Browser | NIP-07 Extension |
| (Später: Tauri) | Tauri-App | NoorSigner |

### Rust-Server Konzept

Minimale Binary (~10MB) für alle Plattformen:
- Eingebetteter Web-Server (axum/warp)
- Bündelt Web-Assets (`npm run build` → `dist/`)
- Öffnet Default-Browser auf `localhost:PORT`
- Unzensierbar (keine Server-Infrastruktur, alles lokal)

### Tauri (Optional/Später)

NoorSigner-Code bleibt erhalten, aber pausiert:
- Reaktivieren wenn User "ohne Extension" wollen
- Reaktivieren für Librem 5 falls keine Extensions verfügbar
- Eventuell als separates Projekt für alle Nostr-Apps

---

## Feature-Matrix

| Feature | Browser | Tauri (optional) |
|---------|---------|------------------|
| **Auth** | | |
| NIP-07 Extension | ✅ | ❌ |
| NoorSigner | ❌ | ✅ |
| Remote Signer (bunker://) | ✅ | ✅ |
| npub (read-only) | ✅ | ✅ |
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

Zentrale Platform-Erkennung - relevant für Tauri-Option.

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

### Phase 5: Rust-Server (separates Projekt)
- [ ] Rust-Projekt erstellen
- [ ] Web-Assets einbetten (rust-embed)
- [ ] Cross-compile für alle Plattformen

---

## Offene Fragen

- [ ] Librem 5: Gibt es Browser-Extensions? Falls nein → Tauri reaktivieren
- [ ] NoorSigner als separates Projekt für andere Nostr-Apps?
