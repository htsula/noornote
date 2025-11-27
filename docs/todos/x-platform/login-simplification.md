# Login Simplification

> **Siehe auch:** [Platform-Strategie](./platform-strategy.md) für Gesamtübersicht

## Strategie: Browser-First

Login-Optionen für Browser-Version (alle Plattformen).
Tauri-spezifische Optionen (NoorSigner) optional/später.

## Aktuelle Login-Optionen
- NoorSigner (KeySigner) - Tauri only
- Remote Signer (NIP-46 bunker://)
- Browser Extension (NIP-07)
- Direct nsec
- npub (read-only)
- Neuen Keypair anlegen

## Neue Login-Optionen

### Browser (alle Plattformen)
1. **NIP-07 Extension** - Alby, nos2x, etc. (prominent)
2. **Remote Signer** - bunker:// URI
3. **npub** - Read-only Modus

### Tauri (optional/später)
1. **NoorSigner** - Lokaler Signer (prominent)
2. **Remote Signer** - bunker:// URI
3. **npub** - Read-only Modus

> **Hinweis:** Direct nsec bleibt vorerst als Fallback, wird aber nicht prominent angezeigt.

## Login-Screen UI

### Browser-Modus
```
┌─────────────────────────────────────┐
│       Welcome to NoorNote           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🔐 Login with Extension    │    │  ← NIP-07 prominent
│  └─────────────────────────────┘    │
│                                     │
│  ─────── or ───────                 │
│                                     │
│  [ bunker://... ]  [Connect]        │  ← Remote Signer
│                                     │
│  [ npub1... ]      [View Only]      │  ← Read-only
│                                     │
└─────────────────────────────────────┘
```

### Tauri-Modus (später)
```
┌─────────────────────────────────────┐
│       Welcome to NoorNote           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🔑 Use NoorSigner          │    │  ← NoorSigner prominent
│  └─────────────────────────────┘    │
│                                     │
│  ─────── or ───────                 │
│                                     │
│  [ bunker://... ]  [Connect]        │
│  [ npub1... ]      [View Only]      │
│                                     │
└─────────────────────────────────────┘
```

## Betroffene Dateien
- `src/components/auth/AuthComponent.ts` - Login UI
- `src/services/AuthService.ts` - Auth-Logik
- `src/services/PlatformService.ts` - Platform-Erkennung

## Implementierung

Siehe [platform-strategy.md](./platform-strategy.md) für Details.
