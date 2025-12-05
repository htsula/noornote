# NIP-17 Private Direct Messages - Implementation Plan

## Status: Research Complete (2025-12-05)

## Overview

NIP-17 defines encrypted private DMs using a three-layer encryption model:
- **NIP-44**: Modern encryption (replaces NIP-04)
- **NIP-59**: Gift Wrap + Seal structure for metadata protection

**Industry Status (Stand Nov 2025):**
- jb55 (Damus): NIP-44 decryption merged into nostrdb, working on gift wrap support
- KernelKind: Building NIP-17 DM app in notedeck/android
- Kaum andere Clients unterstützen NIP-17 bisher

## Architecture: Three Layers

```
┌─────────────────────────────────────┐
│  Gift Wrap (kind:1059)              │  ← Signed by RANDOM ephemeral key
│  - Hides sender identity            │  ← Randomized timestamp (±48h)
│  - p-tag: recipient pubkey          │
│  ┌─────────────────────────────┐    │
│  │  Seal (kind:13)             │    │  ← NIP-44 encrypted
│  │  - Signed by SENDER         │    │  ← Randomized timestamp
│  │  - tags: [] (MUST be empty) │    │
│  │  ┌─────────────────────┐    │    │
│  │  │  Rumor (kind:14)    │    │    │  ← NIP-44 encrypted
│  │  │  - UNSIGNED         │    │    │  ← Deniability!
│  │  │  - Actual message   │    │    │
│  │  └─────────────────────┘    │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

## Event Kinds

| Kind | Name | Purpose |
|------|------|---------|
| 14 | Chat Message | The actual DM content (unsigned rumor) |
| 15 | File Message | Encrypted file sharing |
| 13 | Seal | Encrypted wrapper, signed by sender |
| 1059 | Gift Wrap | Outer wrapper, signed by ephemeral key |
| 10050 | DM Relay List | User's preferred relays for receiving DMs |

---

## NoorNote: Aktueller Stand

### Bestehende Infrastruktur (können wir nutzen)

**NIP-04/NIP-44 Encryption bereits vorhanden:**
- `src/services/KeySignerClient.ts` - `nip04Encrypt()`, `nip04Decrypt()`, `nip44Encrypt()`, `nip44Decrypt()`
- `src/services/managers/Nip46SignerManager.ts` - NIP-04/NIP-44 via Remote Signer
- `src/helpers/decryptPrivateFollows.ts` - Robustes Fallback-Pattern (NIP-44 first, NIP-04 fallback)
- `src/services/orchestration/GenericListOrchestrator.ts` - Verwendet NIP-44 mit NIP-04 fallback

**NostrToolsAdapter:**
- `src/services/NostrToolsAdapter.ts` - Re-exportiert nip04 für NWC

### Fehlende Infrastruktur (müssen wir bauen)

- **Kein DM-System** - `_messages.scss` ist nur UI-Feedback (success/error), nicht DMs
- **Kein Gift Wrap Support** - kind:1059, kind:13 nicht implementiert
- **Kein kind:10050 Support** - DM Relay List fehlt
- **Keine DM UI** - Inbox, Conversations, Compose

---

## nostr-tools API Reference

### NIP-44 (`nostr-tools/nip44`)

```typescript
import * as nip44 from 'nostr-tools/nip44';

// Conversation Key ableiten (einmalig pro Chat-Partner)
const conversationKey = nip44.v2.utils.getConversationKey(
  myPrivkeyBytes,      // Uint8Array (32 bytes)
  recipientPubkeyHex   // string (hex)
);

// Verschlüsseln
const payload = nip44.v2.encrypt(
  plaintext,           // string (1-65535 bytes)
  conversationKey,     // Uint8Array (32 bytes)
  nonce?               // optional Uint8Array (32 bytes), default: random
);
// Returns: base64 string (version + nonce + ciphertext + MAC)

// Entschlüsseln
const plaintext = nip44.v2.decrypt(
  payload,             // base64 string
  conversationKey      // Uint8Array (32 bytes)
);

// Padded Length berechnen (für Tests)
const paddedLen = nip44.v2.utils.calcPaddedLen(unpaddedLen);
```

**Crypto Dependencies (von @noble):**
- `@noble/ciphers/chacha` - ChaCha20 encryption
- `@noble/curves/secp256k1` - ECDH key agreement
- `@noble/hashes/hkdf` - Key derivation (HKDF-SHA256)
- `@noble/hashes/hmac` - Authentication tags
- `@scure/base` - Base64 encoding

### NIP-59 (`nostr-tools/nip59`)

```typescript
import {
  createRumor,
  createSeal,
  createWrap,
  wrapEvent,
  wrapManyEvents,
  unwrapEvent,
  unwrapManyEvents
} from 'nostr-tools/nip59';

// === SENDEN ===

// Option A: Manuell (mehr Kontrolle)
const rumor = createRumor(
  { kind: 14, content: 'Hello!', tags: [['p', recipientPubkey]] },
  senderPrivkey  // Uint8Array
);
// Returns: Rumor (UnsignedEvent & { id: string })

const seal = createSeal(
  rumor,
  senderPrivkey,       // Uint8Array
  recipientPubkey      // string (hex)
);
// Returns: NostrEvent (kind:13, signed by sender)

const giftWrap = createWrap(
  seal,
  recipientPubkey      // string (hex)
);
// Returns: NostrEvent (kind:1059, signed by ephemeral key)

// Option B: All-in-One
const giftWrap = wrapEvent(
  { kind: 14, content: 'Hello!', tags: [['p', recipientPubkey]] },
  senderPrivkey,       // Uint8Array
  recipientPubkey      // string (hex)
);

// Option C: Multiple Recipients (+ self copy)
const giftWraps = wrapManyEvents(
  { kind: 14, content: 'Hello group!', tags: [['p', pub1], ['p', pub2]] },
  senderPrivkey,
  [pub1, pub2, senderPubkey]  // Include self!
);

// === EMPFANGEN ===

const rumor = unwrapEvent(
  giftWrap,            // NostrEvent (kind:1059)
  myPrivkey            // Uint8Array
);
// Returns: Rumor

// Batch unwrap + sort by timestamp
const rumors = unwrapManyEvents(wrappedEvents, myPrivkey);
```

---

## kind:10050 DM Relay List

Users publizieren ihre bevorzugten DM-Relays:

```json
{
  "kind": 10050,
  "pubkey": "<user-pubkey>",
  "created_at": 1234567890,
  "tags": [
    ["relay", "wss://relay1.example.com"],
    ["relay", "wss://relay2.example.com"],
    ["relay", "wss://relay3.example.com"]
  ],
  "content": "",
  "id": "...",
  "sig": "..."
}
```

**Empfehlungen:**
- 1-3 Relays (klein halten)
- Relays sollten AUTH (NIP-42) unterstützen
- kind:1059 nur an markierten Empfänger ausliefern

**💡 Insider-Tipp: nostr1.com Relays**

nostr1.com bietet kostenlose Relays für User an (z.B. `wss://nostr1.com`, `wss://xxx.nostr1.com`).
Diese sind **automatisch auch als Inbox-Relays für NIP-17 konfiguriert**!

- Kaum bekannt in der Community
- Kostenlos nutzbar
- Gute Option für Default-DM-Relays in NoorNote
- Wenn User bereits ein nostr1.com Relay hat, funktionieren DMs sofort

**Fetching:**
```typescript
const filter = { kinds: [10050], authors: [recipientPubkey] };
const dmRelayEvent = await transport.fetchOne(filter);
const relays = dmRelayEvent?.tags
  .filter(t => t[0] === 'relay')
  .map(t => t[1]) || [];
```

---

## kind:14 Chat Message (Rumor)

```json
{
  "kind": 14,
  "pubkey": "<sender-pubkey>",
  "created_at": 1234567890,
  "tags": [
    ["p", "<recipient-pubkey>", "<relay-url-hint>"],
    ["e", "<reply-to-event-id>", "<relay>", "reply"],
    ["subject", "Conversation Title"]
  ],
  "content": "Plain text message only!",
  "id": "<computed-hash>"
}
```

**Wichtig:**
- **Keine Signatur!** (Deniability)
- `p` tags = Empfänger (mehrere = Group Chat)
- `e` tags = Reply-Chain
- `subject` = Conversation-Titel (neuester gilt)
- `content` = Nur Plain Text

---

## Group Chat Support

NIP-17 unterstützt Gruppen via mehrere `p` tags:

```typescript
// Group = pubkey + alle p-tags
const groupMembers = [senderPubkey, ...pTags.map(t => t[1])];

// Neue Gruppe = anderer p-tag Set
// Subject kann von jedem Member geändert werden
```

**Für MVP ignorieren** - erst Single-DMs implementieren.

---

## Message Flow (Detailliert)

### Sending a DM

```typescript
// 1. Create unsigned Rumor (kind:14)
const rumor = {
  kind: 14,
  pubkey: senderPubkey,
  created_at: randomizedTimestamp(-48h to now),
  tags: [['p', recipientPubkey]],
  content: 'Hello!'
  // NO signature!
};

// 2. Encrypt rumor → Seal (kind:13)
const sealContent = nip44Encrypt(
  JSON.stringify(rumor),
  senderPrivkey,
  recipientPubkey
);
const seal = signEvent({
  kind: 13,
  pubkey: senderPubkey,
  created_at: randomizedTimestamp(-48h to now),
  tags: [],  // MUST be empty!
  content: sealContent
}, senderPrivkey);

// 3. Encrypt seal → Gift Wrap (kind:1059)
const ephemeralKey = generateRandomKeypair();
const giftWrapContent = nip44Encrypt(
  JSON.stringify(seal),
  ephemeralKey.privkey,
  recipientPubkey
);
const giftWrap = signEvent({
  kind: 1059,
  pubkey: ephemeralKey.pubkey,
  created_at: randomizedTimestamp(-48h to now),
  tags: [['p', recipientPubkey]],
  content: giftWrapContent
}, ephemeralKey.privkey);

// 4. Fetch recipient's DM relays (kind:10050)
// 5. Publish to those relays
// 6. Also send copy to SELF (wrap for own pubkey!)
```

### Receiving a DM

```typescript
// 1. Subscribe to kind:1059 where p-tag = myPubkey
const filter = { kinds: [1059], '#p': [myPubkey] };

// 2. For each gift wrap received:
const rumor = unwrapEvent(giftWrap, myPrivkey);

// 3. Verify sender (seal.pubkey must match rumor.pubkey)
// 4. Store unwrapped rumor in indexedDB
// 5. Display in conversation thread
```

---

## nostrdb Approach (Reference)

Damus/nostrdb automatically unwraps gift wraps and stores rumors in the database:

```c
// From nostrdb PR #100 - NIP-44 decrypt support
// Dependencies: libsodium, HKDF, HMAC, ChaCha20

// Key derivation:
// 1. ECDH shared secret (sender privkey × recipient pubkey)
// 2. HKDF-extract with salt "nip44-v2" → conversation key
// 3. HKDF-expand → 76 bytes (32 chacha key + 12 nonce + 32 auth key)

// Decryption:
// 1. Validate MAC (constant-time comparison!)
// 2. ChaCha20-IETF decrypt
// 3. Remove padding
```

**Benefits of auto-unwrap:**
- Rumors stored as normal notes → queryable
- One-time decryption cost
- Efficient conversation threading

**jb55 Update (26. Nov 2025):**
> "#nip44 decryption merged into nostrdb, working on first class giftwrap support now. The idea is nostrdb will automatically unwrap the giftwrap and seal for you, storing the rumor in the database as a note that is queryable."

---

## NIP-44 Test Vectors

Test vectors verfügbar unter: `nip44.vectors.json`
SHA256: `269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040`

**Beispiel:**
```json
{
  "sec1": "0000...0001",
  "sec2": "0000...0002",
  "conversation_key": "c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d",
  "plaintext": "a",
  "payload": "AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABee0G5VSK0/9YypIObAtDKfYEAjD35uVkHyB0F4DwrcNaCXlCWZKaArsGrY6M9wnuTMxWfp1RTN9Xga8no+kF5Vsb"
}
```

**Test-Kategorien:**
- Conversation key calculation
- Message key derivation
- Padding length computation
- Encrypt/decrypt round-trips
- Invalid input handling

**Reference Implementations:** https://github.com/paulmillr/nip44
**Security Audit:** Cure53 (Dezember 2023)

---

## Implementation Plan for Noornote

### Phase 1: NIP-44/NIP-59 Integration
- [ ] Verify nostr-tools nip44/nip59 imports work
- [ ] Add to NostrToolsAdapter if needed
- [ ] Test encrypt/decrypt with test vectors
- [ ] Test wrapEvent/unwrapEvent round-trip

### Phase 2: DM Storage (indexedDB)
- [ ] Create DMStore schema (conversations, messages)
- [ ] Store unwrapped rumors
- [ ] Index by conversation partner
- [ ] Support conversation threading (e-tag replies)

### Phase 3: Receiving DMs
- [ ] Subscribe to kind:1059 with p-tag filter
- [ ] Unwrap on receive → store in DMStore
- [ ] Background subscription (like notifications)
- [ ] Unread counter

### Phase 4: Sending DMs
- [ ] Create kind:14 rumor
- [ ] Wrap with nostr-tools nip59
- [ ] Fetch recipient's kind:10050 relay list
- [ ] Publish to those relays + user's default relays
- [ ] Send copy to self (wichtig!)

### Phase 5: Relay Settings Integration
- [ ] "DM Inbox" Toggle funktional machen (existiert bereits in UI!)
- [ ] Speichern welche Relays als Inbox markiert sind (localStorage)
- [ ] kind:10050 Event publishen wenn Inbox-Relays geändert werden
- [ ] Screenshot: `screenshots/inbox-relay.png`

### Phase 6: UI
- [ ] "Messages" Menüpunkt in Sidebar bereits vorhanden → anbinden
- [ ] MessagesView erstellen (conversations list)
- [ ] Conversation detail view (messages)
- [ ] Compose DM modal (from profile, from anywhere)
- [ ] Unread badges in sidebar neben "Messages"

### Phase 7: Polish
- [ ] Conversation key caching (performance)
- [ ] Read receipts (optional)
- [ ] Disappearing messages (expiration tag)
- [ ] Group DM support (später)

---

## Security Considerations

1. **Deniability**: Rumors are unsigned → cannot prove authorship
2. **Metadata protection**: Gift wrap hides sender, timestamps randomized ±48h
3. **Relay AUTH**: Relays should only serve kind:1059 to intended recipient
4. **Key management**: Ephemeral keys must be truly random (CSPRNG)
5. **Timestamp randomization**: Up to 2 days in the past (NIP-17 spec)
6. **Validation order**: Verify event signature BEFORE attempting decryption
7. **MAC comparison**: Must be constant-time to prevent timing attacks
8. **Seal tags**: MUST be empty array (no metadata leakage)

---

## Offene Fragen

1. **Storage Strategy**: indexedDB only? Oder auch localStorage cache?
2. **Background Sync**: Wie oft kind:1059 fetchen? Interval?
3. **Notification Integration**: DM-Notifications in bestehendes System?
4. **Migration**: NIP-04 DMs importieren? (Falls User alte DMs hat)

---

## References

- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)
- [nostrdb NIP-44 PR](https://github.com/damus-io/nostrdb/pull/100)
- [NIP-44 Reference Implementations](https://github.com/paulmillr/nip44)
- nostr-tools: `nip44.v2.encrypt()`, `nip44.v2.decrypt()`, `nip59.wrapEvent()`, `nip59.unwrapEvent()`

---

## Implementation Insights (aus Code-Analyse)

### nostrdb (C) - NIP-44 Decryption

**Error Codes** (nützlich für Debugging):
```c
NIP44_OK = 0
NIP44_ERR_UNSUPPORTED_ENCODING = 1
NIP44_ERR_INVALID_PAYLOAD = 2
NIP44_ERR_BASE64_DECODE = 3
NIP44_ERR_SECKEY_VERIFY_FAILED = 4
NIP44_ERR_PUBKEY_PARSE_FAILED = 5
NIP44_ERR_ECDH_FAILED = 6
NIP44_ERR_FILL_RANDOM_FAILED = 7
NIP44_ERR_INVALID_MAC = 8
NIP44_ERR_INVALID_PADDING = 9
```

**HMAC berechnet über:** `nonce (32 bytes) + ciphertext` (konkateniert)

**Padding-Format:** Erste 2 Bytes = Big-Endian Länge, dann Padding bis Power-of-2

### rust-nostr - NIP-59 Gift Wrap

**Timestamp Randomization Range:**
```rust
RANGE_RANDOM_TIMESTAMP_TWEAK: Range<u64> = 0..172800  // 2 Tage in Sekunden
```

**Anti-Spoofing Check:** `SenderMismatch` Error wenn `rumor.pubkey != seal.pubkey`
- Verhindert dass jemand fremde Nachrichten als eigene ausgibt!

### nostr-tools - NIP-59

**Timestamp-Logik (WICHTIG!):**
```typescript
const TWO_DAYS = 2 * 24 * 60 * 60  // 172800 seconds
const randomNow = () => Math.round(now() - Math.random() * TWO_DAYS)

// Rumor: ECHTER Timestamp (für Sortierung)
// Seal: RANDOMISIERT
// Wrap: RANDOMISIERT
```

**wrapManyEvents:**
- Fügt Sender automatisch zur Empfängerliste hinzu
- Throws Error wenn keine Empfänger

**unwrapManyEvents:**
- Sortiert entschlüsselte Events nach `created_at`

### Lessons Learned

1. **Rumor behält echten Timestamp** - nur Seal/Wrap werden randomisiert
2. **Sender-Verifikation ist Pflicht** - rumor.pubkey === seal.pubkey prüfen!
3. **Self-Copy nicht vergessen** - eigene Nachrichten auch an sich selbst wrappen
4. **Error Handling** - Spezifische Error-Typen für besseres Debugging

---

## Damus/Notedeck Status (Stand Dez 2025)

### nostrdb
- ✅ NIP-44 Decryption **MERGED** (PR #100, 26. Nov 2025)
- ⏳ Gift Wrap Support als nächstes

### notedeck
- 🔄 Issue #522: "DMs: gift wrap nip-17"
- **Milestone: Q1 2025** (aktiv in Arbeit)
- Blockiert durch nostrdb-rs Upgrade (#49)

### Damus iOS
- Issue #1737: "Explore DM gift wrap" (offen seit Nov 2023)
- PR #3263: NIP-17 Support **ABANDONED** (Okt 2025)
- ⚠️ Nutzt noch NIP-04 für DMs

**Fazit:** Wir sind zeitlich auf Augenhöhe mit Damus/notedeck!
