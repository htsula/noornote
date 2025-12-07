# Automatische Listen-Synchronisation

## Übersicht

Derzeit verwaltet der User die 3 Speicherstellen (Festplatte, localStorage, Relays) manuell über Action Buttons:
- "Sync from Relays"
- "Sync to Relays"
- "Save to File"
- "Restore from File"

**Ziel:** Ein Switch in den Settings ("List Settings"), der zwischen Manual Mode und Easy Mode umschaltet.

## Entscheidungen ✓

### Speicher-Hierarchie

```
Lokale Datei = "Last Resort" Backup (höchste Priorität bei Restore)
Browser/localStorage = Working State
Relays = Remote Sync Target
```

### Sync-Strategie: Easy Mode

**Bei App-Start (Browser leer):**
1. Restore von lokaler Datei versuchen
2. Falls keine Datei → Sync from Relays
   - Toast: "App cache empty. No local backup found. Syncing from Relays"
3. Nach Relay-Sync → Sofort lokale Datei schreiben (erstes Backup erstellen)

**Bei User-Änderung (Follow/Unfollow, Bookmark, Mute etc.):**
1. Browser/localStorage update (sofort)
2. Lokale Datei speichern (sofort) → Backup IMMER zuerst!
3. Publish to Relays (debounced, ~2-3 Sekunden)

**Konflikt-Auflösung:**
- Bei Sync from Relays: Existierendes `SyncConfirmationModal` nutzen
- Wenn `removed.length > 0` (Browser hat Items die Relay nicht hat):
  - Modal zeigt Diff und fragt User
  - User entscheidet: "Keep and only add" (Merge) ODER "Delete and add" (Overwrite)
- Wenn `removed.length === 0` (nur neue Items von Relay):
  - Automatisch mergen ohne Nachfrage
- **Prinzip:** Nie automatisch löschen, immer User fragen

### UI in Listen

**Manual Mode:** 4 Buttons sichtbar
- Sync from Relays
- Sync to Relays
- Save to File
- Restore from File

**Easy Mode:** 1 Button sichtbar
- Save to File (manuelles Backup, falls User explizit sichern will)

## Settings UI

Neue Sektion "List Settings" in SettingsView:

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

## Architektur

### Bestehende Komponenten (wiederverwenden)

| Komponente | Pfad | Funktion |
|------------|------|----------|
| `ListSyncManager<T>` | `src/services/sync/ListSyncManager.ts` | 4-Button-Operationen |
| `RestoreListsService` | `src/services/RestoreListsService.ts` | Cascading Restore |
| `SyncConfirmationModal` | `src/components/modals/SyncConfirmationModal.ts` | Konflikt-Dialog |
| `BaseListSecondaryManager` | `src/components/layout/managers/BaseListSecondaryManager.ts` | Buttons + Binding |

### Neue Komponenten

```
┌─────────────────────────────────────────────────────┐
│                  AutoSyncService                     │
├─────────────────────────────────────────────────────┤
│  - isEasyMode(): boolean                            │
│  - setEasyMode(enabled: boolean)                    │
│  - syncOnStartup(listType)                          │
│  - syncOnChange(listType)                           │
│  - debouncedRelaySync (2-3 sec)                     │
├─────────────────────────────────────────────────────┤
│  Uses: ListSyncManager (via Adapters)               │
│        ToastService (Status-Meldungen)              │
│        SyncConfirmationModal (Konflikte)            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│               ListSettingsSection                    │
├─────────────────────────────────────────────────────┤
│  extends SettingsSection                            │
│  - Mode-Switch (Manual/Easy)                        │
│  - Persists to localStorage                         │
└─────────────────────────────────────────────────────┘
```

### Button-Rendering (Code-Extraktion)

`renderControlButtons()` existiert in 2 Stellen:
1. `BaseListSecondaryManager.ts:289-308`
2. `BookmarkSecondaryManager.ts:276-295`

**Lösung:** Gemeinsame Helper-Funktion extrahieren:

```typescript
// src/helpers/ListSyncButtonsHelper.ts
export function renderListSyncButtons(mode: 'manual' | 'easy'): string {
  if (mode === 'easy') {
    return `
      <div class="list-sync-controls list-sync-controls--easy">
        <button class="btn btn--mini btn--passive save-to-file-btn">
          Save to File
        </button>
      </div>
    `;
  }

  return `
    <div class="list-sync-controls">
      <button class="btn btn--mini btn--passive sync-from-relays-btn">...</button>
      <button class="btn btn--mini btn--passive sync-to-relays-btn">...</button>
      <button class="btn btn--mini btn--passive save-to-file-btn">...</button>
      <button class="btn btn--mini btn--passive restore-from-file-btn">...</button>
    </div>
    <p class="list-sync-info">...</p>
  `;
}
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
AutoSyncService.syncOnChange(listType)
        │
        ├──► 1. saveToFile() (sofort, synchron)
        │
        └──► 2. syncToRelays() (debounced, 2-3 sec)
```

## Risiken & Mitigations

| Risiko | Mitigation |
|--------|------------|
| Datenverlust | Lokale Datei wird IMMER zuerst geschrieben, vor Relay-Sync |
| Race Conditions | Debounced Relay-Sync, lokale Datei ist Fallback |
| Relay nicht erreichbar | Lokale Datei existiert, Relay-Sync wird bei nächster Änderung erneut versucht |
| Performance | Debouncing für Relay-Publishes |
| Konflikt bei Startup | SyncConfirmationModal fragt User wenn nötig |

## Implementierungs-Schritte

1. [x] Strategie dokumentieren
2. [x] Bestehenden Code analysieren
3. [ ] `ListSyncButtonsHelper` extrahieren (aus BaseListSecondaryManager)
4. [ ] `AutoSyncService` erstellen
5. [ ] `ListSettingsSection` erstellen (Settings UI)
6. [ ] `SettingsView` erweitern (ListSettingsSection einbinden)
7. [ ] Managers anpassen (Helper nutzen, Mode-abhängig rendern)
8. [ ] EventBus-Listener in AutoSyncService für list-Events
9. [ ] Testen mit Edge Cases

## Priorität

**Mittel** - Verbessert UX signifikant für User, die nicht manuell synchen wollen.
