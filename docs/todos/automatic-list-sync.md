# Automatische Listen-Synchronisation

## Status: ✅ IMPLEMENTIERT

Feature implementiert am 2024-12-07.

## Übersicht

User kann zwischen zwei Sync-Modi wählen:

**Manual Mode (default):** 4 Buttons in jeder Liste
- Sync from Relays
- Sync to Relays
- Save to File
- Restore from File

**Easy Mode:** 1 Button + automatischer Sync
- Save to File (manuelles Backup)
- Automatisch: Bei Änderung → File speichern → Relays publishen (debounced)

## Speicher-Hierarchie

```
Lokale Datei = "Last Resort" Backup (höchste Priorität bei Restore)
Browser/localStorage = Working State
Relays = Remote Sync Target
```

## Sync-Strategie: Easy Mode

**Bei App-Start (Browser leer):**
1. Restore von lokaler Datei versuchen
2. Falls keine Datei → Sync from Relays
   - Toast: "App cache empty. No local backup found. Synced X items from Relays"
3. Nach Relay-Sync → Sofort lokale Datei schreiben (erstes Backup erstellen)

**Bei User-Änderung (Follow/Unfollow, Bookmark, Mute etc.):**
1. Browser/localStorage update (sofort, durch Orchestrator)
2. Lokale Datei speichern (sofort) → Backup IMMER zuerst!
3. Publish to Relays (debounced, 2.5 Sekunden)

**Konflikt-Auflösung:**
- Bei Sync from Relays: Existierendes `SyncConfirmationModal` nutzen
- Wenn `removed.length > 0`: Modal zeigt Diff und fragt User
- Wenn `removed.length === 0`: Automatisch mergen ohne Nachfrage
- **Prinzip:** Nie automatisch löschen, immer User fragen

## Implementierte Komponenten

| Komponente | Pfad | Funktion |
|------------|------|----------|
| `ListSyncButtonsHelper` | `src/helpers/ListSyncButtonsHelper.ts` | Mode-Switch + Button-Rendering |
| `AutoSyncService` | `src/services/sync/AutoSyncService.ts` | Easy Mode Koordination |
| `ListSettingsSection` | `src/components/settings/ListSettingsSection.ts` | Settings UI |

## Architektur

```
┌─────────────────────────────────────────────────────┐
│                  AutoSyncService                     │
├─────────────────────────────────────────────────────┤
│  - isEasyMode(): boolean (via Helper)               │
│  - syncOnStartup(listType)                          │
│  - syncOnChange(listType) via EventBus              │
│  - debouncedRelaySync (2.5 sec)                     │
├─────────────────────────────────────────────────────┤
│  Uses: ListSyncManager (via Adapters)               │
│        ToastService (Status-Meldungen)              │
│        RestoreListsService (Startup Restore)        │
└─────────────────────────────────────────────────────┘
```

### Event-Flow in Easy Mode

```
User macht Änderung (z.B. Follow)
        │
        ▼
Orchestrator.addItem() → Browser-Storage update
        │
        ▼
EventBus.emit('follow:updated' / 'bookmark:updated' / 'mute:updated')
        │
        ▼
AutoSyncService.handleListChange(listType)
        │
        ├──► 1. saveToFile() (sofort)
        │
        └──► 2. syncToRelays() (debounced, 2.5 sec)
```

## Settings UI

Settings → List Settings:

```
List Settings
─────────────────────────────────────────

Synchronisation Mode

○ Manual Mode (default)
  Manage sync manually with action buttons in each list

● Easy Mode
  NoorNote syncs automatically:
  - Changes saved to local backup immediately
  - Then published to relays
  - On startup: restore from backup or relays
```

## Dateien

- `src/helpers/ListSyncButtonsHelper.ts` - Mode-Speicherung + Button-Rendering
- `src/services/sync/AutoSyncService.ts` - Easy Mode Logik
- `src/components/settings/ListSettingsSection.ts` - Settings UI
- `src/styles/components/_settings-view.scss` - CSS für Mode-Selector

## Verwendung

```typescript
// Mode abfragen
import { isEasyMode, getListSyncMode } from './helpers/ListSyncButtonsHelper';

if (isEasyMode()) {
  // Auto-sync aktiv
}

// Mode setzen
import { setListSyncMode } from './helpers/ListSyncButtonsHelper';
setListSyncMode('easy'); // oder 'manual'
```

## Nächste Schritte (Optional)

- [ ] Sync-Status-Indicator in der UI (zeigt laufenden Sync an)
- [ ] Fehler-Retry bei fehlgeschlagenem Relay-Sync
- [ ] Sync-History/Log für Debugging
