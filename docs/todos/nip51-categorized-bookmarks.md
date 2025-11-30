# NIP-51 Kategorisierte Bookmarks (Folders auf Relays)

## Übersicht

Aktuell werden Bookmarks als kind:10003 gespeichert - eine flache, unkategorisierte Liste. Folders existieren nur lokal (localStorage + Datei). Beim Sync mit Relays gehen Folders verloren.

**Ziel:** Folders über Relays synchronisieren mittels kind:30001 (Categorized Bookmark Lists).

## NIP-51 Spezifikation

Laut [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md):

| Kind | Beschreibung | d-Tag |
|------|--------------|-------|
| 10003 | Bookmark list | - (global, unkategorisiert) |
| 30001 | Categorized Bookmark list | Folder-Name |

### Event-Struktur kind:30001

```json
{
  "kind": 30001,
  "tags": [
    ["d", "Folder Name"],
    ["e", "note-id-1"],
    ["e", "note-id-2"],
    ["a", "30023:pubkey:article-id"]
  ],
  "content": "encrypted-private-bookmarks-json"
}
```

- `d` Tag = Folder-Name (Unique Identifier)
- Public bookmarks in tags
- Private bookmarks encrypted in content (wie bei 10003)

## Aktueller Stand

### Was funktioniert
- Folders lokal erstellen, umbenennen, löschen
- Bookmarks in Folders verschieben
- Drag & Drop Reordering
- Speichern in lokaler Datei (`~/.noornote/bookmarks-*.json`)
- Folder-Daten in localStorage (`noornote_bookmark_folders`, etc.)

### Was fehlt
- kind:30001 Events für Folders publishen
- kind:30001 Events von Relays fetchen
- Mapping zwischen lokalen Folders und Relay-Events
- Merge-Logik für Folder-Konflikte

## Architektur-Entscheidung

### Option A: Nur kind:30001 (ein Event pro Folder)
- Root-Bookmarks → kind:30001 mit `d: ""`
- Folder-Bookmarks → kind:30001 mit `d: "Folder Name"`
- **Nachteil:** Breaking change für kind:10003 Kompatibilität

### Option B: Hybrid (kind:10003 + kind:30001) ✓ EMPFOHLEN
- Root-Bookmarks → kind:10003 (kompatibel mit anderen Clients)
- Folder-Bookmarks → kind:30001 pro Folder
- **Vorteil:** Rückwärtskompatibel, andere Clients sehen Root-Bookmarks

## Datenfluss

### Publish to Relays
```
Local State                    Relay Events
─────────────────────────────────────────────
Root Bookmarks      →          kind:10003 (public tags + encrypted content)
Folder "Work"       →          kind:30001 d:"Work" (public tags + encrypted content)
Folder "Personal"   →          kind:30001 d:"Personal" (public tags + encrypted content)
```

### Fetch from Relays
```
Relay Events                   Local State
─────────────────────────────────────────────
kind:10003          →          Root Bookmarks (kein Folder)
kind:30001 d:"Work" →          Folder "Work" erstellen/updaten
kind:30001 d:"XYZ"  →          Folder "XYZ" erstellen/updaten
```

## Implementation Phasen

### Phase 1: Research & Vorbereitung
- [ ] Prüfen wie andere Clients kind:30001 nutzen (Amethyst, Damus, etc.)
- [ ] BookmarkItem Interface erweitern für Folder-Referenz
- [ ] Test-Events auf Relays analysieren

### Phase 2: Publish Folders
- [ ] `BookmarkOrchestrator.publishToRelays()` erweitern
- [ ] Für jeden Folder ein kind:30001 Event erstellen
- [ ] `d` Tag = Folder-Name
- [ ] Public/Private Split wie bei kind:10003
- [ ] Root-Bookmarks weiterhin als kind:10003

### Phase 3: Fetch Folders
- [ ] `BookmarkOrchestrator.fetchFromRelays()` erweitern
- [ ] kind:30001 Events fetchen (zusätzlich zu 10003)
- [ ] Folders aus `d` Tags extrahieren
- [ ] Bookmarks den Folders zuweisen
- [ ] Lokale Folder-Struktur updaten

### Phase 4: Merge & Sync
- [ ] Konflikt-Handling: Folder auf Relay vs. lokal
- [ ] Folder umbenennen → altes Event löschen (NIP-09), neues publishen
- [ ] Folder löschen → Event löschen oder leeren
- [ ] Sync-Button Verhalten anpassen

### Phase 5: UI Updates
- [ ] Loading-State für Folder-Sync
- [ ] Feedback bei Folder-Konflikten
- [ ] "Sync to Relays" zeigt Folder-Status

## Betroffene Dateien

### Services
- `src/services/orchestration/BookmarkOrchestrator.ts` - Hauptlogik
- `src/services/orchestration/configs/BookmarkListConfig.ts` - Event-Struktur
- `src/services/sync/adapters/BookmarkStorageAdapter.ts` - Sync-Adapter
- `src/services/BookmarkFolderService.ts` - Folder-Management
- `src/services/storage/BookmarkFileStorage.ts` - Datei-Struktur

### Components
- `src/components/layout/managers/BookmarkSecondaryManager.ts` - UI

### Types
- `src/services/storage/BookmarkFileStorage.ts` - BookmarkItem Interface

## Offene Fragen

1. **Folder-Order:** Wie speichern wir die Reihenfolge der Folders auf Relays?
   - Option: Separates kind:30001 Event mit `d: "__folder_order__"`
   - Option: In jedem Folder-Event ein `order` Tag

2. **Nested Folders:** Unterstützen wir verschachtelte Folders?
   - Erstmal: Nein (flache Struktur)
   - Später: `d: "Parent/Child"` Konvention

3. **Folder Metadata:** Name, Icon, Color?
   - Erstmal: Nur Name (aus `d` Tag)
   - Später: Zusätzliche Tags (`title`, `image`)

## Priorität

**Mittel** - Folders funktionieren lokal. Relay-Sync ist "nice to have" für Multi-Device.

## Abhängigkeiten

- NIP-51 Spezifikation (stabil)
- NIP-44 Encryption (bereits implementiert)
- GenericListOrchestrator (bereits implementiert)

## Nächste Schritte

1. [ ] Research: Andere Clients analysieren
2. [ ] Entscheidung: Option B (Hybrid) bestätigen
3. [ ] Phase 1 starten
