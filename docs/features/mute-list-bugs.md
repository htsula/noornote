# Mute List Bugs - Analyse

## Status (2025-11-24)

### Bug 1: Private Mutes werden nicht in `mutes-private.json` gespeichert - ✅ FIXED

**Problem war:**
- `ListSyncManager.saveToFile()` rief `adapter.getBrowserItems()` auf
- `BaseListStorageAdapter.getBrowserItems()` liest nur `noornote_mutes_browser` (PUBLIC)
- Private Items in `noornote_mutes_private_browser` wurden nie übergeben

**Fix:**
`MuteStorageAdapter.setFileItems()` ignoriert jetzt den `items` Parameter und liest ALLE Browser-Items selbst (public + private).

### Bug 2: Muted Threads werden nicht in Files gespeichert - ✅ KEIN CODE-BUG

**Situation:**
- Thread-Speicherung in `setFileItems()` funktioniert korrekt
- Existierende Threads waren VOR der Architektur-Umstellung direkt in Files
- Nach Umstellung auf Browser-Storage waren diese Files nie in Browser geladen

**Lösung:**
User muss einmal **"Restore from File"** klicken → `getFileItems()` lädt Threads aus Files in Browser (Side-Effect in Zeilen 58-61).

Danach funktioniert alles:
1. Browser zeigt Threads
2. "Save to File" speichert Threads korrekt in Files

## Betroffene Dateien

- `src/services/sync/adapters/MuteStorageAdapter.ts` - Fix angewendet

## Browser Storage Keys (localStorage)

```
noornote_mutes_browser              - Public user mutes
noornote_mutes_private_browser      - Private user mutes
noornote_muted_threads_browser      - Public thread mutes
noornote_muted_threads_private_browser - Private thread mutes
```

## File Storage

```
~/.noornote/mutes-public.json   - {items: string[], eventIds: string[], lastModified: number}
~/.noornote/mutes-private.json  - {items: string[], eventIds: string[], lastModified: number}
```

## Test-Schritte

1. Mute einen User als "Private"
2. Prüfe UI zeigt Private-Badge
3. Klicke "Save to File"
4. Öffne `~/.noornote/mutes-private.json` → User sollte drin sein

Für Threads:
1. Klicke "Restore from File" (einmalig, lädt existierende Threads in Browser)
2. Mute einen Thread
3. Klicke "Save to File"
4. Öffne `~/.noornote/mutes-public.json` → `eventIds` sollte Thread-ID enthalten
