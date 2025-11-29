# Bookmark Cards mit Folder & Drag&Drop

## Status: Implementierung abgeschlossen, Testing in Arbeit

**Letzter Stand (2024-11):**
- Implementierung ist vollständig
- Manuelles Testing begonnen
- Beim Testen mit Remote Signer (Hardware) aufgefallen: "Sync to Relays" schlägt fehl wenn private Bookmarks vorhanden sind
- **Siehe:** `docs/todos/encryption-fallback-logic.md` - dort wird das Encryption-Problem für alle Listen (Follows, Mutes, Bookmarks) dokumentiert

### Commits
- `2909fb0` - Add bookmark cards grid layout with folders and drag-drop support
- `9d5e611` - Add mouse-based drag & drop for bookmark cards without reload
- `150d0a6` - Save folder structure to file and fix bookmark display

## Was wurde implementiert

### UI-Komponenten
- [x] **BookmarkCard** - Card mit Author, Content-Snippet, Timestamp, Delete-Button
- [x] **FolderCard** - Folder-Darstellung mit Name, Item-Count, Delete-Button
- [x] **UpNavigator** - ".." Element zum Navigieren zurück zu Root (auch Drop-Target)
- [x] **NewFolderModal** - Modal für Folder-Erstellung (ersetzt window.prompt)
- [x] **BookmarkSecondaryManager** - Grid-Layout mit Folders, Navigation, Drag&Drop

### Drag & Drop (Mouse-basiert, da HTML5 Drag API in Tauri/Safari nicht funktioniert)
- [x] Cards und Folders können per Drag verschoben werden
- [x] Cards können auf Folders gezogen werden (verschiebt in Folder)
- [x] Cards können auf ".." gezogen werden (verschiebt zurück zu Root)
- [x] Reihenfolge ändern durch Drag auf andere Cards/Folders
- [x] Kein Reload nach Drag-Operationen

### Storage
- [x] **BookmarkFileStorage** - Erweitert um Folder-Struktur (folders, folderAssignments, rootOrder)
- [x] **BookmarkStorageAdapter** - Speichert/Lädt Folder-Daten von/zu File
- [x] **BookmarkFolderService** - Verwaltet Folder-Zuweisungen in localStorage
- [x] "Save to File" speichert Folder-Struktur mit
- [x] "Restore from File" stellt Folder-Struktur wieder her

### Bug Fixes
- [x] pointerEvents Reset nach Drag (Cards waren nach erstem Drag nicht mehr draggbar)
- [x] Bookmarks werden aus localStorage angezeigt, unabhängig von Relay-Event-Status
- [x] Fallback-UI für Bookmarks ohne geladene Event-Daten ("Note not found")

## Noch zu testen

### Grundfunktionen
- [ ] New Folder erstellen
- [ ] Folder umbenennen (nicht implementiert - Feature-Request?)
- [ ] Folder löschen (Bookmarks zurück zu Root)
- [ ] Bookmark Card löschen

### Drag & Drop
- [ ] Card in Folder ziehen
- [ ] Card aus Folder zurück zu Root ziehen (auf "..")
- [ ] Cards innerhalb Root umsortieren
- [ ] Cards innerhalb Folder umsortieren
- [ ] Folders umsortieren

### Sync-Operationen
- [x] Save to File (Folder-Struktur wird mitgespeichert)
- [x] Restore from File (Folder-Struktur wird wiederhergestellt)
- [ ] Sync from Relays
- [ ] Sync to Relays - **BLOCKIERT:** Siehe `encryption-fallback-logic.md`

## Bekannte Einschränkungen

- Folder-Struktur ist ein lokales NoorNote-Feature (nicht NIP-51 sync-fähig)
- Andere Clients sehen nur flache Bookmark-Listen
- Drag & Drop funktioniert nur mit Maus (kein Touch-Support)

## Abhängigkeiten

### Blockiert durch:
- `docs/todos/encryption-fallback-logic.md` - "Sync to Relays" für private Bookmarks funktioniert nicht mit Remote Signer (NIP-46), da NIP-44 Encryption nicht unterstützt wird. Nach Implementierung der Fallback-Logik sollte auch Bookmark-Sync funktionieren.

## Dateien

```
src/components/bookmarks/
├── BookmarkCard.ts      # Einzelne Bookmark-Card
├── FolderCard.ts        # Folder-Card
└── UpNavigator.ts       # ".." Navigation

src/components/modals/
└── NewFolderModal.ts    # Modal für Folder-Erstellung

src/components/layout/managers/
└── BookmarkSecondaryManager.ts  # Grid, Navigation, Drag&Drop

src/services/
├── BookmarkFolderService.ts     # Folder-Verwaltung (localStorage)
└── storage/
    └── BookmarkFileStorage.ts   # File-Storage mit Folder-Struktur

src/services/sync/adapters/
└── BookmarkStorageAdapter.ts    # Save/Restore Folder-Daten

src/styles/components/
└── _bookmark-cards.scss         # Card-Styles
```
