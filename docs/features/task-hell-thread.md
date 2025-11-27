# Hell Thread Muting - Implementation Plan

## Problem
"Hell Threads" = Notes mit Dutzenden Mentions. Jede Antwort triggert Notifications für ALLE getaggten User, auch wenn Inhalt irrelevant. Bisher gab es kein Mittel dagegen.

## YakiHonne Solution (Research)

### 1. NIP-51 Basis
- **Kind 10000** Mute List unterstützt `"e"` tags für Thread-Muting
- Format: `["e", "note_id"]` - mutet spezifische Note + alle Replies

### 2. State Structure (YakiHonne)
```javascript
{
  userMutedList: [pubkey1, pubkey2, ...],  // "p" tags only
  allTags: [["p", pubkey], ["e", noteId], ["t", hashtag], ...]  // ALL tags
}
```

### 3. useIsMute Hook (YakiHonne)
```javascript
function useIsMute(id, kind = "p") {
  // isMuted: prüft ob ID in userMutedList
  // muteUnmute: adds/removes [kind, id] to/from allTags
  //             creates Kind 10000 Event
  //             publishes via Redux
}
```

### 4. Filtering Logic (KindOne.js - YakiHonne)
```javascript
// 4 Checks:
const { isMuted: isMutedPubkey } = useIsMute(event.pubkey);        // User
const { isMuted: isMutedId } = useIsMute(event.id, "e");           // Diese Note
const { isMuted: isMutedComment } = useIsMute(event.isComment, "e"); // Comment parent
const { isMuted: isMutedRoot } = useIsMute(event.rootData?.[1], "e"); // Root event

// Hide wenn gemuted:
if ((isMutedId || isMutedComment || isMutedRoot) && !minimal) return null;
```

**Key Insight:** Wenn Root gemuted → gesamter Thread unsichtbar (cascading)

---

## Implementation Plan für Noornote

### Phase 1: Backend - MuteOrchestrator Enhancement

**File:** `src/services/orchestration/MuteOrchestrator.ts`

#### 1.1 Extend Mute Data Structure
```typescript
interface MuteData {
  items: string[];        // Currently only pubkeys
  lastModified: number;
  lastPublishedEventId?: string;
}

// NEW:
interface EnhancedMuteData {
  items: string[];              // pubkeys (legacy)
  eventIds: string[];           // "e" tags - muted note IDs
  hashtags: string[];           // "t" tags (future)
  words: string[];              // "word" tags (future)
  lastModified: number;
  lastPublishedEventId?: string;
}
```

#### 1.2 Update MuteFileStorage
**File:** `src/services/storage/MuteFileStorage.ts`

- Add `eventIds` array to public/private JSON structure
- Maintain backward compatibility with existing `items` array
- Update read/write methods

#### 1.3 Add Thread Tag Helper Methods
**File:** `src/services/orchestration/MuteOrchestrator.ts`

Add private helper methods (duplicate from ThreadOrchestrator/PostService):
```typescript
private extractRootId(event: NostrEvent): string | null
private extractParentId(event: NostrEvent): string | null
```

**Why duplicate?**
- ThreadOrchestrator.extractParentId is private
- MuteOrchestrator needs standalone logic (no dependency)
- Code is small (~15 lines each)

**Reference:**
- Parent logic: `ThreadOrchestrator.ts:301-318`
- Root logic: `PostService.ts:310-312` + NIP-10 fallback

#### 1.4 Add Event Muting Methods to MuteOrchestrator
```typescript
class MuteOrchestrator {
  // Existing: muteUser, unmuteUser, isMuted
  private mutedEventIds: Set<string> = new Set(); // NEW

  // NEW Public Methods:
  async muteThread(eventId: string, isPublic: boolean = false): Promise<void>
  async unmuteThread(eventId: string, isPublic: boolean = false): Promise<void>

  // Cascading check (note + parent + root):
  isThreadMuted(event: NostrEvent): boolean {
    if (this.mutedEventIds.has(event.id)) return true;
    const parentId = this.extractParentId(event);
    if (parentId && this.mutedEventIds.has(parentId)) return true;
    const rootId = this.extractRootId(event);
    if (rootId && this.mutedEventIds.has(rootId)) return true;
    return false;
  }

  // Simple ID check (for MuteListView):
  isEventMuted(eventId: string): boolean {
    return this.mutedEventIds.has(eventId);
  }

  // Helper:
  private async publishMuteList(isPublic: boolean): Promise<void>
  // Creates Kind 10000 Event with ["p", ...] + ["e", ...] tags
}
```

#### 1.5 NIP-51 Kind 10000 Publishing
- Read current mute data (users + eventIds)
- Build tags array:
  - `["p", pubkey]` for each muted user
  - `["e", eventId]` for each muted thread
- Sign via `AuthService.signEvent()`
- Publish via `NostrTransport.publish()`
- Store event ID in file (`lastPublishedEventId`)

---

### Phase 2: UI Components

#### 2.1 EventOptions Enhancement
**File:** `src/components/note/EventOptions.ts`

Add "Mute Thread" option:
```typescript
// After "Mute User" option
{
  label: 'Mute Thread',
  icon: '🔇',
  action: async () => {
    await MuteOrchestrator.muteThread(note.id, false);  // private by default
    ToastService.show('Thread muted');
  }
}
```

#### 2.2 Note Rendering Filter
**Primary Location:** `src/components/ui/note-rendering/NoteStructureBuilder.ts`

**Strategy:** Add mute check BEFORE building note structure
```typescript
// In NoteStructureBuilder.build() - Line ~94
static build(note: ProcessedNote, ...): NoteStructureResult {
  const muteOrchestrator = MuteOrchestrator.getInstance();

  // Check if thread is muted (cascading: note + parent + root)
  if (muteOrchestrator.isThreadMuted(note.rawEvent)) {
    return this.buildMutedThreadPlaceholder(note);
  }

  // ... existing code
}

private static buildMutedThreadPlaceholder(note: ProcessedNote): NoteStructureResult {
  // Returns minimal element with "Thread muted" message + unmute button
}
```

**Why NoteStructureBuilder?**
- Central place used by ALL note renderers (Timeline, Profile, Search, SNV)
- Already checks NSFW, long content → logical place for mute check
- Single implementation = consistent behavior everywhere

#### 2.3 Muted Thread Warning UI
Display collapsed placeholder:
```html
<div class="muted-thread-warning">
  <p>This thread is muted. You won't see replies in your feed.</p>
  <button @click="${this.unmuteThread}">Unmute Thread</button>
</div>
```

#### 2.4 Mute List View Enhancement
**File:** `src/components/views/MuteListView.ts`

Add tabs:
- "Muted Users" (existing)
- "Muted Threads" (NEW)

Display muted thread IDs with:
- First few words of note content (fetch via NostrTransport)
- Author name
- Unmute button

---

### Phase 3: Feed Integration

#### 3.1 FeedOrchestrator
**File:** `src/services/orchestration/FeedOrchestrator.ts`

Already filters muted users. Extend to filter threads:
```typescript
private filterEvents(events: NostrEvent[]): NostrEvent[] {
  return events.filter(event => {
    // Existing user mute check
    if (this.muteOrchestrator.isMuted(event.pubkey)) return false;

    // NEW: Thread mute checks
    if (this.muteOrchestrator.isThreadMuted(event.id)) return false;

    // Check if ANY parent is muted (Hell Thread protection)
    const parentTags = event.tags.filter(t => t[0] === 'e');
    const hasParentMuted = parentTags.some(([_, parentId]) =>
      this.muteOrchestrator.isThreadMuted(parentId)
    );
    if (hasParentMuted) return false;

    return true;
  });
}
```

#### 3.2 SearchOrchestrator
**File:** `src/services/orchestration/SearchOrchestrator.ts`

Same filtering logic as FeedOrchestrator (see TODO #1 in CLAUDE.md)

#### 3.3 NotificationOrchestrator
**File:** `src/services/orchestration/NotificationOrchestrator.ts`

Filter out notifications from muted threads

---

### Phase 4: Sync & Persistence

#### 4.1 Load Mute List on App Start
**File:** `src/services/orchestration/MuteOrchestrator.ts`

```typescript
async initialize(): Promise<void> {
  // Load from files
  await this.loadMutedUsers();  // existing

  // NEW: Fetch Kind 10000 from relays
  const muteEvents = await NostrTransport.fetch({
    kinds: [10000],
    authors: [AuthService.getCurrentUserPubkey()],
    limit: 1
  });

  if (muteEvents.length > 0) {
    this.mergeRemoteMuteList(muteEvents[0]);
  }
}
```

#### 4.2 Merge Strategy
- Local file = source of truth
- Remote Kind 10000 = backup/sync
- Merge: Union of local + remote (don't delete local entries)
- Option in UI: "Publish to Relays" button (like Mute List View)

---

### Phase 5: Edge Cases

#### 5.1 Root Event Detection
YakiHonne checks `event.rootData` - analyze how NN determines root:
- Check `e` tags for `root` marker (NIP-10)
- Fallback: First `e` tag = root
- Implement helper: `getRootEventId(note): string | null`

#### 5.2 Hell Thread Heuristic (Optional Enhancement)
Auto-detect Hell Threads:
- Count `p` tags in note
- If > 10 mentions → show warning: "This looks like a Hell Thread. Mute it?"

#### 5.3 Notification Behavior
- DON'T send notification if note is reply to muted thread
- Add to NotificationOrchestrator filtering

---

## Files to Modify

### Core Services (Backend)
1. **`src/services/orchestration/MuteOrchestrator.ts`** ⭐ Main logic
   - Add `mutedEventIds` Set
   - Add `extractRootId()`, `extractParentId()` helpers
   - Add `muteThread()`, `unmuteThread()`, `isThreadMuted()`, `isEventMuted()`
   - Update `publishMuteList()` to include "e" tags

2. **`src/services/storage/MuteFileStorage.ts`**
   - Add `eventIds: string[]` to JSON structure
   - Update `saveMuteList()` / `loadMuteList()` methods

3. **`src/services/orchestration/FeedOrchestrator.ts`**
   - Update `filterEvents()` to call `isThreadMuted(event)`

4. **`src/services/orchestration/SearchOrchestrator.ts`**
   - Add thread mute filtering (same as FeedOrchestrator)

5. **`src/services/orchestration/NotificationOrchestrator.ts`**
   - Filter notifications from muted threads

### UI Components (Frontend)
6. **`src/components/ui/note-rendering/NoteStructureBuilder.ts`** ⭐ Central filter
   - Add `isThreadMuted()` check in `build()` method
   - Add `buildMutedThreadPlaceholder()` method

7. **`src/components/ui/note-rendering/NoteHeader.ts`** (EventOptions location)
   - Add "Mute Thread" option to menu
   - Icon: 🔇 or similar

8. **`src/components/views/MuteListView.ts`**
   - Add "Muted Threads" tab
   - Display `eventIds` with note preview

### Types (Optional)
9. **`src/types/mute.ts`** (NEW or extend existing)
   - TypeScript interfaces for EnhancedMuteData

---

## Testing Checklist

1. ✅ Mute thread from EventOptions
2. ✅ Thread disappears from Timeline
3. ✅ Replies to muted thread also hidden
4. ✅ Root muted → entire thread hidden
5. ✅ Notifications from muted threads blocked
6. ✅ Muted threads list shows in MuteListView
7. ✅ Unmute thread works
8. ✅ Publish to relays creates Kind 10000 with "e" tags
9. ✅ Sync from relays merges correctly
10. ✅ File storage backward compatible

---

## NN's Existing Thread Tag Logic (NIP-10)

### Code References Found

**1. Extract Parent ID**
- **File:** `src/services/orchestration/ThreadOrchestrator.ts:301-318`
- **Method:** `extractParentId(event: NostrEvent)`
- **Logic:**
  1. Look for e-tag with marker "reply" → `tag[3] === 'reply'`
  2. If only 1 e-tag → `eTags[0][1]`
  3. If multiple → last = parent → `eTags[eTags.length - 1][1]`

**2. Extract Root ID**
- **File:** `src/services/PostService.ts:310-312`
- **Method:** `buildReplyTags()` contains root detection logic
- **Logic:**
  ```typescript
  const parentRootTag = parentEvent.tags.find(
    tag => tag[0] === 'e' && tag[3] === 'root'
  );
  // If found: rootEventId = parentRootTag[1]
  // If not: parent IS root
  ```

**3. Thread Context Chain**
- **File:** `src/services/orchestration/ThreadOrchestrator.ts:172-296`
- **Method:** `fetchParentChain(noteId: string)`
- **Returns:** `ThreadContext` with `root`, `parents`, `directParent`

**4. Reply Info Extraction**
- **File:** `src/components/ui/note-rendering/NoteStructureBuilder.ts:41-63`
- **Method:** `extractReplyInfo(event: NostrEvent)`
- **Returns:** `{ parentEventId, relayHint }`

### YakiHonne → NN Mapping

| YakiHonne | NN Equivalent |
|-----------|---------------|
| `event.isComment` | `ThreadOrchestrator.extractParentId(event)` |
| `event.rootData[1]` | Root from `event.tags.find(t => t[0]==='e' && t[3]==='root')?.[1]` |
| `isMutedComment` | Check if parent ID is muted |
| `isMutedRoot` | Check if root ID is muted |

---

## Implementation Details for NN

### Helper Functions to Add (MuteOrchestrator)

```typescript
/**
 * Extract root event ID from e-tags (NIP-10)
 * Reuses logic from PostService.buildReplyTags
 */
private extractRootId(event: NostrEvent): string | null {
  // Look for explicit "root" marker
  const rootTag = event.tags.find(tag => tag[0] === 'e' && tag[3] === 'root');
  if (rootTag) return rootTag[1];

  // Fallback (NIP-10 deprecated positional): first e-tag is root
  const eTags = event.tags.filter(tag => tag[0] === 'e');
  if (eTags.length > 1) return eTags[0][1]; // Only if multiple (first=root, last=parent)

  return null; // No root (this IS a root post)
}

/**
 * Extract parent event ID from e-tags (NIP-10)
 * Duplicates ThreadOrchestrator.extractParentId logic
 */
private extractParentId(event: NostrEvent): string | null {
  const eTags = event.tags.filter(tag => tag[0] === 'e');
  if (eTags.length === 0) return null;

  // NIP-10: Look for explicit "reply" marker
  const replyTag = eTags.find(tag => tag[3] === 'reply');
  if (replyTag) return replyTag[1];

  // NIP-10 deprecated positional
  if (eTags.length === 1) return eTags[0][1];
  return eTags[eTags.length - 1][1];
}

/**
 * Check if note or any of its parents/root are muted
 * Implements YakiHonne's cascading filter logic
 */
public isThreadMuted(event: NostrEvent): boolean {
  // Check 1: Note itself muted
  if (this.mutedEventIds.has(event.id)) return true;

  // Check 2: Parent muted
  const parentId = this.extractParentId(event);
  if (parentId && this.mutedEventIds.has(parentId)) return true;

  // Check 3: Root muted
  const rootId = this.extractRootId(event);
  if (rootId && this.mutedEventIds.has(rootId)) return true;

  return false;
}
```

---

## Open Questions

1. **Which ID to mute?**
   - YakiHonne mutes `event.id` (the specific note)
   - ✅ **Decision:** Mute `event.id`, cascade checks happen in `isThreadMuted()`
   - User clicks "Mute Thread" → stores note.id as `["e", noteId]`
   - Filter checks: note.id + parent + root

2. **Public vs Private?**
   - YakiHonne defaults to private (encrypted in Kind 10000)
   - ✅ **Decision:** NN matches - default private, option for public in MuteListView

3. **UI Placement?**
   - EventOptions menu (like YakiHonne) ✅
   - Also: Quick action button on Hell Threads (>10 mentions)? → Phase 5 (optional)

---

## Implementation Order

1. **Backend First:** MuteOrchestrator + MuteFileStorage (Phase 1)
2. **Core Filtering:** FeedOrchestrator thread checks (Phase 3.1)
3. **UI Basics:** EventOptions button + muted warning (Phase 2.1-2.3)
4. **Full Integration:** Notifications, Search, MuteListView (Phases 2.4, 3.2, 3.3)
5. **Sync:** Remote publish/fetch (Phase 4)
6. **Polish:** Hell Thread detection, edge cases (Phase 5)

---

## Estimated Effort
- **Phase 1 (Backend):** 3-4 hours
- **Phase 2 (UI):** 2-3 hours
- **Phase 3 (Filtering):** 2 hours
- **Phase 4 (Sync):** 1-2 hours
- **Phase 5 (Edge Cases):** 1-2 hours
- **Testing:** 2 hours

**Total:** ~12-15 hours

---

## References

### Nostr Protocol
- **NIP-51 (Lists):** https://github.com/nostr-protocol/nips/blob/master/51.md
- **NIP-10 (Threading):** https://github.com/nostr-protocol/nips/blob/master/10.md

### YakiHonne Implementation (Research Source)
- **Commit:** https://github.com/YakiHonne/web-app/commit/5a5c545 (Nov 6, 2025)
- **useIsMute Hook:** `src/Hooks/useIsMute.js` - Main muting logic
- **KindOne Filtering:** `src/Components/KindOne.js` - Cascading checks (note + parent + root)
- **State Structure:** `src/Store/Slides/UserData.js` - `{ userMutedList, allTags }`

### Noornote Existing Code (NN)
- **Thread Parent Detection:** `src/services/orchestration/ThreadOrchestrator.ts:301-318`
- **Thread Root Detection:** `src/services/PostService.ts:310-312`
- **Reply Info Extraction:** `src/components/ui/note-rendering/NoteStructureBuilder.ts:41-63`
- **Thread Context Chain:** `src/services/orchestration/ThreadOrchestrator.ts:172-296`
- **Mute User Implementation:** `src/services/orchestration/MuteOrchestrator.ts` (existing)
- **File Storage Pattern:** `src/services/storage/MuteFileStorage.ts` (extend for eventIds)
