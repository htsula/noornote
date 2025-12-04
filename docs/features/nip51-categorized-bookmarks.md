# NIP-51 Bookmark Sets (Kategorien auf Relays) ✅

## Status: ABGESCHLOSSEN (2025-12-04)

## Übersicht

Bookmarks werden als kind:30003 (Bookmark Sets) gespeichert - der aktuelle NIP-51 Standard.

- Jede Kategorie = ein kind:30003 Event
- Root-Bookmarks: `d: ""`
- Named Kategorien: `d: "Kategorie-Name"` + `title: "Kategorie-Name"`
- Private Bookmarks encrypted in content (NIP-44)

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
| `title` | Display-Name für UI | Optional |
| `e` | Event-Referenz (Note) | - |
| `a` | Addressable Event (Article, etc.) | - |

## Implementierte Features

### Publish to Relays
- ✅ Pro Kategorie ein kind:30003 Event
- ✅ Root Bookmarks → `d: ""`
- ✅ Named Categories → `d: "Name"` + `title: "Name"`
- ✅ Private Bookmarks → NIP-44 encrypted content

### Fetch from Relays
- ✅ Alle kind:30003 Events des Users fetchen
- ✅ Deduplizierung by d-tag (neuestes Event gewinnt)
- ✅ Public bookmarks aus tags extrahieren
- ✅ Private bookmarks aus content decrypten

## UI-Mapping

- **Relay:** Kategorien (kind:30003 mit `d`-Tag)
- **UI:** Folders (visuelle Darstellung)

## Betroffene Dateien

### Services
- `src/services/orchestration/BookmarkOrchestrator.ts` - Multi-Category Publish/Fetch
- `src/services/orchestration/configs/BookmarkListConfig.ts` - kind:30003

### Tools
- `tools/relay-inspector.html` - Bookmark Sets preset (kind:30003)

## Entscheidungen

1. **Nur kind:30003** - Keine Rückwärtskompatibilität zu kind:10003
2. **Folder = Category** - UI zeigt Folders, Relays speichern Categories
3. **Folder-Order nur lokal** - Relays kennen keine Reihenfolge
4. **title = d** - Beide Tags mit gleichem Wert für maximale Kompatibilität
