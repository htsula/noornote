# nostr-tools v1→v2 Migration Map

**Compact AI doc. Scan fast when context compressed.**

---

## STATUS: v1 (NO MIGRATION YET - FAILED 4x)

### Current State
- All imports use v1 pattern: `import { ... } from 'nostr-tools'`
- 97 files with direct nostr-tools imports
- Package: `nostr-tools@^1.17.0`

### Previous Attempts
- 4 migration attempts failed and were rolled back
- Issues: Too many files, context memory limits, behavioral changes

---

## CRITICAL FILES (Event Signing)

### AuthService.ts (Line 10, 217, 674-675)
```typescript
// CURRENT v1:
import { getPublicKey, getSignature, getEventHash, nip19 } from 'nostr-tools';

// Line 217: const pubkey = getPublicKey(privateKey);
// Line 674: event.id = getEventHash(event as UnsignedEvent);
// Line 675: event.sig = getSignature(event as UnsignedEvent, privateKey);
```

**v2 CHANGE NEEDED:**
```typescript
// v2 pattern:
import { getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools/nip19';

// REPLACE Lines 672-677:
// OLD:
event.pubkey = this.currentUser!.pubkey;
event.id = getEventHash(event as UnsignedEvent);
event.sig = getSignature(event as UnsignedEvent, privateKey);
return event;

// NEW:
return finalizeEvent(event, hexToBytes(privateKey));
```

---

### ZapService.ts + NWCService.ts
```typescript
// CURRENT v1:
import { finishEvent } from 'nostr-tools';

// v2: finishEvent → finalizeEvent
import { finalizeEvent } from 'nostr-tools/pure';
```

---

### ReportService.ts (Line 18)
```typescript
// ALREADY USES v2 finalizeEvent!
import { finalizeEvent } from 'nostr-tools';
// BUT wrong import path - should be:
import { finalizeEvent } from 'nostr-tools/pure';
```

---

## NIP-19 (17 files)

```typescript
// CURRENT v1:
import { nip19 } from 'nostr-tools';

// v2:
import { nip19 } from 'nostr-tools/nip19';
```

**Files to change:**
AuthService, ProfileView, SingleNoteView, AnalyticsModal, QuoteOrchestrator, LongFormOrchestrator, PostNoteModal, QuotedNoteRenderer, hexToNpub, npubToHex, encodeNevent, renderQuotePreview, ReplyIndicator, NoteMenu, FollowingListModal, ThreadContextIndicator, NoteStructureBuilder, RepostRenderer, ArticlePreviewRenderer, FallbackElementFactory

---

## NIP-04/NIP-47 (NWCService.ts only)

```typescript
// CURRENT v1:
import { nip04, nip47 } from 'nostr-tools';

// v2:
import { nip04 } from 'nostr-tools/nip04';
import { nip47 } from 'nostr-tools/nip47';
```

---

## TYPE IMPORTS (No change - v2 compatible)

```typescript
// These work in both v1 and v2:
import type { Event, Filter, Sub, UnsignedEvent, Relay } from 'nostr-tools';
```

---

## ✅ v2 API RESEARCH COMPLETE

**Current:** `nostr-tools@^1.17.0` (v1)
**Target:** `nostr-tools@latest` (v2.x)

### finalizeEvent()
```typescript
import { finalizeEvent } from 'nostr-tools/pure';

const signed = finalizeEvent({
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'hello'
}, secretKeyUint8Array);

// Auto-adds: pubkey, id, sig
// Returns: Fully signed event
```

### hexToBytes()
```typescript
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
// Already dependency - no npm install needed
```

### getPublicKey()
```typescript
import { getPublicKey } from 'nostr-tools/pure';
let pk = getPublicKey(sk); // sk = Uint8Array, returns hex string
```

### NIP Modules (unchanged API)
```typescript
import * as nip19 from 'nostr-tools/nip19';
import * as nip04 from 'nostr-tools/nip04';
import * as nip47 from 'nostr-tools/nip47';
// Methods same as v1, just import path changes
```

---

## MIGRATION PLAN (4 Phases)

### Phase 1: Update package.json
```bash
npm install nostr-tools@latest
```

### Phase 2: Migrate AuthService.ts (CRITICAL)
**Lines to change:**
```typescript
// Line 10: Change imports
- import { getPublicKey, getSignature, getEventHash, UnsignedEvent, nip19 } from 'nostr-tools';
+ import { getPublicKey, finalizeEvent, type UnsignedEvent } from 'nostr-tools/pure';
+ import { nip19 } from 'nostr-tools/nip19';
+ import { hexToBytes } from '@noble/hashes/utils';

// Line 217: No change (getPublicKey works same, but takes Uint8Array)
// Already gets hex string from nip19.decode, needs conversion:
- const pubkey = getPublicKey(privateKey);
+ const pubkey = getPublicKey(hexToBytes(privateKey));

// Lines 664-677: Replace manual signing
- const decoded = nip19.decode(this.nsec);
- if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
- const privateKey = decoded.data as string;
- event.pubkey = this.currentUser!.pubkey;
- event.id = getEventHash(event as UnsignedEvent);
- event.sig = getSignature(event as UnsignedEvent, privateKey);
- return event;
+ const decoded = nip19.decode(this.nsec);
+ if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
+ const privateKey = decoded.data as string;
+ return finalizeEvent(event, hexToBytes(privateKey));
```

### Phase 3: Migrate ZapService + NWCService
```typescript
// ZapService.ts Line 8:
- import { finishEvent } from 'nostr-tools';
+ import { finalizeEvent } from 'nostr-tools/pure';
// Find usage, replace finishEvent → finalizeEvent

// NWCService.ts Line 8:
- import { SimplePool, type Event as NostrEvent, nip04, nip19, nip47, finishEvent, getPublicKey } from 'nostr-tools';
+ import { SimplePool, type Event as NostrEvent } from 'nostr-tools/pool';
+ import { nip04 } from 'nostr-tools/nip04';
+ import { nip19 } from 'nostr-tools/nip19';
+ import { nip47 } from 'nostr-tools/nip47';
+ import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
+ import { hexToBytes } from '@noble/hashes/utils';
// Replace finishEvent → finalizeEvent in usage
```

### Phase 4: Migrate NIP-19 imports (17 files)
```bash
# Use sed or Edit tool:
's/from '\''nostr-tools'\''/from '\''nostr-tools\/nip19'\''/'
# For files importing ONLY nip19
```

**Files:**
ProfileView, SingleNoteView, AnalyticsModal, PostNoteModal, QuotedNoteRenderer, LongFormOrchestrator, QuoteOrchestrator, hexToNpub, npubToHex, encodeNevent, renderQuotePreview, ReplyIndicator, NoteMenu, FollowingListModal, ThreadContextIndicator, NoteStructureBuilder, RepostRenderer, ArticlePreviewRenderer, FallbackElementFactory

### Phase 5: Fix ReportService.ts
```typescript
// Line 18:
- import { finalizeEvent } from 'nostr-tools';
+ import { finalizeEvent } from 'nostr-tools/pure';
```

### Phase 6: Build & Test
1. `npm run build` - Must succeed (0 errors)
2. Test in dev: `npm run tauri dev`
3. Test nsec login + post
4. Test extension login + post
5. Test KeySigner login + post
6. Test npub read-only
7. `npm run tauri build` - Final check

---

## ROLLBACK PLAN

If migration fails:
```bash
npm install nostr-tools@^1.17.0
git checkout -- src/
```

---

## ❌ PREVIOUS MIGRATION ATTEMPTS (FAILED & ROLLED BACK)

**Attempts:** 4x
**Status:** All failed and rolled back
**Last Attempt:** 2025-10-26

### Why They Failed:
1. Too many files to change at once (97 direct imports)
2. Context memory limitations during migration
3. Complex behavioral differences between v1/v2
4. Difficult to isolate and debug problems
5. App became unstable, rollback was necessary

### Lessons Learned:
- Cannot do big-bang migration
- Need incremental approach
- Need isolation layer for easier debugging
- **Solution:** Create abstraction layer FIRST

---

*Status: Migration NOT complete. Ready to implement abstraction layer approach.*

---

## 🔄 ABSTRACTION LAYER APPROACH (NEW STRATEGY)

**Date:** 2025-11-02
**Status:** PLANNING
**Reason:** Previous 4 migration attempts failed due to:
- Too many files to change at once (97 direct imports)
- Context memory limitations
- Complex behavioral changes between v1/v2
- Difficult to isolate problems

### Strategy: Create Adapter Layer FIRST

**Goal:** Isolate all nostr-tools usage in ONE place before migration

**Benefits:**
1. **Risk Reduction:** Change implementation once, not 97 times
2. **Easy Rollback:** If v2 breaks, revert adapter only
3. **Better Testing:** Test adapter in isolation
4. **Clear Boundaries:** All nostr-tools calls go through adapter

---

## Phase 0: Create NostrToolsAdapter (NEW)

**File:** `src/services/NostrToolsAdapter.ts`

### Current Usage Analysis (97 files):

**Function Groups:**

1. **NIP-19 Encoding/Decoding** (most common - ~50 files)
   - `nip19.decode()` - npub/nsec/nevent/naddr → data
   - `nip19.npubEncode()` - pubkey → npub
   - `nip19.neventEncode()` - event → nevent
   - `nip19.naddrEncode()` - long-form → naddr
   - `nip19.nsecEncode()` - private key → nsec

2. **Event Signing** (critical - AuthService, NWCService, ZapService)
   - `getPublicKey()` - derive pubkey from private key
   - `getEventHash()` - calculate event ID
   - `getSignature()` - sign event
   - v1: 3 separate calls | v2: `finalizeEvent()` does all

3. **Encryption** (NWCService only)
   - `nip04.encrypt()` / `nip04.decrypt()`
   - `nip47.*` - NWC protocol

4. **Types** (everywhere)
   - `Event`, `UnsignedEvent`, `Filter`, `Relay`

### Adapter API Design:

```typescript
// src/services/NostrToolsAdapter.ts

/**
 * NostrToolsAdapter
 * Central abstraction layer for nostr-tools library
 *
 * Purpose: Isolate all nostr-tools usage to enable safe v1→v2 migration
 * Currently implements v1 API, will be switched to v2 later
 */

// ============= NIP-19 FUNCTIONS =============

export function decodeNip19(encoded: string): DecodeResult {
  // v1: import { nip19 } from 'nostr-tools';
  // v2: import * as nip19 from 'nostr-tools/nip19';
  // Implementation stays same, just import path changes
}

export function encodeNpub(pubkey: string): string {
  // Wrapper for nip19.npubEncode()
}

export function encodeNevent(eventId: string, relays?: string[]): string {
  // Wrapper for nip19.neventEncode()
}

export function encodeNaddr(params: {
  pubkey: string;
  kind: number;
  identifier: string;
  relays?: string[]
}): string {
  // Wrapper for nip19.naddrEncode()
}

export function encodeNsec(privateKey: string): string {
  // Wrapper for nip19.nsecEncode()
}

// ============= EVENT SIGNING =============

export function getPublicKeyFromPrivate(privateKeyHex: string): string {
  // v1: getPublicKey(hex) → hex
  // v2: getPublicKey(Uint8Array) → hex (needs hexToBytes conversion)
}

export async function signEvent(
  event: UnsignedEvent,
  privateKeyHex: string
): Promise<Event> {
  // v1: Manual getEventHash + getSignature + build event
  // v2: finalizeEvent(event, hexToBytes(privateKey))
  // This is the MOST CRITICAL function - all signing goes here
}

// ============= ENCRYPTION =============

export async function nip04Encrypt(
  privateKey: string,
  publicKey: string,
  plaintext: string
): Promise<string> {
  // Wrapper for nip04.encrypt()
}

export async function nip04Decrypt(
  privateKey: string,
  publicKey: string,
  ciphertext: string
): Promise<string> {
  // Wrapper for nip04.decrypt()
}

// ============= TYPES =============

export type { Event, UnsignedEvent, Filter, Relay } from 'nostr-tools';
// These types work in both v1 and v2
```

---

## Migration Steps with Adapter

### Step 1: Create Adapter (v1 implementation)
- File: `src/services/NostrToolsAdapter.ts`
- Implement all functions using current v1 API
- Export types

### Step 2: Migrate Files to Use Adapter (incremental)
- Replace direct nostr-tools imports with adapter
- Do 10-20 files at a time, test after each batch
- Start with simple files (helpers), then components, then services

### Step 3: Switch Adapter to v2 (single point of change)
- Update package.json: `nostr-tools@latest`
- Update adapter implementation only
- All 97 files automatically use v2 via adapter

### Step 4: Test & Fix Edge Cases
- Test all auth methods
- Test posting, signing, encryption
- Fix any behavioral differences in adapter

---

## Implementation Order

1. **NIP-19 Functions** (easiest, most files)
   - Low risk, API mostly unchanged
   - Start with helpers: hexToNpub, npubToHex, encodeNevent

2. **Type Imports** (trivial)
   - Just re-export from adapter

3. **Event Signing** (most critical)
   - AuthService, NWCService, ZapService
   - High risk, requires careful testing

4. **Encryption** (isolated)
   - Only NWCService uses this
   - Test with real NWC wallet

---

*Status: Abstraction layer approach planned. Ready to implement Phase 0.*
