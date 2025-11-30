# Login Simplification

> **Siehe auch:** [Platform-Strategie](./platform-strategy.md) für Gesamtübersicht

## Strategie: Desktop-Only

Login-Optionen für Tauri Desktop-App.

## Login-Optionen

1. **NoorSigner** - Lokaler Key Signer (primär)
2. **Hardware Remote Signer** - bunker:// URI (NIP-46)

## Login-Screen UI

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
- `src/services/KeySignerClient.ts` - NoorSigner Integration

## TODO: Browser-Code entfernen

Nach NoorSigner Cross-Platform Port:
- [ ] NIP-07 Extension Code entfernen
- [ ] `PlatformService.supportsNip07` entfernen
- [ ] Login UI vereinfachen (keine Platform-Checks mehr)
