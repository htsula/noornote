# List Orchestrator Refactoring - Abstraktion & Vereinheitlichung

**Status: ✅ COMPLETED (2024-11-24)**

## Problem

Aktuell haben wir 3 separate Orchestratoren (Follows, Mutes, Bookmarks) mit **dupliziertem Code** und **inkonsistenten Implementierungen**:

| Aspekt | Follows | Bookmarks | Mutes |
|--------|---------|-----------|-------|
| Item-Typ | `FollowItem` mit `isPrivate` Flag | `BookmarkItem` mit `isPrivate` Flag | `string[]` (kein Item-Objekt!) |
| localStorage | 1 Key | 1 Key | **4 separate Keys** |
| Private-Marker | `isPrivate?: boolean` | `isPrivate?: boolean` | **Separate Storage Keys** |
| ID-Feld | `pubkey` | `id` | String direkt |
| NIP-02 Metadata | `relay`, `petname` | - | - |

**Konsequenz:** Jeder Bug muss 3x gefixt werden. Neue Listen erfordern 1000+ Zeilen duplizierten Code.

---

## Ziel-Architektur (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│                       GenericListOrchestrator<T>                    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  CORE LOGIC (wiederverwendbar)                                │ │
│  │                                                                │ │
│  │  • getBrowserItems() / setBrowserItems()                      │ │
│  │  • addItem(item, isPrivate)                                   │ │
│  │  • removeItem(itemId)                                         │ │
│  │  • getAllItemsWithStatus() → Map<id, {public, private}>      │ │
│  │  • publishToRelays()  [liest Browser → filtert → publiziert] │ │
│  │  • fetchFromRelays()  [liest Relays → merged]                │ │
│  │  • saveToFile()       [Browser → Files]                       │ │
│  │  • restoreFromFile()  [Files → Browser]                       │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  CONFIG-DRIVEN (ListConfig<T> Parameter)                      │ │
│  │                                                                │ │
│  │  • name: 'follows' | 'mutes' | 'bookmarks'                    │ │
│  │  • browserStorageKey: 'noornote_follows_browser'              │ │
│  │  • publicEventKind: 3 (kind:3 for follows)                    │ │
│  │  • privateEventKind: 30000 (kind:30000 for private follows)   │ │
│  │  • encryptContent: boolean (Mutes: true, Follows: false)      │ │
│  │  • fileStorage: FollowFileStorage | MuteFileStorage | ...     │ │
│  │  • getItemId: (item) => string                                │ │
│  │  • itemToTags: (item) => string[][]                           │ │
│  │  • tagsToItem: (tags) => T                                    │ │
│  │  • encryptPrivateItems?: (items, pubkey) => Promise<string>   │ │
│  │  • decryptPrivateItems?: (content, pubkey) => Promise<T[]>    │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ instanziiert mit Config
                                    ▼
        ┌───────────────────────────────────────────────────────────┐
        │         KONKRETE INSTANZEN (Singletons)                   │
        ├───────────────────────────────────────────────────────────┤
        │                                                           │
        │  FollowListOrchestrator                                   │
        │    = GenericListOrchestrator<FollowItem>(followConfig)    │
        │                                                           │
        │  MuteOrchestrator                                         │
        │    = GenericListOrchestrator<MuteItem>(muteConfig)        │
        │                                                           │
        │  BookmarkOrchestrator                                     │
        │    = GenericListOrchestrator<BookmarkItem>(bookmarkConfig)│
        │                                                           │
        └───────────────────────────────────────────────────────────┘
                                    │
                                    │ verwendet von
                                    ▼
        ┌───────────────────────────────────────────────────────────┐
        │               UI Components & Adapters                    │
        ├───────────────────────────────────────────────────────────┤
        │                                                           │
        │  • FollowListSecondaryManager                             │
        │  • MuteListSecondaryManager                               │
        │  • BookmarkSecondaryManager                               │
        │  • FollowStorageAdapter                                   │
        │  • MuteStorageAdapter                                     │
        │  • BookmarkStorageAdapter                                 │
        │                                                           │
        └───────────────────────────────────────────────────────────┘
```

---

## Datenfluss (vereinheitlicht)

```
                    ┌─────────────────────────────┐
                    │   Browser (localStorage)    │
                    │  ───────────────────────    │
                    │   SINGLE SOURCE OF TRUTH    │
                    │                             │
                    │  Key: noornote_{name}_browser│
                    │  Value: T[] mit isPrivate   │
                    └──────────┬──────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
    ┌───────────────┐  ┌──────────────┐  ┌──────────────┐
    │ User Actions  │  │              │  │              │
    │               │  │              │  │              │
    │ • add()       │  │              │  │              │
    │ • remove()    │  │              │  │              │
    │ • toggle      │  │              │  │              │
    │   isPrivate   │  │              │  │              │
    └───────────────┘  │              │  │              │
                       │              │  │              │
         "Save to      │              │  │  "Sync to    │
          File"        │              │  │   Relays"    │
                       │              │  │              │
                       ▼              │  ▼              │
              ┌────────────────┐     │  ┌─────────────┐│
              │     Files      │     │  │   Relays    ││
              │   (optional)   │     │  │  (optional) ││
              ├────────────────┤     │  ├─────────────┤│
              │ {name}-public  │     │  │ kind:X      ││
              │ {name}-private │     │  │ kind:3000X  ││
              └────────────────┘     │  └─────────────┘│
                       │             │         │        │
                       │             │         │        │
         "Restore from │             │         │        │
          File"        │             │         │        │
                       └─────────────┘         │        │
                                               │        │
                                "Fetch from    │        │
                                 Relays"       │        │
                                               └────────┘

WICHTIG:
- Browser ist ZENTRAL - alle Änderungen passieren dort
- Files und Relays sind PARALLEL und OPTIONAL
- saveToFile() liest aus Browser, schreibt in Files
- publishToRelays() liest aus Browser, schreibt zu Relays
- NIEMALS: Files → Relays oder Relays → Files
```

---

## Item-Interfaces (vereinheitlicht)

### Basis-Interface
```typescript
interface BaseListItem {
  id: string;           // Unique identifier (pubkey, eventId, etc.)
  isPrivate?: boolean;  // Private status (für "Save to File" Kategorisierung)
  addedAt?: number;     // Timestamp
}
```

### Konkrete Item-Typen
```typescript
// Follows
interface FollowItem extends BaseListItem {
  id: string;           // = pubkey
  relay?: string;       // NIP-02 metadata
  petname?: string;     // NIP-02 metadata
}

// Mutes
interface MuteItem extends BaseListItem {
  id: string;           // pubkey OR eventId
  type: 'user' | 'thread';
}

// Bookmarks
interface BookmarkItem extends BaseListItem {
  id: string;
  type: 'e' | 'a' | 't' | 'r';  // NIP-51 types
  value: string;
}
```

---

## ListConfig (spezifische Unterschiede als Config)

```typescript
interface ListConfig<T extends BaseListItem> {
  // Identifikation
  name: string;                           // 'follows', 'mutes', 'bookmarks'
  browserStorageKey: string;              // localStorage key

  // Nostr Events
  publicEventKind: number;                // kind:3, kind:10000, kind:10003
  privateEventKind?: number;              // kind:30000, kind:10000, kind:30003
  privateEventDTag?: string;              // #d tag für parameterized events

  // Encryption
  encryptPrivateContent: boolean;         // Mutes: true, Follows: false

  // File Storage
  fileStorage: BaseFileStorage<T>;        // Injected file storage instance

  // Item Operations
  getItemId: (item: T) => string;         // Extrahiere unique ID
  itemToTags: (item: T) => string[][];    // Convert item → Nostr tags
  tagsToItem: (tags: string[][], timestamp: number) => T | null;

  // Optional: Custom Encryption (nur für Mutes/Bookmarks)
  encryptPrivateItems?: (items: T[], pubkey: string) => Promise<string>;
  decryptPrivateItems?: (content: string, pubkey: string) => Promise<T[]>;
}
```

---

## Migrations-Strategie

### Phase 1: Vorbereitung (keine Breaking Changes)
1. **MuteItem Interface erstellen**
   - `MuteItem` mit `id`, `type: 'user' | 'thread'`, `isPrivate`
   - Wrapper-Funktionen für Backward-Compatibility

2. **GenericListOrchestrator erstellen**
   - Als neue Datei: `src/services/orchestration/GenericListOrchestrator.ts`
   - Alle gemeinsamen Methoden implementieren
   - Config-driven Logic

3. **ListConfig für jede Liste erstellen**
   - `src/services/orchestration/configs/FollowListConfig.ts`
   - `src/services/orchestration/configs/MuteListConfig.ts`
   - `src/services/orchestration/configs/BookmarkListConfig.ts`

### Phase 2: Migration (schrittweise)
4. **FollowListOrchestrator migrieren**
   - Factory-Funktion: `FollowListOrchestrator.getInstance()` nutzt `GenericListOrchestrator`
   - Alte öffentliche API beibehalten (Wrapper)
   - Tests

5. **BookmarkOrchestrator migrieren**
   - Gleiche Strategie
   - Tests

6. **MuteOrchestrator migrieren**
   - Migration auf `MuteItem[]` Interface
   - localStorage von 4 Keys → 1 Key (mit Migration-Helper)
   - Tests

### Phase 3: Cleanup
7. **Code-Duplikate entfernen**
   - Alte Implementierungen löschen
   - Nur Wrapper behalten

8. **StorageAdapter vereinfachen**
   - `BaseListStorageAdapter` erweitern mit generischer Logik

---

## Betroffene Dateien

### Neue Dateien
```
src/services/orchestration/GenericListOrchestrator.ts
src/services/orchestration/configs/FollowListConfig.ts
src/services/orchestration/configs/MuteListConfig.ts
src/services/orchestration/configs/BookmarkListConfig.ts
src/types/BaseListItem.ts
```

### Zu modifizierende Dateien
```
src/services/orchestration/FollowListOrchestrator.ts    → Wrapper um GenericListOrchestrator
src/services/orchestration/MuteOrchestrator.ts          → Wrapper + Migration
src/services/orchestration/BookmarkOrchestrator.ts      → Wrapper um GenericListOrchestrator
src/services/storage/MuteFileStorage.ts                 → MuteItem[] statt string[]
src/services/sync/adapters/BaseListStorageAdapter.ts    → Mehr generische Logik
```

### NICHT zu ändern (API bleibt gleich)
```
src/components/layout/managers/*SecondaryManager.ts     → Keine Änderungen nötig
src/services/sync/adapters/*StorageAdapter.ts           → API bleibt gleich
```

---

## Vorteile nach Refactoring

### Vorher (jetzt)
- 3 Orchestratoren mit je ~900 Zeilen
- **Gesamt: ~2700 Zeilen Code**
- Jeder Bug muss 3x gefixt werden
- Neue Liste = 1000+ Zeilen Code

### Nachher
- 1 GenericListOrchestrator: ~600 Zeilen
- 3 Configs: je ~100 Zeilen = 300 Zeilen
- 3 Wrapper: je ~50 Zeilen = 150 Zeilen
- **Gesamt: ~1050 Zeilen Code** (60% weniger!)
- Bug-Fixes nur an 1 Stelle
- Neue Liste = ~100 Zeilen Config

---

## Risiko-Bewertung

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Breaking Changes in UI | Niedrig | Hoch | Public API beibehalten (Wrapper) |
| Bugs durch Refactoring | Mittel | Mittel | Schrittweise Migration, Tests nach jeder Phase |
| localStorage Migration | Mittel | Hoch | Migration-Helper für Mutes (4 Keys → 1 Key) |
| Performance | Niedrig | Niedrig | Config-basiert = gleiche Performance |

---

## Zeitaufwand (Schätzung)

- Phase 1 (Vorbereitung): ~2-3h
- Phase 2 (Migration): ~3-4h
- Phase 3 (Cleanup): ~1h
- **Gesamt: ~6-8h**

---

## Entscheidung

- [ ] Plan akzeptiert → Starte mit Phase 1
- [ ] Plan überarbeiten → Feedback:
- [ ] Plan verwerfen → Grund:
