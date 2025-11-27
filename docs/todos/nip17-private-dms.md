# NIP-17 Private Direct Messages - Implementation Plan

## Overview

NIP-17 defines encrypted private DMs using a three-layer encryption model:
- **NIP-44**: Modern encryption (replaces NIP-04)
- **NIP-59**: Gift Wrap + Seal structure for metadata protection

## Architecture: Three Layers

```
┌─────────────────────────────────────┐
│  Gift Wrap (kind:1059)              │  ← Signed by RANDOM ephemeral key
│  - Hides sender identity            │  ← Randomized timestamp
│  - p-tag: recipient pubkey          │
│  ┌─────────────────────────────┐    │
│  │  Seal (kind:13)             │    │  ← NIP-44 encrypted
│  │  - Signed by SENDER         │    │  ← Randomized timestamp
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

## Message Flow

### Sending a DM

```typescript
// 1. Create unsigned Rumor (kind:14)
const rumor = {
  kind: 14,
  pubkey: senderPubkey,
  created_at: randomizedTimestamp(),
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
  created_at: randomizedTimestamp(),
  tags: [],
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
  created_at: randomizedTimestamp(),
  tags: [['p', recipientPubkey]],
  content: giftWrapContent
}, ephemeralKey.privkey);

// 4. Send to recipient's DM relays (kind:10050)
// 5. Also send copy to SELF (wrap for own pubkey)
```

### Receiving a DM

```typescript
// 1. Receive Gift Wrap (kind:1059)
// 2. Decrypt with own privkey → Seal
const seal = JSON.parse(nip44Decrypt(
  giftWrap.content,
  myPrivkey,
  giftWrap.pubkey  // ephemeral pubkey
));

// 3. Verify seal signature
// 4. Decrypt seal with sender's pubkey → Rumor
const rumor = JSON.parse(nip44Decrypt(
  seal.content,
  myPrivkey,
  seal.pubkey  // sender's pubkey
));

// 5. Store rumor as queryable message
```

## nostrdb Approach (Reference)

Damus/nostrdb automatically unwraps gift wraps and stores rumors in the database:

```c
// From nostrdb PR #100 - NIP-44 decrypt support
// Dependencies: libsodium, HKDF, HMAC, ChaCha20

// Key derivation:
// 1. ECDH shared secret (sender privkey × recipient pubkey)
// 2. HMAC-SHA256 with salt "nip44-v2" → conversation key
// 3. HKDF-expand → 76 bytes (32 chacha key + 12 nonce + 32 auth key)

// Decryption:
// 1. Validate MAC
// 2. ChaCha20-IETF decrypt
// 3. Remove padding
```

**Benefits of auto-unwrap:**
- Rumors stored as normal notes → queryable
- One-time decryption cost
- Efficient conversation threading

## Implementation Plan for Noornote

### Phase 1: NIP-44 Encryption
- [ ] Implement NIP-44 encrypt/decrypt using nostr-tools or WebCrypto
- [ ] Test vectors from NIP-44 spec

### Phase 2: Gift Wrap Handling
- [ ] Receive kind:1059 events
- [ ] Unwrap: Gift Wrap → Seal → Rumor
- [ ] Store decrypted rumors in indexedDB
- [ ] Mark as "private" in storage

### Phase 3: Sending DMs
- [ ] Create unsigned rumor (kind:14)
- [ ] Wrap in seal (kind:13)
- [ ] Wrap in gift wrap (kind:1059)
- [ ] Generate ephemeral keypair
- [ ] Send to recipient's DM relays (kind:10050)
- [ ] Send copy to self

### Phase 4: UI
- [ ] DM inbox view
- [ ] Conversation threads
- [ ] Compose DM modal
- [ ] DM relay settings (kind:10050)

## Security Considerations

1. **Deniability**: Rumors are unsigned → cannot prove authorship
2. **Metadata protection**: Gift wrap hides sender, timestamps randomized
3. **Relay AUTH**: Relays should only serve kind:1059 to intended recipient
4. **Key management**: Ephemeral keys must be truly random
5. **Timestamp randomization**: ±48h recommended to thwart timing analysis

## References

- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)
- [nostrdb NIP-44 PR](https://github.com/damus-io/nostrdb/pull/100)
- nostr-tools: `nip44.encrypt()`, `nip44.decrypt()`
