# Login Simplification

> **Siehe auch:** [Platform-Strategie](./platform-strategy.md) für Gesamtübersicht

## Strategie: Dual-Platform

Login-Optionen für beide Plattformen (Browser + Tauri) parallel entwickelt.

## Login-Optionen nach Plattform

### Browser (Rust-Server)
1. **Browser Extension** - Alby, nos2x, etc. (NIP-07)
2. **Hardware Remote Signer** - bunker:// URI (NIP-46)

### Tauri Desktop
1. **NoorSigner** - Lokaler Key Signer
2. **Hardware Remote Signer** - bunker:// URI (NIP-46)

## Login-Screen UI

### Browser-Modus
```
┌─────────────────────────────────────┐
│       Welcome to NoorNote           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🔐 Login with Extension    │    │  ← Browser Extension (NIP-07)
│  └─────────────────────────────┘    │
│                                     │
│  ─────── or ───────                 │
│                                     │
│  [ bunker://... ]  [Connect]        │  ← Hardware Remote Signer
│                                     │
└─────────────────────────────────────┘
```

### Tauri-Modus
```
┌─────────────────────────────────────┐
│       Welcome to NoorNote           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🔑 Use NoorSigner          │    │  ← Lokaler Key Signer
│  └─────────────────────────────┘    │
│                                     │
│  ─────── or ───────                 │
│                                     │
│  [ bunker://... ]  [Connect]        │  ← Hardware Remote Signer
│                                     │
└─────────────────────────────────────┘
```

## Betroffene Dateien
- `src/components/auth/AuthComponent.ts` - Login UI
- `src/services/AuthService.ts` - Auth-Logik
- `src/services/PlatformService.ts` - Platform-Erkennung

## Implementierung

Siehe [platform-strategy.md](./platform-strategy.md) für Details.
