# NIP-51 Bookmark Sets (Kategorien auf Relays)

## Status: ERLEDIGT (Code Review Todos unten)

## Übersicht

Bookmarks werden als kind:30003 (Bookmark Sets) gespeichert - der aktuelle NIP-51 Standard.

- Jede Kategorie = ein kind:30003 Event
- Root-Bookmarks: `d: ""`
- Named Kategorien: `d: "Kategorie-Name"` + `title: "Kategorie-Name"`
- Private Bookmarks encrypted in content (NIP-44)

---

## WICHTIG: Zentrale Listen-Infrastruktur

Bookmarks, Follows, Mutes sind ALLE Listen. Es gibt eine generische Infrastruktur:

### Zentrale Dateien (für ALLE Listen):
```
src/services/orchestration/GenericListOrchestrator.ts  - Basis-Orchestrator
src/services/sync/ListSyncManager.ts                   - Sync-Logik
src/services/sync/adapters/BaseListStorageAdapter.ts   - Basis-Adapter
src/services/storage/BaseFileStorage.ts                - Basis-Dateispeicherung
```

### Entity-spezifische Dateien (nur Unterschiede):
```
src/services/orchestration/configs/BookmarkListConfig.ts
src/services/sync/adapters/BookmarkStorageAdapter.ts
src/services/storage/BookmarkFileStorage.ts
```

### Regel:
Änderungen für kind:30003 mit d-tag + title-tag gehören in die **Config** und den **Adapter**, NICHT in einen komplett neuen Orchestrator!

### Neuer zentraler Serializer:
```
src/services/storage/ListSerializer.ts  - EIN Serializer für ALLE Listen
```

- Wird von Bookmarks, Follows, Mutes importiert
- Verwendet bei "Save to file" und "Sync to relays"
- Konvertiert zwischen localStorage-Format ↔ File-JSON ↔ Relay-Events
- KEIN BookmarkSetSerializer, MuteSerializer, etc. - nur EINER für alle!

---

## Architektur

```
BookmarkSecondaryManager (UI)
         ↓
BookmarkStorageAdapter ←→ localStorage
         ↓
BookmarkFileStorage ←→ ~/.noornote/{npub}/bookmarks.json
         ↓
BookmarkOrchestrator ←→ Relays (kind:30003)
```

### Frage zu klären:
- Was macht BookmarkFolderService? Brauchen wir den noch oder kann der weg?

---

## EIN Format überall

localStorage = File = Relay (strukturell identisch)

```json
{
  "version": 2,
  "sets": [
    {
      "kind": 30003,
      "d": "Kategorie-Name",
      "title": "Kategorie-Name",
      "publicTags": [
        { "type": "e", "value": "note-id-1" },
        { "type": "e", "value": "note-id-2" }
      ],
      "privateTags": [
        { "type": "e", "value": "private-note-id" }
      ]
    }
  ],
  "metadata": {
    "setOrder": ["Kategorie-Name", ""],
    "lastModified": 1733300000
  }
}
```

---

## Datenfluss

| Aktion | Flow |
|--------|------|
| User bookmarkt Note | → localStorage aktualisieren |
| "Save to file" | localStorage → File (gleiche JSON) |
| "Sync to relays" | File → kind:30003 Events publishen |
| "Restore from file" | File → localStorage |
| "Sync from relays" | kind:30003 Events → localStorage |

---

## NIP-51 Spezifikation

| Kind | Beschreibung | Status |
|------|--------------|--------|
| 10003 | Bookmark list (global, unkategorisiert) | Legacy |
| 30001 | Categorized Bookmark list | **DEPRECATED** |
| 30003 | Bookmark Sets | **AKTUELL** ✅ |

### Event-Struktur kind:30003

```json
{
  "kind": 30003,
  "tags": [
    ["d", "Kategorie-Name"],
    ["title", "Kategorie-Name"],
    ["e", "note-id-1"],
    ["e", "note-id-2"],
    ["a", "30023:pubkey:article-id"]
  ],
  "content": "encrypted-private-bookmarks-json"
}
```

### Tag-Erklärung (NIP-51)

| Tag | Zweck | Required |
|-----|-------|----------|
| `d` | Programmatischer Identifier (unique pro Set) | ✅ Ja |
| `title` | Display-Name für UI | Optional (wir setzen es = d) |
| `e` | Event-Referenz (Note) | - |
| `a` | Addressable Event (Article, etc.) | - |

---

## Implementierungsplan

### Phase 1: Analyse (VOR dem Coden!)
1. ALLE betroffenen Dateien lesen und verstehen
2. Verstehen wie GenericListOrchestrator funktioniert
3. Verstehen wie die anderen Listen (Follows, Mutes) implementiert sind
4. Architektur-Entscheidung: BookmarkFolderService behalten oder entfernen?

### Phase 2: Config anpassen
1. `BookmarkListConfig.ts` für kind:30003 mit d-tag + title-tag anpassen
2. Testen ob bestehende Infrastruktur damit funktioniert

### Phase 3: Adapter anpassen
1. `BookmarkStorageAdapter.ts` für neues Format anpassen
2. localStorage-Key beibehalten (nicht ändern!)
3. Format-Konvertierung nur wo nötig

### Phase 4: Testen
1. Nach JEDER Änderung testen
2. Bookmark hinzufügen → prüfen ob in localStorage korrekt
3. Save to file → prüfen ob JSON korrekt
4. Sync to relays → prüfen ob Events korrekt

---

## Entscheidungen

1. **Nur kind:30003** - Keine Rückwärtskompatibilität zu kind:10003
2. **Folder = Category** - UI zeigt Folders, Relays speichern Categories
3. **Folder-Order nur lokal** - Relays kennen keine Reihenfolge
4. **title = d** - Beide Tags mit gleichem Wert für maximale Kompatibilität
5. **Generische Infrastruktur nutzen** - Nicht eigenen Code schreiben!

---

## UI-Mapping

- **Relay:** Kategorien (kind:30003 mit `d`-Tag)
- **UI:** Folders (visuelle Darstellung)

## Betroffene Dateien

### Zentrale Listen-Infrastruktur
- `src/services/orchestration/GenericListOrchestrator.ts`
- `src/services/sync/ListSyncManager.ts`
- `src/services/sync/adapters/BaseListStorageAdapter.ts`
- `src/services/storage/BaseFileStorage.ts`

### Bookmark-spezifisch
- `src/services/orchestration/BookmarkOrchestrator.ts`
- `src/services/orchestration/configs/BookmarkListConfig.ts`
- `src/services/sync/adapters/BookmarkStorageAdapter.ts`
- `src/services/storage/BookmarkFileStorage.ts`
- `src/services/BookmarkFolderService.ts` (zu klären: behalten oder entfernen?)

### UI
- `src/components/layout/managers/BookmarkSecondaryManager.ts`

### Tools
- `tools/relay-inspector.html` - Bookmark Sets preset (kind:30003)

---

## Code Review Todos (2025-12-05)

### 🔴 Bug (MUSS gefixt werden)

**BookmarkOrchestrator.ts:647** - Referenz auf undefinierte Variable `categories`:
```typescript
`Sync complete: ${added} new items, ${categories.length} categories`
```
`categories` existiert nicht in diesem Scope. Sollte `categoriesWithItems.size` oder `fetchResult.categories?.length || 0` sein.

---

### 🟡 Code-Leichen (können entfernt werden)

| Datei | Zeile | Problem |
|-------|-------|---------|
| `BookmarkSecondaryManager.ts` | 48, 69 | `userProfileService` importiert/instanziiert aber nie verwendet |
| `BookmarkSecondaryManager.ts` | 1035 | `dropdownMenu` Variable deklariert aber nie verwendet |
| `BookmarkStorageAdapter.ts` | 100-125 | 3 unbenutzte private Methoden: `getFoldersFromLocalStorage`, `getAssignmentsFromLocalStorage`, `getRootOrderFromLocalStorage` |

---

### 🟡 Memory Leak

**BookmarkSecondaryManager.ts:1048** - Event Listener wird nie entfernt:
```typescript
document.addEventListener('click', closeDropdown);
```
Bei jedem `renderCurrentView` wird ein neuer globaler Click-Listener hinzugefügt. Sollte im `destroy()` oder beim Re-Render bereinigt werden.

---

### 🟡 console.error → SystemLogger

Mehrere Stellen verwenden `console.error` statt `SystemLogger`. Inkonsistent:

- `BookmarkOrchestrator.ts:79`
- `BookmarkStorageAdapter.ts:60, 74, 96, 141, 161`
- `BookmarkFileStorage.ts:229, 234`
- `BookmarkSerializer.ts:203`
- `ListSyncManager.ts:181, 185`

---

### 🟢 Code-Duplikation (optional, Wartbarkeit)

`BookmarkSecondaryManager.ts` - Ähnliche Folder-Assignment-Logik in:
- `handleSyncFromRelays` (Zeilen 1076-1111)
- `handleRestoreFromFile` (Zeilen 1186-1215)

Könnte in eine gemeinsame Hilfsmethode extrahiert werden.

---

### 🟢 Veraltete Kommentare

**BookmarkStorageAdapter.ts:8-9** - Erwähnt falsche Dateien:
```
* - File: ~/.noornote/bookmarks-public.json + bookmarks-private.json
```
Sollte `bookmarks.json` sein.
