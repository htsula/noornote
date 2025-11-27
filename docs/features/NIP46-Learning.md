# NIP-46 & nostr-tools v2 Learning Documentation

**Research Start:** 2025-10-26
**Purpose:** Deep understanding before implementing NIP-46 + nostr-tools v2 migration

---

## nostr-tools v2 Core Changes

### Installation & Import Patterns

**Package Sources:**
- npm: `nostr-tools`
- JSR: `@nostr/tools`

**Import Pattern (Subpath Exports):**
```typescript
import { SimplePool } from 'nostr-tools/pool'
import { BunkerSigner } from 'nostr-tools/nip46'
import { nip04, nip44 } from 'nostr-tools/nip04' // or nip44
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
```

**Key Insight:** v2 uses subpath imports for tree-shaking. Instead of `import { SimplePool } from 'nostr-tools'`, we import from specific modules.

---

### SimplePool API (v2)

**Constructor with New Options:**
```typescript
const pool = new SimplePool({
  enablePing: true,        // NEW: Heartbeat to detect dead connections
  enableReconnect: true    // NEW: Auto-reconnect with exponential backoff
})
```

**Key Methods (unchanged from v1):**
- `.get(relays, filter)` - Fetch single event
- `.querySync(relays, filters)` - Fetch multiple events
- `.subscribe(relays, filters, { onevent, oneose })` - Real-time subscription
- `.publish(relays, event)` - Publish event

**Breaking Change Detection:** Need to compare with our current usage in `NostrTransport.ts`

---

### Event Handling Changes

**Event Signing (v2 Pattern):**
```typescript
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure'

const sk = generateSecretKey() // Returns Uint8Array
const pk = getPublicKey(sk)    // Returns hex string

const signedEvent = finalizeEvent({
  kind: 1,
  content: 'Hello',
  tags: [],
  created_at: Math.floor(Date.now() / 1000)
}, sk)
```

**Key Insight:** `finalizeEvent()` handles pubkey, id, and sig automatically. Single atomic operation.

---

### Encryption APIs

**NIP-04 (Legacy):**
- Still supported but deprecated
- Basic encrypt/decrypt

**NIP-44 v2 (Current Standard):**
- Modern encryption with better security
- Includes test vectors for validation
- **Used by NIP-46!**

```typescript
import { nip44 } from 'nostr-tools/nip44'
// TODO: Find exact API methods
```

---

## nostr-tools v2 nip46 Module

### BunkerSigner API

**Import:**
```typescript
import { BunkerSigner } from 'nostr-tools/nip46'
import { SimplePool } from 'nostr-tools/pool'
import { generateSecretKey } from 'nostr-tools/pure'
```

---

### Static Methods

#### `BunkerSigner.fromBunker(localSecretKey, bunkerPointer, options)`

**Use Case:** Bunker-initiated flow (user has `bunker://` URI)

**Parameters:**
- `localSecretKey`: `Uint8Array` - Client's ephemeral secret key for NIP-44 encryption
- `bunkerPointer`: `string` - The `bunker://` URI or NIP-05 identifier
- `options`: `{ pool: SimplePool }` - Pool instance for relay communication

**Returns:** `BunkerSigner` instance (synchronous)

**Important:** For **initial connection**, MUST call `await bunker.connect()` to establish authorization. For **reconnections** (session restore), `.connect()` is NOT needed.

**Example:**
```typescript
const localSk = generateSecretKey() // Or load from storage
const bunker = BunkerSigner.fromBunker(
  localSk,
  'bunker://abc123...?relay=wss://relay.example.com',
  { pool }
)

// First-time connection
await bunker.connect()

// Later reconnection (no .connect() needed)
const restored = BunkerSigner.fromBunker(storedSk, storedUri, { pool })
```

---

#### `BunkerSigner.fromURI(localSecretKey, connectionUri, options)`

**Use Case:** Client-initiated flow (bunker scans client's QR/URI)

**Parameters:**
- `localSecretKey`: `Uint8Array` - Client's ephemeral secret key
- `connectionUri`: `string` - The `nostrconnect://` URI to display
- `options`: `{ pool: SimplePool }` - Pool instance

**Returns:** `Promise<BunkerSigner>` - **Asynchronous!** Resolves only after bunker connects.

**Important:** No `.connect()` call needed - already connected when Promise resolves.

**Example:**
```typescript
const localSk = generateSecretKey()
const uri = `nostrconnect://${getPublicKey(localSk)}?relay=...&secret=...&perms=...`

// Display URI as QR code for bunker to scan
const signer = await BunkerSigner.fromURI(localSk, uri, { pool })
// Ready to use immediately
```

---

### Instance Methods

#### `bunker.getPublicKey()`

**Returns:** `Promise<string>` - User's actual public key (hex)

Calls the `get_public_key` RPC method on the remote signer.

```typescript
const userPubkey = await bunker.getPublicKey()
```

---

#### `bunker.signEvent(eventTemplate)`

**Parameters:**
- `eventTemplate`: `{ kind: number, content: string, tags: string[][], created_at: number }`

**Returns:** `Promise<SignedEvent>` - Fully signed event with `id`, `pubkey`, `sig`

Calls the `sign_event` RPC method.

```typescript
const signed = await bunker.signEvent({
  kind: 1,
  content: 'Hello from bunker!',
  tags: [],
  created_at: Math.floor(Date.now() / 1000)
})
```

---

#### `bunker.connect()`

**Returns:** `Promise<void>`

Establishes initial authorization with remote signer. **Only needed for first-time `fromBunker()` connections.**

```typescript
const bunker = BunkerSigner.fromBunker(localSk, uri, { pool })
await bunker.connect() // First time only
```

---

#### `bunker.close()`

**Returns:** `void` (likely)

Terminates connection and cleans up resources.

```typescript
bunker.close()
```

---

### Key Insights

**Session Restore Pattern (Hypothesis):**
1. **First Login:**
   - Generate `localSecretKey` with `generateSecretKey()`
   - Call `BunkerSigner.fromBunker(localSk, bunkerUri, { pool })`
   - Call `await bunker.connect()` to authorize
   - Store: `localSecretKey`, `bunkerUri`

2. **App Restart:**
   - Load `localSecretKey`, `bunkerUri` from storage
   - Call `BunkerSigner.fromBunker(storedSk, storedUri, { pool })`
   - **No `.connect()` needed** - session persists via stored keys

**Critical Question:** Does session truly persist without `.connect()` on reconnect? → **Check Jumble!**

---

## NIP-46 Protocol

### Protocol Overview

**Purpose:** Remote signer communication via Nostr relays (private key isolation)
**Event Kind:** 24133 (encrypted JSON-RPC requests/responses)
**Encryption:** NIP-44 v2 (NIP-04 legacy supported)

**Architecture Components:**
- **Client**: User-facing app (Noornote)
- **Remote Signer** (Bunker): Daemon/server with private keys
- **Client-Keypair**: Ephemeral keys generated by client for NIP-44 encryption
- **Remote-Signer-Keypair**: Signer's communication keys
- **User-Keypair**: Actual user's keys (controlled by remote signer)

**Security Rationale:** "Private keys should be exposed to as few systems as possible—each system adds to the attack surface."

---

### Connection Flows

**Flow 1: Remote-Signer-Initiated (`bunker://` URI)**

User receives URI from bunker (hardware device, nsecBunker, etc.):
```
bunker://<remote-signer-pubkey>?relay=<wss://relay>&relay=<wss://relay2>&secret=<optional-secret>
```

Client connects:
```typescript
const bunker = BunkerSigner.fromBunker(localSecretKey, pointer, { pool })
await bunker.connect() // Sends 'connect' RPC method
```

**Flow 2: Client-Initiated (`nostrconnect://` URI)**

Client generates connection token:
```
nostrconnect://<client-pubkey>?relay=<wss://relay>&secret=<required>&perms=<comma-separated>&name=<app-name>&url=<url>&image=<img>
```

Remote signer connects:
```typescript
const signer = await BunkerSigner.fromURI(localSecretKey, uri, { pool })
// Already connected - no .connect() needed!
```

**Key Insight:** Two different flows! `fromURI` is ready immediately, `fromBunker` needs `.connect()` call.

---

### Event Structure (Kind 24133)

**Request Event:**
```json
{
  "kind": 24133,
  "pubkey": "<client-keypair-pubkey>",
  "content": "<nip44-encrypted-payload>",
  "tags": [["p", "<remote-signer-pubkey>"]]
}
```

**Encrypted Payload (JSON-RPC):**
```json
{
  "id": "<random-request-id>",
  "method": "<method-name>",
  "params": ["array", "of", "strings"]
}
```

**Response Event:**
```json
{
  "kind": 24133,
  "pubkey": "<remote-signer-pubkey>",
  "content": "<nip44-encrypted-response>",
  "tags": [["p", "<client-pubkey>"]]
}
```

**Encrypted Response:**
```json
{
  "id": "<request-id>",
  "result": "<result-string>",
  "error": "<optional-error-string>"
}
```

---

### RPC Methods

| Method | Parameters | Response | Purpose |
|--------|-----------|----------|---------|
| `connect` | `[<remote-signer-pubkey>, <secret?>, <permissions?>]` | "ack" or secret | Initial handshake |
| `sign_event` | `[<{kind,content,tags,created_at}>]` | JSON stringified signed event | Sign Nostr event |
| `get_public_key` | `[]` | User pubkey (hex) | Get user's actual pubkey |
| `ping` | `[]` | "pong" | Health check |
| `nip04_encrypt` | `[<pubkey>, <plaintext>]` | Ciphertext | Legacy encryption |
| `nip04_decrypt` | `[<pubkey>, <ciphertext>]` | Plaintext | Legacy decryption |
| `nip44_encrypt` | `[<pubkey>, <plaintext>]` | Ciphertext | Modern encryption |
| `nip44_decrypt` | `[<pubkey>, <ciphertext>]` | Plaintext | Modern decryption |

---

### Permission System

**Format:** `method[:optional-param]`

**Examples:**
- `nip44_encrypt` - Full permission
- `sign_event:4` - Sign only kind 4 (DMs)
- `sign_event:1,sign_event:6` - Multiple specific kinds

**Usage:**
- In `connect` RPC params: `["<remote-signer-pubkey>", "<secret>", "sign_event:1,sign_event:6,nip44_encrypt"]`
- In `nostrconnect://` URI: `perms=sign_event:1,sign_event:6,nip44_encrypt`

---

### Session Management

**Lifecycle:**
1. Client generates ephemeral `client-keypair` (fresh each session)
2. Connection established via `connect` RPC
3. Client calls `get_public_key` to discover actual `user-pubkey`
4. All subsequent requests use `client-keypair` for NIP-44 encryption
5. **On logout:** Client deletes `client-keypair`

**Session Persistence Question:** How to restore session after app restart?
- Need to store `client-keypair`? (contradicts "ephemeral")
- Or regenerate and reconnect?
- → **Must check Jumble implementation!**

---

### Auth Challenges

If authentication required:
```json
{
  "id": "<request-id>",
  "result": "auth_url",
  "error": "<URL-to-display>"
}
```

Client displays URL in popup/tab, waits for user to authenticate externally.

---

## Answers to Open Questions

### Q1: What is `localSecretKey` in BunkerSigner?
**A:** It's the **client-keypair secret key** (ephemeral), NOT the user's private key. Used for NIP-44 encryption with remote signer.

### Q2: What data needs storage for session restore?
**A:** Unknown yet - need to study Jumble. Candidates:
- `bunker://` URI
- `client-keypair` (contradicts ephemeral principle?)
- Remote signer pubkey
- Relay URLs

### Q3: How does `.login()` differ from `.connect()`?
**A:** Unclear - need to check nostr-tools v2 BunkerSigner API docs.

### Q4: What's the `pointer` parameter in `fromBunker()`?
**A:** Likely the `bunker://` URI string.

---

---

## Jumble Reference Implementation

### File Structure

```
src/providers/NostrProvider/
├── bunker.signer.ts         // BunkerSigner wrapper
├── index.tsx                // Main provider with login logic
├── nip-07.signer.ts
├── nsec.signer.ts
└── npub.signer.ts
```

---

### bunker.signer.ts (Complete Implementation)

```typescript
import { ISigner, TDraftEvent } from '@/types'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { generateSecretKey } from 'nostr-tools'
import { BunkerSigner as NBunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'

export class BunkerSigner implements ISigner {
  signer: NBunkerSigner | null = null
  private clientSecretKey: Uint8Array
  private pubkey: string | null = null

  constructor(clientSecretKey?: string) {
    // If clientSecretKey provided (hex string), convert to Uint8Array
    // Otherwise, generate fresh ephemeral key
    this.clientSecretKey = clientSecretKey
      ? hexToBytes(clientSecretKey)
      : generateSecretKey()
  }

  async login(bunker: string, isInitialConnection = true): Promise<string> {
    const bunkerPointer = await parseBunkerInput(bunker)
    if (!bunkerPointer) {
      throw new Error('Invalid bunker')
    }

    this.signer = NBunkerSigner.fromBunker(this.clientSecretKey, bunkerPointer, {
      onauth: (url) => {
        window.open(url, '_blank') // Auth challenge handler
      }
    })

    // CRITICAL: Only call .connect() on first-time login
    if (isInitialConnection) {
      await this.signer.connect()
    }

    return await this.signer.getPublicKey()
  }

  async getPublicKey() {
    if (!this.signer) throw new Error('Not logged in')
    if (!this.pubkey) {
      this.pubkey = await this.signer.getPublicKey()
    }
    return this.pubkey
  }

  async signEvent(draftEvent: TDraftEvent) {
    if (!this.signer) throw new Error('Not logged in')
    return this.signer.signEvent(draftEvent)
  }

  async nip04Encrypt(pubkey: string, plainText: string) {
    if (!this.signer) throw new Error('Not logged in')
    return await this.signer.nip04Encrypt(pubkey, plainText)
  }

  async nip04Decrypt(pubkey: string, cipherText: string) {
    if (!this.signer) throw new Error('Not logged in')
    return await this.signer.nip04Decrypt(pubkey, cipherText)
  }

  getClientSecretKey() {
    return bytesToHex(this.clientSecretKey) // Export for storage
  }
}
```

**Key Insights:**
1. **Wrapper Pattern**: Wraps `nostr-tools/nip46` BunkerSigner
2. **Constructor Overload**: Accepts optional hex string for session restore
3. **Login Parameter**: `isInitialConnection` flag controls `.connect()` call
4. **Auth Handler**: `onauth` callback opens URL in new tab for challenges
5. **Export Method**: `getClientSecretKey()` exports key as hex for storage

---

### NostrProvider Login Flow

#### Initial Bunker Login

```typescript
const bunkerLogin = async (bunker: string) => {
  const bunkerSigner = new BunkerSigner() // Fresh key
  const pubkey = await bunkerSigner.login(bunker) // isInitialConnection = true (default)

  if (!pubkey) {
    throw new Error('Invalid bunker')
  }

  // Strip secret from bunker URI before storage (security)
  const bunkerUrl = new URL(bunker)
  bunkerUrl.searchParams.delete('secret')

  return login(bunkerSigner, {
    pubkey,
    signerType: 'bunker',
    bunker: bunkerUrl.toString(),
    bunkerClientSecretKey: bunkerSigner.getClientSecretKey()
  })
}
```

**Storage Data:**
- `pubkey`: User's actual public key (hex)
- `signerType`: `'bunker'`
- `bunker`: `bunker://` URI **without secret** (security best practice)
- `bunkerClientSecretKey`: Client's ephemeral key (hex)

---

#### Session Restore (loginWithAccountPointer)

```typescript
else if (account.signerType === 'bunker') {
  if (account.bunker && account.bunkerClientSecretKey) {
    const bunkerSigner = new BunkerSigner(
      account.bunkerClientSecretKey // Restore with stored key
    )

    const pubkey = await bunkerSigner.login(
      account.bunker,
      false // isInitialConnection = false → No .connect() call!
    )

    if (!pubkey) {
      storage.removeAccount(account)
      return null
    }
    // ... continue login
  }
}
```

**Critical Discovery:**
- Session restore passes `false` to `.login()` → **Skips `.connect()` call**
- BunkerSigner instantiated with **stored** `clientSecretKey`
- No new key generation → same encryption keypair
- Session persists via stored `clientSecretKey`!

---

### Session Persistence Pattern (SOLVED!)

**First Login:**
1. Generate fresh `clientSecretKey` with `generateSecretKey()`
2. Create `BunkerSigner` instance (no args)
3. Call `bunkerSigner.login(bunkerUri, true)` → triggers `.connect()`
4. Store in localStorage:
   - `bunker`: URI without secret
   - `bunkerClientSecretKey`: Hex-encoded client key
   - `pubkey`: User's actual pubkey

**App Restart:**
1. Load `bunkerClientSecretKey` and `bunker` from storage
2. Create `BunkerSigner(bunkerClientSecretKey)` → restores keypair
3. Call `bunkerSigner.login(bunker, false)` → **NO `.connect()` call**
4. BunkerSigner communicates with same encryption keys → session valid

**Why It Works:**
- Remote signer recognizes the same `clientSecretKey` (client-keypair)
- No re-authorization needed (same encryption channel)
- `.connect()` only for initial handshake

---

## Answers to Open Questions

### Q1: What is `localSecretKey` in BunkerSigner?
**A:** ✅ It's the **client-keypair secret key** (ephemeral for new sessions, persistent for reconnections). NOT the user's private key. Used for NIP-44 encryption with remote signer.

### Q2: What data needs storage for session restore?
**A:** ✅ Exactly two things:
- `bunker`: `bunker://` URI (without secret parameter)
- `bunkerClientSecretKey`: Hex-encoded client secret key

### Q3: How does `.login()` differ from `.connect()`?
**A:** ✅
- `.login()` = Jumble's wrapper method (creates BunkerSigner, optionally calls `.connect()`)
- `.connect()` = nostr-tools method (initial handshake/authorization RPC)
- On reconnect: Skip `.connect()` by passing `isInitialConnection: false`

### Q4: What's the `pointer` parameter in `fromBunker()`?
**A:** ✅ The `bunker://` URI string (or parsed bunker pointer object from `parseBunkerInput()`)

---

---

## Key Insights & Implementation Checklist

### ✅ What We Know Now

1. **BunkerSigner is a wrapper class** - We need to create our own wrapper around `nostr-tools/nip46`
2. **Session persistence = Store clientSecretKey** - Not truly "ephemeral" despite NIP-46 spec language
3. **`.connect()` is ONLY for first-time login** - Reconnections skip it via flag
4. **Security: Strip secret from URI before storage** - Important for multi-use bunker URIs
5. **nostr-tools has parseBunkerInput()** - Validates and parses bunker URIs
6. **Auth challenges use callback** - `onauth: (url) => window.open(url)` pattern
7. **Export/import keys as hex** - Use `bytesToHex()` / `hexToBytes()` from `@noble/hashes/utils`

### ❓ Remaining Questions

1. **Pool requirement**: Does BunkerSigner need our existing SimplePool instance or create its own?
   - Jumble passes `{ pool }` in options - need to check if optional
2. **NIP-44 encrypt/decrypt**: BunkerSigner has these methods - do we need them? (Jumble uses nip04*)
3. **Error handling**: What errors can `.connect()` / `.login()` throw?
4. **Timeouts**: How long should we wait for bunker responses?
5. **Multiple accounts**: How to handle switching between bunker accounts?

### 🎯 Required nostr-tools v2 Imports

```typescript
// Core
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { SimplePool } from 'nostr-tools/pool'

// NIP-46
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'

// Utilities
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
```

### 🏗️ Architecture Integration Points

**Noornote Files to Modify:**
1. `src/services/auth/AuthService.ts` - Add bunker login method
2. `src/services/auth/BunkerSigner.ts` - New wrapper class (like Jumble)
3. `src/components/auth/LoginView.ts` - Add bunker URI input
4. `src/types/auth.ts` - Add bunker account type
5. `src/services/storage/StorageService.ts` - Store bunker credentials

**Storage Schema:**
```typescript
interface BunkerAccount {
  type: 'bunker'
  pubkey: string                    // User's actual pubkey
  bunkerUri: string                 // bunker:// without secret
  bunkerClientSecretKey: string     // Hex-encoded client key
}
```

---

## Next Research Steps

- [x] Read NIP-46 specification completely ✅
- [x] Find nostr-tools v2 BunkerSigner full API documentation ✅
- [x] Study Jumble's implementation in detail ✅
- [x] Document session persistence pattern ✅
- [ ] Create detailed implementation plan
- [ ] Get user approval before coding

---

*Last Updated: Phase 3 - Key insights documented, ready for planning*
