# Current Task: List Orchestrator Refactoring Fixes

**Status:** In Progress
**Date:** 2025-11-25

## Problem Summary

Nach Review der beiden Features (List Orchestrator Refactoring + Encryption Fallback) wurden folgende Probleme identifiziert:

### 🔴 CRITICAL - Bug in tagsToItem()
- **Issue:** `tagsToItem()` gibt nur `T | null` zurück, sollte aber `T[]` sein
- **Impact:** Bei `fetchFromRelays()` wird nur das erste Item aus Events extrahiert
  - Kind:3 mit 100 Follows → nur 1 Follow importiert
  - Kind:10000 mit 50 Mutes → nur 1 Mute importiert
- **Files:**
  - `src/types/ListConfig.ts` (Interface)
  - `src/services/orchestration/configs/FollowListConfig.ts`
  - `src/services/orchestration/configs/MuteListConfig.ts`
  - `src/services/orchestration/configs/BookmarkListConfig.ts`
  - `src/services/orchestration/GenericListOrchestrator.ts`

### 🟡 MEDIUM - cleanupOldMuteStorage() unvollständig
- **Issue:** Alter Key `noornote_mutes_browser` wird nicht gelöscht
- **Impact:** Migration-Check kann fehlerhaft triggern
- **File:** `src/types/BaseListItem.ts:109-114`

### 🟡 MEDIUM - console.warn() statt SystemLogger
- **Issue:** Mehrere console.warn() Statements
- **Impact:** Nicht konform mit CLAUDE.md ("Minimal logs")
- **Files:**
  - `src/services/orchestration/GenericListOrchestrator.ts` (3x)
  - `src/helpers/encryptPrivateFollows.ts` (3x)
  - `src/helpers/decryptPrivateFollows.ts` (6x)

---

## Implementation Plan

### Phase 1: Fix tagsToItem() Signature (CRITICAL)

**1.1 Update ListConfig Interface**
```typescript
// src/types/ListConfig.ts
tagsToItem: (tags: string[][], timestamp: number) => T[]  // Changed from T | null
```

**1.2 Update FollowListConfig**
```typescript
// src/services/orchestration/configs/FollowListConfig.ts
tagsToItem: (tags: string[][], timestamp: number): FollowItem[] => {
  const items: FollowItem[] = [];
  tags.forEach(tag => {
    if (tag[0] === 'p' && tag[1]) {
      items.push({
        pubkey: tag[1],
        relay: tag[2] || undefined,
        petname: tag[3] || undefined,
        addedAt: timestamp
      });
    }
  });
  return items;  // Return all items, not just items[0]
}
```

**1.3 Update MuteListConfig**
```typescript
// src/services/orchestration/configs/MuteListConfig.ts
tagsToItem: (tags: string[][], timestamp: number): MuteItem[] => {
  const items: MuteItem[] = [];
  tags.forEach(tag => {
    if (tag[0] === 'p' && tag[1]) {
      items.push({ id: tag[1], type: 'user', addedAt: timestamp });
    } else if (tag[0] === 'e' && tag[1]) {
      items.push({ id: tag[1], type: 'thread', addedAt: timestamp });
    }
  });
  return items;
}
```

**1.4 Update BookmarkListConfig**
```typescript
// src/services/orchestration/configs/BookmarkListConfig.ts
tagsToItem: (tags: string[][], timestamp: number): BookmarkItem[] => {
  const items: BookmarkItem[] = [];
  tags.forEach(tag => {
    if (tag[0] === 'e' && tag[1]) {
      items.push({ id: tag[1], type: 'e', value: tag[1], addedAt: timestamp });
    } else if (tag[0] === 'a' && tag[1]) {
      items.push({ id: tag[1], type: 'a', value: tag[1], addedAt: timestamp });
    } else if (tag[0] === 't' && tag[1]) {
      items.push({ id: tag[1], type: 't', value: tag[1], addedAt: timestamp });
    } else if (tag[0] === 'r' && tag[1]) {
      items.push({ id: tag[1], type: 'r', value: tag[1], addedAt: timestamp });
    }
  });
  return items;
}
```

**1.5 Update GenericListOrchestrator.fetchFromRelays()**
```typescript
// src/services/orchestration/GenericListOrchestrator.ts:351-357
// Extract public items
const remotePublicItems: T[] = [];
if (publicEvents.length > 0) {
  const event = publicEvents[0];
  const items = this.config.tagsToItem(event.tags, event.created_at);
  remotePublicItems.push(...items);  // Changed from single item push
}
```

### Phase 2: Fix cleanupOldMuteStorage()

**2.1 Add missing cleanup line**
```typescript
// src/types/BaseListItem.ts:109-115
export function cleanupOldMuteStorage(): void {
  localStorage.removeItem('noornote_mutes_browser');  // ADD THIS LINE
  localStorage.removeItem('noornote_mutes_private_browser');
  localStorage.removeItem('noornote_muted_threads_browser');
  localStorage.removeItem('noornote_muted_threads_private_browser');
  console.log('[MuteStorage] Cleaned up old storage keys');
}
```

### Phase 3: Replace console.warn() with SystemLogger

**3.1 GenericListOrchestrator**
- Lines 284, 296, 307: Replace with `this.systemLogger.warn(...)`

**3.2 encryptPrivateFollows.ts**
- Lines 48, 67, 94: Remove console.warn() (fallback is expected behavior)

**3.3 decryptPrivateFollows.ts**
- Lines 52, 65, 84, 103, 131, 144: Remove console.warn() (fallback is expected behavior)

---

## Test Plan

### Test Scenario (für alle 3 Listen)

**Ablauf pro Liste:**
1. User öffnet eine der Listen (Follows/Bookmarks/Mutes) in der UI
2. User erstellt Screenshot des List Views: `screenshots/screenshot.png`
3. User gibt optional zusätzliche Informationen zu Claude Code
4. User drückt "Save to file" Button in der UI
   - → JSON-Dateien werden in `~/.noornote/` abgelegt
   - Follows: `follows-public.json`, `follows-private.json`
   - Bookmarks: `bookmarks-public.json`, `bookmarks-private.json`
   - Mutes: `mutes-public.json`, `mutes-private.json`
5. User gibt Kommando: "Vergleiche"
6. Claude Code vergleicht:
   - Screenshot (UI-dargestellte Items)
   - JSON-Dateien (gespeicherte Items)
   - **Erfolgskriterium:** Alle Items aus UI sind in JSON vorhanden (keine fehlenden Items)

**Durchführung:**
- Test 1: Follows List
- Test 2: Bookmarks List
- Test 3: Mutes List

**Erwartetes Ergebnis:**
- ✅ Alle UI-Items in JSON vorhanden
- ✅ Keine Items fehlen (Bug behoben: nicht nur erstes Item)
- ✅ Public/Private Kategorisierung korrekt
- ✅ Architektur verbessert (60% weniger Code, config-driven)

---

## Files to Modify

```
src/types/ListConfig.ts                                    # tagsToItem signature
src/types/BaseListItem.ts                                  # cleanupOldMuteStorage
src/services/orchestration/configs/FollowListConfig.ts     # tagsToItem implementation
src/services/orchestration/configs/MuteListConfig.ts       # tagsToItem implementation
src/services/orchestration/configs/BookmarkListConfig.ts   # tagsToItem implementation
src/services/orchestration/GenericListOrchestrator.ts      # fetchFromRelays + console.warn
src/helpers/encryptPrivateFollows.ts                       # console.warn removal
src/helpers/decryptPrivateFollows.ts                       # console.warn removal
```

---

## Success Criteria

- [x] Phase 1 complete: tagsToItem() returns T[]
- [x] Phase 2 complete: All 4 old mute keys deleted
- [x] Phase 3 complete: No console.warn() remaining
- [x] `npm run build` passes (0 errors, 0 warnings)
- [x] Test Scenario passed for Follows (386 items: 383 public + 3 private)
- [x] Test Scenario passed for Bookmarks (22 items: 21 public + 1 private)
- [x] Test Scenario passed for Mutes (8 items: 7 public + 1 private)

---

## Notes

- Alle Änderungen rückwärtskompatibel (keine Breaking Changes in Public API)
- Migration läuft weiterhin automatisch
- Browser bleibt Single Source of Truth
- Encryption Fallback funktioniert wie spezifiziert
