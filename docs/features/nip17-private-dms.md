# NIP-17 Private Direct Messages - Implementation Plan

## Status: ✅ Implemented (2025-12-06)

## Overview

NIP-17 defines encrypted private DMs using a three-layer encryption model:
- **NIP-44**: Modern encryption (replaces NIP-04)
- **NIP-59**: Gift Wrap + Seal structure for metadata protection

**Industry Status (Stand Dez 2025):**
- jb55 (Damus): NIP-44 decryption merged into nostrdb, working on gift wrap support
- KernelKind: Building NIP-17 DM app in notedeck/android
- NDK: Vollständiger NIP-17/44/59 Support via `giftWrap`/`giftUnwrap` + `@nostr-dev-kit/messages`

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

| Kind | Name | NDK Constant | Purpose |
|------|------|--------------|---------|
| 14 | Chat Message | `NDKKind.PrivateDirectMessage` | The actual DM content (unsigned rumor) |
| 15 | File Message | - | Encrypted file sharing |
| 13 | Seal | `NDKKind.GiftWrapSeal` | Encrypted wrapper, signed by sender |
| 1059 | Gift Wrap | `NDKKind.GiftWrap` | Outer wrapper, signed by ephemeral key |
| 10050 | DM Relay List | `NDKKind.DirectMessageReceiveRelayList` | User's preferred relays for receiving DMs |

---

## NoorNote: Aktueller Stand

### Bestehende Infrastruktur (können wir nutzen)

**NIP-04/NIP-44 Encryption bereits vorhanden:**
- `src/services/KeySignerClient.ts` - `nip04Encrypt()`, `nip04Decrypt()`, `nip44Encrypt()`, `nip44Decrypt()`
- `src/services/managers/Nip46SignerManager.ts` - NIP-04/NIP-44 via Remote Signer
- `src/helpers/decryptPrivateFollows.ts` - Robustes Fallback-Pattern (NIP-44 first, NIP-04 fallback)
- `src/services/orchestration/GenericListOrchestrator.ts` - Verwendet NIP-44 mit NIP-04 fallback

**NDK bereits integriert:**
- `src/services/NostrTransport.ts` - NDK Singleton, alle Relay-Operationen

### Fehlende Infrastruktur (müssen wir bauen)

- **Kein DM-System** - `_messages.scss` ist nur UI-Feedback (success/error), nicht DMs
- **Kein Gift Wrap Support** - kind:1059, kind:13 nicht implementiert
- **Kein kind:10050 Support** - DM Relay List fehlt
- **Keine DM UI** - Inbox, Conversations, Compose

---

## NDK API Reference

### NIP-44 Encryption

NDK's Signer-Interface bietet NIP-44 direkt an:

```typescript
// Verschlüsseln
const encrypted = await signer.encrypt(
  recipientUser,    // NDKUser
  plaintext,        // string
  "nip44"           // NDKEncryptionScheme
);

// Entschlüsseln
const decrypted = await signer.decrypt(
  senderUser,       // NDKUser
  ciphertext,       // string
  "nip44"           // NDKEncryptionScheme
);

// Prüfen ob Signer NIP-44 unterstützt
const supported = await signer.encryptionEnabled("nip44");
```

**Event-Level Encryption:**
```typescript
const event = new NDKEvent(ndk);
event.content = "Secret message";

// Encrypt event content
await event.encrypt(recipientUser, signer, "nip44");

// Decrypt event content
await event.decrypt(senderUser, signer, "nip44");
```

### NIP-59 Gift Wrapping

NDK bietet High-Level Funktionen für Gift Wrap:

```typescript
import { giftWrap, giftUnwrap, NDKEvent, NDKKind } from "@nostr-dev-kit/ndk";

// === SENDEN ===

// 1. Rumor erstellen (kind:14, UNSIGNED)
const rumor = new NDKEvent(ndk);
rumor.kind = NDKKind.PrivateDirectMessage;  // 14
rumor.content = "Hello!";
rumor.created_at = Math.floor(Date.now() / 1000);
rumor.tags = [["p", recipientPubkey]];
// KEINE Signatur!

// 2. Gift Wrap erstellen (All-in-One: rumor → seal → wrap)
const wrapped = await giftWrap(
  rumor,           // NDKEvent (das Rumor)
  recipient,       // NDKUser (Empfänger)
  signer,          // NDKSigner (optional, default: ndk.signer)
  {
    scheme: "nip44"  // GiftWrapParams (optional)
  }
);
// Returns: NDKEvent mit kind:1059, ready to publish

// 3. Publishen
await wrapped.publish();

// === EMPFANGEN ===

// Gift Wrap entschlüsseln
const rumor = await giftUnwrap(
  wrappedEvent,    // NDKEvent (kind:1059)
  sender,          // NDKUser (optional, für Verifikation)
  signer,          // NDKSigner (optional)
  "nip44"          // NDKEncryptionScheme
);
// Returns: NDKEvent (das entschlüsselte Rumor, kind:14)
```

### High-Level: @nostr-dev-kit/messages

NDK bietet ein dediziertes Messages-Package für DM-Management:

```typescript
import { NDKMessenger, NDKConversation, NDKMessage } from "@nostr-dev-kit/messages";

// Messenger initialisieren
const messenger = new NDKMessenger(ndk);
await messenger.start();

// Nachricht senden
const message = await messenger.sendMessage(recipientUser, "Hello!");

// Conversations abrufen
const conversations = await messenger.getConversations();
const conversation = await messenger.getConversation(user);

// Conversation-Operationen
const messages = await conversation.getMessages(50);
await conversation.sendMessage("Reply!");
await conversation.markAsRead();
const unread = conversation.getUnreadCount();

// DM Relay List publishen (kind:10050)
await messenger.publishDMRelays(["wss://relay1.com", "wss://relay2.com"]);
```

**Storage Adapters:**
- `MemoryAdapter` - In-Memory (default)
- `NDKCacheAdapterDexie` - IndexedDB Persistenz

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

**Fetching mit NDK:**
```typescript
const filter = { kinds: [NDKKind.DirectMessageReceiveRelayList], authors: [recipientPubkey] };
const dmRelayEvent = await ndk.fetchEvent(filter);
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

## Message Flow mit NDK

### Sending a DM

```typescript
import { giftWrap, NDKEvent, NDKKind, NDKUser } from "@nostr-dev-kit/ndk";

// 1. Recipient's DM Relays fetchen (kind:10050)
const dmRelayEvent = await ndk.fetchEvent({
  kinds: [NDKKind.DirectMessageReceiveRelayList],
  authors: [recipientPubkey]
});
const dmRelays = dmRelayEvent?.tags
  .filter(t => t[0] === 'relay')
  .map(t => t[1]) || [];

// 2. Rumor erstellen (kind:14, UNSIGNED)
const rumor = new NDKEvent(ndk);
rumor.kind = NDKKind.PrivateDirectMessage;
rumor.content = "Hello!";
rumor.created_at = Math.floor(Date.now() / 1000);
rumor.tags = [["p", recipientPubkey]];

// 3. Gift Wrap für Empfänger
const recipient = ndk.getUser({ pubkey: recipientPubkey });
const wrappedForRecipient = await giftWrap(rumor, recipient);

// 4. An Empfänger's DM Relays publishen
await wrappedForRecipient.publish(dmRelays);

// 5. Self-Copy: Gift Wrap für sich selbst (WICHTIG!)
const self = ndk.getUser({ pubkey: myPubkey });
const wrappedForSelf = await giftWrap(rumor, self);
await wrappedForSelf.publish();
```

### Receiving DMs

```typescript
import { giftUnwrap, NDKKind } from "@nostr-dev-kit/ndk";

// 1. Subscribe to kind:1059 where p-tag = myPubkey
const sub = ndk.subscribe({
  kinds: [NDKKind.GiftWrap],
  "#p": [myPubkey]
});

sub.on("event", async (wrappedEvent) => {
  try {
    // 2. Unwrap
    const rumor = await giftUnwrap(wrappedEvent);

    // 3. Verify sender (NDK macht das intern)
    console.log("From:", rumor.pubkey);
    console.log("Message:", rumor.content);

    // 4. Store in indexedDB
    await dmStore.saveMessage(rumor);

  } catch (error) {
    console.error("Failed to unwrap:", error);
  }
});
```

---

## Implementation Plan for NoorNote

### Phase 1: NDK Gift Wrap Integration ✅
- [x] Verify `giftWrap`/`giftUnwrap` imports from NDK work
- [x] Test encrypt/decrypt round-trip mit NDK Signer
- [x] Entscheiden: Core NDK (manuell implementiert, nicht @nostr-dev-kit/messages)

### Phase 2: DM Storage (indexedDB) ✅
- [x] Create DMStore schema (conversations, messages)
- [x] Store unwrapped rumors
- [x] Index by conversation partner
- [x] Support conversation threading (e-tag replies)

### Phase 3: Receiving DMs ✅
- [x] Subscribe to kind:1059 with p-tag filter
- [x] Unwrap via custom implementation → store in DMStore
- [x] Background subscription (like notifications)
- [x] Unread counter

### Phase 4: Sending DMs ✅
- [x] Create kind:14 rumor via NDKEvent
- [x] Wrap mit custom `createGiftWrap()`
- [x] Fetch recipient's kind:10050 relay list
- [x] Publish to those relays + user's default relays
- [x] Send copy to self (wichtig!)

### Phase 5: Relay Settings Integration ✅
- [x] "DM Inbox" Toggle funktional machen
- [x] Speichern welche Relays als Inbox markiert sind (localStorage)
- [x] kind:10050 Event publishen wenn Inbox-Relays geändert werden
- [x] Screenshot: `screenshots/inbox-relay.png`

### Phase 6: UI ✅
- [x] "Messages" Menüpunkt in Sidebar bereits vorhanden → angebunden
- [x] MessagesView erstellt (conversations list mit Known/Unknown Tabs)
- [x] ConversationView (message thread)
- [ ] Compose DM modal (TODO: not yet implemented)
- [x] Unread badges in sidebar neben "Messages"
- [x] Mute-Integration in ConversationView

### Phase 7: Polish (Teilweise)
- [x] Conversation key caching (performance)
- [ ] Read receipts (optional - nicht geplant)
- [ ] Disappearing messages (expiration tag - nicht geplant)
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

1. **NDK Package Choice**: Core `giftWrap`/`giftUnwrap` oder `@nostr-dev-kit/messages`?
2. **Storage Strategy**: indexedDB only? Oder auch localStorage cache?
3. **Background Sync**: Wie oft kind:1059 fetchen? Interval?
4. **Notification Integration**: DM-Notifications in bestehendes System?
5. **Migration**: NIP-04 DMs importieren? (Falls User alte DMs hat)

---

## References

- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)
- [NDK GitHub](https://github.com/nostr-dev-kit/ndk)
- [NDK Documentation](https://nostr-dev-kit.github.io/ndk/)

**Lokale NDK-Referenzen:**
- Gift Wrapping: `../NDK/core/src/events/gift-wrapping.ts`
- Encryption: `../NDK/core/src/events/encryption.ts`
- Messages Package: `../NDK/messages/src/protocols/nip17.ts`
- Example: `../NDK/core/examples/nip-17-dms/`

---

## Implementation Insights (aus Code-Analyse)

### NDK Gift Wrap Implementation

**Aus `/NDK/core/src/events/gift-wrapping.ts`:**
- `giftWrap()` handled komplette Pipeline: rumor → seal (kind:13) → wrap (kind:1059)
- Auto-setzt `pubkey` wenn fehlend
- Supports NIP-44 encryption via `params.scheme`
- Cache-Support für entschlüsselte Events

**Timestamp-Logik:**
```typescript
// Rumor: ECHTER Timestamp (für Sortierung)
// Seal: RANDOMISIERT (±48h)
// Wrap: RANDOMISIERT (±48h)
```

**Anti-Spoofing:**
- NDK validiert intern: `rumor.pubkey === seal.pubkey`
- Verhindert dass jemand fremde Nachrichten als eigene ausgibt

### Lessons Learned

1. **Rumor behält echten Timestamp** - nur Seal/Wrap werden randomisiert
2. **Sender-Verifikation** - NDK macht das automatisch beim Unwrap
3. **Self-Copy nicht vergessen** - eigene Nachrichten auch an sich selbst wrappen
4. **NDKMessenger** - High-Level Alternative falls mehr Abstraktion gewünscht

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

**Fazit:** Mit NDK haben wir bereits vollständigen NIP-17 Support - wir sind Damus/notedeck voraus!
