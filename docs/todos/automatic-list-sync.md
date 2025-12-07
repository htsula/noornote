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
- Union/Merge-Strategie (beide Seiten behalten)
- Niemals automatisch löschen
- Prinzip: "Mehr ist besser als weniger"

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

```
┌─────────────────────────────────────────────────────┐
│                  AutoSyncService                     │
├─────────────────────────────────────────────────────┤
│  - isEasyMode(): boolean                            │
│  - setEasyMode(enabled: boolean)                    │
│  - syncOnStartup()                                  │
│  - syncOnChange(listType, items)                    │
├─────────────────────────────────────────────────────┤
│  Uses: RestoreListsService (read/restore)           │
│        ListSyncManager (write to file/relays)       │
└─────────────────────────────────────────────────────┘
```

**Bestehendes nutzen:**
- `RestoreListsService` → Cascading Restore (Browser → File → Relays) ✓
- `ListSyncManager` → Sync-Operationen (syncToRelays, saveToFile) ✓

**Neu zu implementieren:**
- `AutoSyncService` → Koordiniert Easy Mode Logik
- `ListSettingsSection` → Settings UI Komponente
- Event-Listener in Orchestratoren → Bei Änderung AutoSyncService triggern

## Risiken & Mitigations

| Risiko | Mitigation |
|--------|------------|
| Datenverlust | Lokale Datei wird IMMER zuerst geschrieben |
| Race Conditions | Debounced Relay-Sync, lokale Datei ist Fallback |
| Relay nicht erreichbar | Lokale Datei existiert, Relay-Sync wird bei nächster Änderung erneut versucht |
| Performance | Debouncing für Relay-Publishes |

## Implementierungs-Schritte

1. [x] Strategie dokumentieren
2. [ ] `ListSettingsSection` erstellen (Settings UI)
3. [ ] `AutoSyncService` implementieren
4. [ ] Orchestratoren anpassen (Event bei Änderung → AutoSyncService)
5. [ ] Buttons in Listen conditional rendern (Manual vs Easy Mode)
6. [ ] Testen mit Edge Cases

## Priorität

**Mittel** - Verbessert UX signifikant für User, die nicht manuell synchen wollen.
