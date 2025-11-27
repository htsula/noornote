# nostr-tools v1.x → v2.x Migration Plan

## 🔴 Problem Statement

**4 gescheiterte Migrations-Versuche** trotz sorgfältiger Planung.

**Warum gescheitert?**
- ❌ Code zu eng mit nostr-tools v1.x API verzahnt
- ❌ Keine Abstraktionsschicht → Breaking Changes brechen alles
- ❌ Tests nutzen die API, die sie testen sollen → nicht testbar
- ❌ Build succeeds ≠ App funktioniert (API-Änderungen brechen Logik)
- ❌ Zu viele Abhängigkeiten an zu vielen Stellen

**Root Cause:** Architektonisches Problem, kein technisches.

---

## ✅ Lösung: Abstraction-First Migration

**Kernidee:** Abstraktionsschicht VORHER einbauen, DANN migrieren.

### Phase 1: Abstraktionsschicht erstellen (JETZT)

**Ziel:** nostr-tools API von unserer Codebase isolieren.

#### 1.1 NostrAdapter erstellen

```typescript
// src/services/adapters/NostrAdapter.ts

/**
 * Abstraction layer for nostr-tools library.
 *
 * ALL nostr-tools imports MUST go through this adapter.
 * Components/Services NEVER import nostr-tools directly.
 *
 * Benefits:
 * - Stable API regardless of nostr-tools version
 * - Easy to mock for testing
 * - Migration isolated to this file only
 */

export class NostrAdapter {
  // Event creation
  static generateSecretKey(): Uint8Array { ... }
  static getPublicKey(secretKey: Uint8Array): string { ... }
  static finalizeEvent(event: UnsignedEvent, secretKey: Uint8Array): Event { ... }

  // Encryption (NIP-04 now, NIP-44/17/59 later)
  static encrypt(secretKey: Uint8Array, pubkey: string, text: string): Promise<string> { ... }
  static decrypt(secretKey: Uint8Array, pubkey: string, ciphertext: string): Promise<string> { ... }

  // NIP-19 encoding
  static npubEncode(hex: string): string { ... }
  static nsecEncode(hex: string): string { ... }
  static noteEncode(hex: string): string { ... }
  static decode(nip19: string): { type: string; data: any } { ... }

  // Event validation
  static validateEvent(event: Event): boolean { ... }
  static verifySignature(event: Event): boolean { ... }

  // Future: NIP-17 DM support (placeholder)
  static wrapDM(params: DMParams): Event { ... }
  static unwrapDM(event: Event, secretKey: Uint8Array): DMContent { ... }
}
```

#### 1.2 RelayAdapter erstellen

```typescript
// src/services/adapters/RelayAdapter.ts

/**
 * Abstraction layer for nostr-tools relay/pool functionality.
 *
 * Isolates SimplePool API from our codebase.
 */

export class RelayAdapter {
  private pool: SimplePool;

  constructor() {
    this.pool = new SimplePool();
  }

  // Subscription management
  subscribe(relays: string[], filters: Filter[], onEvent: (event: Event) => void): () => void { ... }

  // Publishing
  async publish(relays: string[], event: Event): Promise<boolean> { ... }

  // Fetching
  async fetchEvents(relays: string[], filters: Filter[]): Promise<Event[]> { ... }

  // Connection management
  ensureRelay(url: string): void { ... }
  close(relays: string[]): void { ... }
}
```

#### 1.3 Migration-Status dokumentieren

Datei: `src/services/adapters/MIGRATION_STATUS.md`

Trackt welche Services bereits auf Adapter umgebaut sind:

```markdown
# Adapter Migration Status

## ✅ Migrated to Adapter
- [ ] AuthService
- [ ] PostService
- [ ] ProfileService
- [ ] ReactionService
- [ ] ZapService
- [ ] ThreadOrchestrator
- [ ] FeedOrchestrator
- [ ] etc.

## ❌ Still using nostr-tools directly
- [x] All services (initial state)
```

---

### Phase 2: Schrittweise Isolation (Service für Service)

**Regel:** Ein Service nach dem anderen auf Adapter umbauen.

#### 2.1 Pro Service:

1. **Refactor:** Service nutzt NostrAdapter statt nostr-tools
2. **Build:** `npm run build` muss durchlaufen
3. **User-Test:** Feature manuell testen in Tauri app
4. **Commit:** Nur wenn User sagt "funktioniert"
5. **Update MIGRATION_STATUS.md**

#### 2.2 Reihenfolge (Vorschlag):

1. **AuthService** (klein, kritisch)
2. **ProfileService** (mittel, isoliert)
3. **PostService** (groß, zentral)
4. **ReactionService** (klein, abhängig von Post)
5. **ZapService** (mittel, komplex)
6. **Orchestrators** (groß, viele Abhängigkeiten)

**Wichtig:** Nach JEDEM Service User-Test. Keine Batch-Migration.

---

### Phase 3: nostr-tools v2.x Migration (NUR Adapter anfassen)

**Erst wenn Phase 2 komplett abgeschlossen!**

#### 3.1 Vorbereitung

1. **Backup:** Separater Branch `migration/nostr-tools-v2`
2. **Dokumentation lesen:** v2.0.0 Breaking Changes nochmal studieren
3. **Test-Plan:** Welche Features müssen nach Migration funktionieren?

#### 3.2 Migration durchführen

**Nur NostrAdapter.ts und RelayAdapter.ts anfassen!**

```bash
# package.json
"nostr-tools": "^2.17.0"  # Latest v2.x

# Dann NUR in Adapters:
- generatePrivateKey() → generateSecretKey()
- getPublicKey() → akzeptiert Uint8Array
- finishEvent() → finalizeEvent()
- SimplePool API Änderungen in RelayAdapter
```

#### 3.3 Testing-Strategie

**Pro Feature (manuell in Tauri):**

1. Login/Logout
2. Post erstellen
3. Like/Repost
4. Zap senden
5. Profile anzeigen/editieren
6. Timeline laden
7. Notifications
8. Single Note View
9. Thread View
10. Bookmarks
11. Mute/Report

**Jedes Feature MUSS funktionieren bevor weiter.**

#### 3.4 Rollback-Plan

Wenn nach 2 Tagen Testing immer noch Blocker:

```bash
git checkout development
git branch -D migration/nostr-tools-v2
```

Zurück zu Phase 2, mehr isolieren.

---

### Phase 4: NIP-17 DM Implementation (nach erfolgreicher Migration)

**Erst wenn v2.x stabil läuft!**

#### 4.1 NIP-17 in NostrAdapter

```typescript
// src/services/adapters/NostrAdapter.ts

import { wrapEvent, wrapManyEvents, unwrapEvent } from 'nostr-tools/nip17';
import { encrypt, decrypt } from 'nostr-tools/nip44';

export class NostrAdapter {
  // ... existing methods ...

  // NIP-17 DMs
  static async wrapDM(
    senderSecretKey: Uint8Array,
    recipient: { publicKey: string; relayUrl?: string },
    message: string,
    conversationTitle?: string,
    replyTo?: { eventId: string; relayUrl?: string }
  ): Promise<Event> {
    return wrapEvent(senderSecretKey, recipient, message, conversationTitle, replyTo);
  }

  static async wrapGroupDM(
    senderSecretKey: Uint8Array,
    recipients: Array<{ publicKey: string; relayUrl?: string }>,
    message: string
  ): Promise<Event[]> {
    return wrapManyEvents(senderSecretKey, recipients, message);
  }

  static async unwrapDM(
    wrappedEvent: Event,
    recipientSecretKey: Uint8Array
  ): Promise<{ content: string; sender: string; timestamp: number }> {
    return unwrapEvent(wrappedEvent, recipientSecretKey);
  }
}
```

#### 4.2 DMService erstellen

```typescript
// src/services/DMService.ts

export class DMService {
  private adapter = NostrAdapter;
  private relayAdapter = new RelayAdapter();

  async sendDM(recipientPubkey: string, message: string): Promise<boolean> {
    // 1. Get recipient's Kind 10050 (DM relay list)
    const recipientRelays = await this.getRecipientDMRelays(recipientPubkey);

    // 2. Wrap message with NIP-17
    const wrapped = await this.adapter.wrapDM(
      await this.getMySecretKey(),
      { publicKey: recipientPubkey, relayUrl: recipientRelays[0] },
      message
    );

    // 3. Publish to recipient's relays
    return await this.relayAdapter.publish(recipientRelays, wrapped);
  }

  async receiveDMs(): Promise<DM[]> {
    // Subscribe to Kind 1059 (gift wrapped events) on my DM relays
    const myRelays = await this.getMyDMRelays();
    // ... implementation
  }

  private async getRecipientDMRelays(pubkey: string): Promise<string[]> {
    // Fetch Kind 10050 event
  }

  private async getMyDMRelays(): Promise<string[]> {
    // Get from settings or Kind 10050
  }
}
```

#### 4.3 UI Components

- **DMListView** (Conversations Overview)
- **DMThreadView** (Single Conversation)
- **DMComposer** (New Message)
- **DMRelaySettings** (Kind 10050 Management)

#### 4.4 Relay Infrastructure

**User muss Kind 10050 Event publizieren:**

Empfohlene Relays:
- `wss://inbox.nostr.wine` (paid, specialized for DMs)
- `wss://relay.damus.io` (free, reliable)
- `wss://relay.nostr.band` (free, analytics)

**Settings UI:**
- User kann 2-4 DM Inbox Relays konfigurieren
- Publish Kind 10050 Event zu all ihren Relays
- Warnung wenn kein DM Relay konfiguriert

---

## 📋 Timeline & Milestones

### Milestone 1: Abstraction Layer (2-3 Wochen)
- [ ] NostrAdapter.ts erstellt
- [ ] RelayAdapter.ts erstellt
- [ ] MIGRATION_STATUS.md angelegt
- [ ] Alle Services auf Adapter umgebaut
- [ ] User-Tests für alle Features bestanden

### Milestone 2: v2.x Migration (1-2 Wochen)
- [ ] Branch erstellt
- [ ] package.json updated
- [ ] Adapter auf v2.x API umgebaut
- [ ] Alle Features manuell getestet
- [ ] Merged in development

### Milestone 3: NIP-17 DMs (2-3 Wochen)
- [ ] NIP-17 in NostrAdapter
- [ ] DMService implementiert
- [ ] UI Components gebaut
- [ ] Relay Settings integriert
- [ ] End-to-End DMs funktionieren

**Total: 5-8 Wochen**

---

## ⚠️ Critical Success Factors

1. **Nie direkt nostr-tools importieren** (außer in Adapters)
2. **Ein Service nach dem anderen** (kein Batch-Refactor)
3. **User testet nach JEDEM Service** (nicht erst am Ende)
4. **Build + User-Test = Erfolg** (beide müssen passen)
5. **Bei Blocker: Rollback** (nicht tagelang debuggen)

---

## 🎯 Why This Will Work (This Time)

**Gescheiterte Versuche 1-4:**
- Zu viel auf einmal
- Keine Isolation
- Tests nutzlos
- Breaking Changes überall

**Neuer Ansatz:**
- ✅ Abstraction-First (isoliert Problem)
- ✅ Schrittweise Migration (reduziert Risiko)
- ✅ User-Tests pro Feature (frühe Fehler-Erkennung)
- ✅ Nur Adapter anfassen (Rest bleibt stabil)
- ✅ Klarer Rollback-Plan (kein Sunk-Cost-Fallacy)

**Wenn Phase 1 + 2 sauber durchgezogen → Phase 3 wird trivial.**

---

## 📝 Next Steps

1. ✅ **JETZT:** current-tasks.md abarbeiten
2. ⏳ **DANN:** Architektur-Review (Adapter-Design mit User absprechen)
3. ⏳ **DANN:** Phase 1 starten (Abstraction Layer bauen)
4. ⏳ **SPÄTER:** Phase 2 (Service-Migration)
5. ⏳ **VIEL SPÄTER:** Phase 3 (v2.x Migration)
6. ⏳ **ZIEL:** Phase 4 (NIP-17 DMs mit Alleinstellungsmerkmal)

---

**Status:** Planning Phase
**Last Updated:** 2025-10-30
**Owner:** Claude + User (gemeinsame Verantwortung)

---

# 🚨 CRITICAL ADDITION: Context Memory Problem

## Das eigentliche Problem

**4 gescheiterte Versuche sind nicht nur wegen nostr-tools API - sondern wegen Claude's begrenzter Context Memory.**

**Symptome:**
- Context komprimiert sich während großer Refactors
- Vergesse Architektur-Details mittendrin
- Breche Features während Refactoring anderer Features
- Kann nicht alle Services/Components gleichzeitig im Kopf behalten

**Konsequenz:** Der obige Plan (Abstraction Layer → Migration) wird AUCH scheitern, wenn wir nicht das Context-Problem lösen.

---

## 🏗️ LÖSUNG: Vertical Slice Architecture + USB (Uniform Service Bus)

**Idee:** Features als isolierte Microservices mit zentralem Service Bus.

### Warum das Context-Problem löst

**Vorher:**
- Claude muss ALLE Services/Components im Context halten
- Änderung in PostService → bricht ProfileService → vergesse TimelineComponent
- Context komprimiert → vergesse Orchestrator-Architektur
- Kreuz-quer API-Calls zwischen Features

**Nachher:**
- Claude arbeitet NUR an EINEM Feature-Slice zur Zeit
- Alle anderen Features sind Black Boxes mit Service Contract
- Context klein: Feature Internals + USB API + Core APIs
- Context-Komprimierung verliert nur Feature-Details, nicht ganze App
- **ALLE Kommunikation geht durch USB** - Single Point of Communication

### USB Konzept (Uniform Service Bus)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Payments   │  │  Devices    │  │  Messages   │  │  Microcom   │
│  (NWC/Zaps) │  │  (Signers)  │  │  (DMs)      │  │  (Future)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
       │                └────────┐  ┐────┘                │
       │                         │  │                     │
       └─────────────────────────┼──┼─────────────────────┘
                                 │  │
                       ┌─────────▼──▼──────────┐
                       │   UNIFORM SERVICE     │
                       │         BUS           │
                       │                       │
                       │  - Service Registry   │
                       │  - Message Routing    │
                       │  - Request/Response   │
                       │  - Pub/Sub Events     │
                       │  - Type Safety        │
                       │  - Debug Logging      │
                       └─────────┬─────────────┘
                                 │
       ┌─────────────────────────┼─────────────────────────┐
       │                         │                         │
┌──────▼──────┐  ┌───────────────▼──────┐  ┌──────────────▼──────┐
│ Applications│  │      Users           │  │  Microservices      │
│ (Timeline,  │  │      (Auth,          │  │  (APIs, Systems,    │
│  Profile,   │  │       Profile)       │  │   Nostr Adapters)   │
│  Notifs)    │  │                      │  │                     │
└─────────────┘  └──────────────────────┘  └─────────────────────┘
       │                         │                         │
       └─────────────────────────┼─────────────────────────┘
                                 │
                       ┌─────────▼──────────┐
                       │      Systems       │
                       │  (Core Services)   │
                       └────────────────────┘
```

### Architektur-Diagramm (NoorNote spezifisch)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Timeline       │  │  Profile        │  │  DMs            │  │  Notifications  │
│  Feature        │  │  Feature        │  │  Feature        │  │  Feature        │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ - Component     │  │ - Component     │  │ - Component     │  │ - Component     │
│ - Service       │  │ - Service       │  │ - Service       │  │ - Service       │
│ - Orchestrator  │  │ - Orchestrator  │  │ - Orchestrator  │  │ - Orchestrator  │
│ - ServiceAPI.ts │  │ - ServiceAPI.ts │  │ - ServiceAPI.ts │  │ - ServiceAPI.ts │
│ - types.ts      │  │ - types.ts      │  │ - types.ts      │  │ - types.ts      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │                    │
         └────────────────────┼────────────────────┼────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  UNIFORM SERVICE   │
                    │       BUS          │
                    │  ← PENIBLE DOKU    │
                    │                    │
                    │ • Service Registry │
                    │ • Message Router   │
                    │ • Request/Response │
                    │ • Pub/Sub          │
                    │ • Type Checking    │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Core Services     │
                    │                    │
                    │ • NostrAdapter     │
                    │ • RelayAdapter     │
                    │ • AuthService      │
                    │ • CacheService     │
                    │  ← PENIBLE DOKU    │
                    └────────────────────┘
```

---

## 📂 Neue Verzeichnisstruktur

```
src/
├── features/                       ← Vertical Slices (Microservices)
│   ├── timeline/
│   │   ├── TimelineComponent.ts
│   │   ├── TimelineService.ts
│   │   ├── TimelineOrchestrator.ts
│   │   ├── TimelineAPI.ts          ← PUBLIC API (dokumentiert in API.md)
│   │   ├── types.ts
│   │   └── README.md               ← Feature-spezifische Doku
│   ├── profile/
│   │   ├── ProfileComponent.ts
│   │   ├── ProfileService.ts
│   │   ├── ProfileOrchestrator.ts
│   │   ├── ProfileAPI.ts           ← PUBLIC API (dokumentiert in API.md)
│   │   ├── types.ts
│   │   └── README.md
│   ├── dm/
│   │   ├── DMComponent.ts
│   │   ├── DMService.ts
│   │   ├── DMOrchestrator.ts
│   │   ├── DMAPI.ts                ← PUBLIC API (dokumentiert in API.md)
│   │   ├── types.ts
│   │   └── README.md
│   ├── notifications/
│   │   ├── NotificationsComponent.ts
│   │   ├── NotificationsService.ts
│   │   ├── NotificationsOrchestrator.ts
│   │   ├── NotificationsAPI.ts     ← PUBLIC API (dokumentiert in API.md)
│   │   ├── types.ts
│   │   └── README.md
│   ├── single-note/
│   │   ├── SingleNoteComponent.ts
│   │   ├── SingleNoteService.ts
│   │   ├── SingleNoteAPI.ts        ← PUBLIC API (dokumentiert in API.md)
│   │   ├── types.ts
│   │   └── README.md
│   └── bookmarks/
│       ├── BookmarksComponent.ts
│       ├── BookmarksService.ts
│       ├── BookmarksAPI.ts         ← PUBLIC API (dokumentiert in API.md)
│       ├── types.ts
│       └── README.md
├── core/                           ← Shared Infrastructure
│   ├── USB.ts                      ← Uniform Service Bus (dokumentiert in API.md)
│   ├── NostrAdapter.ts             ← Nostr API Wrapper (dokumentiert in API.md)
│   ├── RelayAdapter.ts             ← Relay Management (dokumentiert in API.md)
│   ├── types.ts                    ← Shared Types
│   └── README.md
├── App.ts                          ← Glue ONLY (initialisiert Features, USB Setup)
└── API.md                          ← 🔥 ZENTRALE API-DOKUMENTATION (PENIBEL GEPFLEGT)
```

---

## 📘 API.md - Zentrale API-Dokumentation

**ABSOLUT KRITISCH:** Diese Datei MUSS bei JEDER Änderung aktualisiert werden.

### Struktur der API.md

```markdown
# NoorNote API Documentation

**RULE:** Alle Features kommunizieren NUR über diese definierten APIs.
**NEVER:** Direkter Import von Feature-Internals (z.B. `import { TimelineService } from '../timeline/TimelineService'`)

---

## Core APIs

### USB API (Uniform Service Bus)

**Zweck:** Zentrale Kommunikations-Schicht für alle Features (Microservices-Pattern)

**Capabilities:**
- Service Discovery & Registration
- Request/Response Pattern (sync & async)
- Pub/Sub Events
- Type-Safe Message Contracts
- Debug Logging aller Messages

**Methods:**

**Service Registration:**
- `USB.register(serviceName: string, service: Service): void`
- `USB.unregister(serviceName: string): void`
- `USB.getService<T>(serviceName: string): T | null`

**Request/Response:**
- `USB.request<T>(serviceName: string, method: string, params?: any): Promise<T>`
- `USB.respond(serviceName: string, method: string, handler: Function): void`

**Pub/Sub:**
- `USB.publish(event: string, data?: any): void`
- `USB.subscribe(event: string, callback: Function): () => void`
- `USB.unsubscribe(event: string, callback: Function): void`

**Example:**
```typescript
// Service Registration
USB.register('profile', new ProfileService());

// Request/Response (andere Features rufen ProfileService)
const profile = await USB.request<Profile>('profile', 'getProfile', { pubkey: 'abc123' });

// Pub/Sub (Events)
USB.publish('profile:updated', { pubkey: 'abc123' });

// Subscribe to events
const unsubscribe = USB.subscribe('profile:updated', (data) => {
  console.log('Profile updated:', data.pubkey);
});
```

**Update History:**
- 2025-10-30: Initial API definition (replaces EventBus)

---

### NostrAdapter API

**Zweck:** Abstraction layer für nostr-tools

**Methods:**
- `NostrAdapter.generateSecretKey(): Uint8Array`
- `NostrAdapter.getPublicKey(secretKey: Uint8Array): string`
- `NostrAdapter.finalizeEvent(event: UnsignedEvent, secretKey: Uint8Array): Event`
- `NostrAdapter.encrypt(secretKey: Uint8Array, pubkey: string, text: string): Promise<string>`
- `NostrAdapter.decrypt(secretKey: Uint8Array, pubkey: string, ciphertext: string): Promise<string>`

**Example:**
```typescript
const secretKey = NostrAdapter.generateSecretKey();
const pubkey = NostrAdapter.getPublicKey(secretKey);
```

**Update History:**
- 2025-10-30: Initial API definition

---

### RelayAdapter API

**Zweck:** Relay/Pool Management

**Methods:**
- `relayAdapter.subscribe(relays: string[], filters: Filter[], onEvent: (event: Event) => void): () => void`
- `relayAdapter.publish(relays: string[], event: Event): Promise<boolean>`
- `relayAdapter.fetchEvents(relays: string[], filters: Filter[]): Promise<Event[]>`

**Example:**
```typescript
const adapter = new RelayAdapter();
const unsub = adapter.subscribe(
  ['wss://relay.damus.io'],
  [{ kinds: [1], limit: 10 }],
  (event) => console.log(event)
);
```

**Update History:**
- 2025-10-30: Initial API definition

---

## Feature APIs

### TimelineAPI

**Zweck:** Timeline Feature Public Interface

**Service Registration:**
```typescript
USB.register('timeline', new TimelineService());
```

**Request/Response Methods:**
- `loadTimeline(pubkey: string): Promise<void>`
- `refreshTimeline(): Promise<void>`
- `getNote(noteId: string): Promise<Note>`

**Events (Pub/Sub):**
- `timeline:note:clicked` - User clicked on a note
  - Data: `{ noteId: string, event: Event }`
- `timeline:user:clicked` - User clicked on a user
  - Data: `{ pubkey: string }`
- `timeline:loaded` - Timeline finished loading
  - Data: `{ noteCount: number }`

**Example:**
```typescript
// Request/Response: Load timeline
await USB.request('timeline', 'loadTimeline', { pubkey: 'abc123' });

// Request/Response: Get single note
const note = await USB.request<Note>('timeline', 'getNote', { noteId: 'xyz' });

// Pub/Sub: Listen to events
USB.subscribe('timeline:note:clicked', ({ noteId }) => {
  // Open Single Note View
});
```

**Update History:**
- 2025-10-30: Initial API definition (updated to USB pattern)

---

### ProfileAPI

**Zweck:** Profile Feature Public Interface

**Service Registration:**
```typescript
USB.register('profile', new ProfileService());
```

**Request/Response Methods:**
- `getProfile(pubkey: string): Promise<Profile>`
- `updateProfile(data: ProfileData): Promise<boolean>`
- `showProfile(pubkey: string): void`

**Events (Pub/Sub):**
- `profile:show` - Request to show profile
  - Data: `{ pubkey: string }`
- `profile:loaded` - Profile data loaded
  - Data: `{ pubkey: string, profile: Profile }`
- `profile:updated` - User updated their profile
  - Data: `{ pubkey: string }`

**Example:**
```typescript
// Request/Response: Get profile data
const profile = await USB.request<Profile>('profile', 'getProfile', { pubkey: 'abc123' });

// Request/Response: Update profile
await USB.request('profile', 'updateProfile', { name: 'Alice', about: 'Developer' });

// Pub/Sub: Listen to profile updates
USB.subscribe('profile:updated', ({ pubkey }) => {
  console.log('Profile updated:', pubkey);
});
```

**Update History:**
- 2025-10-30: Initial API definition (updated to USB pattern)

---

### DMAPI

**Zweck:** Direct Messages Feature Public Interface

**Service Registration:**
```typescript
USB.register('dm', new DMService());
```

**Request/Response Methods:**
- `sendDM(recipientPubkey: string, message: string): Promise<boolean>`
- `getConversations(): Promise<Conversation[]>`
- `getMessages(conversationId: string): Promise<DMMessage[]>`
- `openConversation(conversationId: string): void`

**Events (Pub/Sub):**
- `dm:new` - New DM received
  - Data: `{ conversationId: string, message: DMMessage }`
- `dm:sent` - DM successfully sent
  - Data: `{ conversationId: string, messageId: string }`
- `dm:conversation:opened` - User opened a conversation
  - Data: `{ conversationId: string }`

**Example:**
```typescript
// Request/Response: Send DM
await USB.request('dm', 'sendDM', { recipientPubkey: 'abc123', message: 'Hello!' });

// Request/Response: Get conversations
const conversations = await USB.request<Conversation[]>('dm', 'getConversations');

// Pub/Sub: Listen for new DMs
USB.subscribe('dm:new', ({ message }) => {
  // Show notification
});
```

**Update History:**
- 2025-10-30: Initial API definition (pending implementation after nostr-tools v2.x, updated to USB pattern)

---

(... weitere Feature APIs ...)
```

---

## 🔒 ABSOLUTE REGELN für API.md

**REGEL 1:** JEDE API-Änderung MUSS in API.md dokumentiert werden BEVOR Code geschrieben wird.

**REGEL 2:** API.md ist die SINGLE SOURCE OF TRUTH für alle Inter-Feature Kommunikation.

**REGEL 3:** Wenn ein Feature ein anderes Feature nutzen will:
1. API.md öffnen
2. Schauen welche Events/Methods verfügbar sind
3. NUR diese nutzen
4. NIEMALS direkte Imports von Feature-Internals

**REGEL 4:** JEDE Änderung braucht Update History Entry:
```markdown
**Update History:**
- 2025-11-01: Added `timeline:filter:changed` event
- 2025-10-30: Initial API definition
```

**REGEL 5:** Claude MUSS API.md lesen BEVOR er an einem Feature arbeitet.

**REGEL 6:** User MUSS API.md reviewen BEVOR Commit approved wird.

---

## 🎯 Feature Service Pattern (Template)

Jedes Feature MUSS einen Service haben, der sich am USB registriert:

```typescript
// features/example/ExampleService.ts

/**
 * Example Feature Service.
 *
 * ⚠️ RULE: Andere Features kommunizieren NUR über USB!
 * ❌ NEVER: Direkter Import von ExampleService
 * ✅ ALWAYS: USB.request('example', 'methodName', params)
 */

export class ExampleService {
  /**
   * Registriert Service am USB.
   * Called by App.ts during initialization.
   */
  static register(): void {
    const service = new ExampleService();
    USB.register('example', service);

    // Register Request/Response handlers
    USB.respond('example', 'load', (params) => service.load(params.id));
    USB.respond('example', 'getData', (params) => service.getData(params.id));
  }

  /**
   * Load example data.
   * @param id - Example ID
   */
  private async load(id: string): Promise<void> {
    // Internal implementation
    const data = await this.fetchData(id);

    // Publish event when done
    USB.publish('example:loaded', { id, data });
  }

  /**
   * Get example data.
   * @param id - Example ID
   * @returns Example data
   */
  private async getData(id: string): Promise<ExampleData> {
    // Internal implementation
    return this.cache.get(id);
  }

  /**
   * Private internal methods...
   */
  private async fetchData(id: string): Promise<ExampleData> {
    // ...
  }
}

// Usage from other features:
// const data = await USB.request<ExampleData>('example', 'getData', { id: '123' });
// USB.subscribe('example:loaded', ({ id, data }) => { ... });
```

---

## ⚠️ USB Nachteile & Risiken

**CRITICAL: USB ist KEIN Allheilmittel. Selektiver Einsatz erforderlich!**

### Potenzielle Probleme

**1. Single Point of Failure**
- Wenn USB buggy ist → ganze App bricht zusammen
- Wenn USB abstürzt → alle Features tot

**2. Performance Bottleneck**
- ALLE Messages gehen durch USB
- Bei High-Frequency Events (scroll, render) → Flaschenhals
- JavaScript ist Single-Threaded → USB blockiert UI

**3. Memory Leak Risk**
- Services/Listeners nicht richtig unsubscribed → Memory wächst
- Event History bleibt in Memory (Debug Mode)

**4. Type Safety Erosion**
- `USB.request<T>()` nutzt `any` für params
- Kein Compile-Time Check ob Service existiert
- Typos in Service-Namen erst zur Runtime sichtbar

**5. Debugging Complexity**
- Indirektion macht Stack Traces schwerer lesbar
- "Wer ruft wen?" nicht mehr obvious

### Performance-Overhead

| Szenario | Direkter Aufruf | USB Overhead |
|----------|----------------|--------------|
| Einfache Methode | ~0.01ms | ~0.05ms (5x) |
| Async Methode | ~1ms | ~1.05ms (5%) |
| Event Publish | ~0.001ms | ~0.01ms (10x) |
| 1000 Events/sec | Kein Problem | ⚠️ Potenzieller Bottleneck |

**Fazit:** USB nur für Cross-Feature Communication, NICHT für alles!

---

## 🎯 HYBRID-ANSATZ: USB Selektiv Einsetzen

**Regel:** Vertical Slices behalten, aber USB nur wo nötig.

### Kommunikations-Matrix

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMUNICATION RULES                       │
├─────────────────────────────────────────────────────────────┤
│ Within Feature:           DIRECT (schnell, kein Overhead)   │
│ Cross-Feature (rare):     USB (loose coupling)              │
│ Core Services:            DIRECT (performance critical)     │
│ App-wide Events:          USB (login, logout, theme)        │
│ High-Frequency:           DIRECT (scroll, render, etc.)     │
└─────────────────────────────────────────────────────────────┘
```

### ✅ DIREKT (kein USB)

```typescript
// Feature-intern (häufig, performance-critical)
TimelineComponent → TimelineService (direkt)
TimelineService → TimelineOrchestrator (direkt)
TimelineOrchestrator → NostrAdapter (direkt)

// Core Services untereinander
NostrAdapter → RelayAdapter (direkt)
CacheService → IndexedDB (direkt)

// High-Frequency Events (>100/sec)
onScroll() → updateVirtualScroll() (direkt)
onNoteRender() → checkViewport() (direkt)
onMouseMove() → updateCursor() (direkt)
```

### 🔄 USB (selektiv)

```typescript
// Cross-Feature Communication (selten, <10/min)
Timeline: Note clicked → USB.publish('note:clicked') → SingleNoteView
Timeline: User clicked → USB.publish('user:clicked') → ProfileView

// App-wide Events (sehr selten)
Login → USB.publish('auth:login') → alle Features reagieren
Logout → USB.publish('auth:logout') → alle Features clearen
Theme changed → USB.publish('theme:changed') → alle Components

// Service Discovery (einmalig beim App Start)
USB.register('profile', ProfileService)
USB.register('timeline', TimelineService)
```

---

## 📁 Überarbeitete Verzeichnisstruktur (Hybrid)

```
src/
├── features/
│   ├── timeline/
│   │   ├── TimelineComponent.ts       ← UI (direkt mit Service)
│   │   ├── TimelineService.ts         ← Business Logic
│   │   ├── TimelineOrchestrator.ts    ← Nostr Events
│   │   │
│   │   │   ┌─────────────────────────────────────┐
│   │   │   │  INTERNAL: Direkte Aufrufe (fast)   │
│   │   │   │  Component → Service → Orchestrator │
│   │   │   └─────────────────────────────────────┘
│   │   │
│   │   └── TimelineUSBBridge.ts       ← USB Interface (KLEIN!)
│   │       │
│   │       │ Nur Cross-Feature Events:
│   │       │ - USB.subscribe('note:clicked')
│   │       │ - USB.publish('timeline:loaded')
│   │       │
│   │       │ Nicht für interne Kommunikation!
│   │
│   ├── profile/
│   │   ├── ProfileComponent.ts
│   │   ├── ProfileService.ts
│   │   ├── ProfileOrchestrator.ts
│   │   └── ProfileUSBBridge.ts        ← USB Interface (KLEIN!)
│   │
│   ├── dm/
│   │   ├── DMComponent.ts
│   │   ├── DMService.ts
│   │   ├── DMOrchestrator.ts
│   │   └── DMUSBBridge.ts             ← USB Interface (KLEIN!)
│   │
│   ├── notifications/
│   │   ├── NotificationsComponent.ts
│   │   ├── NotificationsService.ts
│   │   ├── NotificationsOrchestrator.ts
│   │   └── NotificationsUSBBridge.ts
│   │
│   ├── single-note/
│   │   ├── SingleNoteComponent.ts
│   │   ├── SingleNoteService.ts
│   │   └── SingleNoteUSBBridge.ts
│   │
│   └── bookmarks/
│       ├── BookmarksComponent.ts
│       ├── BookmarksService.ts
│       ├── BookmarksOrchestrator.ts
│       └── BookmarksUSBBridge.ts
│
├── core/
│   ├── USB.ts                         ← Nur für Cross-Feature
│   ├── NostrAdapter.ts                ← Direkt nutzbar (kein USB)
│   ├── RelayAdapter.ts                ← Direkt nutzbar (kein USB)
│   ├── CacheService.ts                ← Direkt nutzbar (kein USB)
│   ├── PerformanceMonitor.ts          ← USB Performance Tracking
│   ├── types.ts
│   └── README.md
│
├── App.ts                             ← Initialisiert Features + USB
└── API.md                             ← USB Events dokumentiert
```

---

## 🔄 USBBridge Pattern (Minimal Overhead)

**Jedes Feature hat einen kleinen USBBridge - NUR für Cross-Feature Events.**

```typescript
// features/timeline/TimelineUSBBridge.ts

/**
 * USB Bridge für Timeline Feature.
 *
 * ⚠️ RULE: ONLY handles cross-feature communication.
 * ⚠️ Internal communication stays DIRECT for performance.
 */

export class TimelineUSBBridge {
  constructor(private timelineService: TimelineService) {}

  /**
   * Setup USB listeners (called once on app start).
   * KEEP THIS MINIMAL - only cross-feature events!
   */
  setupListeners(): void {
    // App-wide events (rare)
    USB.subscribe('auth:logout', () => {
      this.timelineService.clear();
    });

    USB.subscribe('theme:changed', ({ theme }) => {
      this.timelineService.updateTheme(theme);
    });

    // Cross-feature requests (rare)
    USB.respond('timeline', 'getNote', (params) => {
      return this.timelineService.getNote(params.noteId);
    });

    // That's it! Only 3 handlers. Everything else is DIRECT.
  }

  /**
   * Publish cross-feature events (rare).
   */
  onNoteClicked(noteId: string, event: Event): void {
    // Only publish for cross-feature consumption
    USB.publish('note:clicked', { noteId, event });
  }

  onUserClicked(pubkey: string): void {
    USB.publish('user:clicked', { pubkey });
  }

  onTimelineLoaded(noteCount: number): void {
    USB.publish('timeline:loaded', { noteCount });
  }
}
```

**Usage in Component:**

```typescript
// features/timeline/TimelineComponent.ts

export class TimelineComponent {
  private service: TimelineService;          // ← DIRECT (fast)
  private orchestrator: TimelineOrchestrator; // ← DIRECT (fast)
  private usbBridge: TimelineUSBBridge;       // ← USB (minimal)

  constructor() {
    this.service = new TimelineService();
    this.orchestrator = new TimelineOrchestrator();
    this.usbBridge = new TimelineUSBBridge(this.service);

    // Setup USB listeners (once, minimal)
    this.usbBridge.setupListeners();
  }

  /**
   * Internal communication: DIRECT (performance-critical).
   */
  async loadTimeline(pubkey: string): Promise<void> {
    const notes = await this.service.fetchNotes(pubkey); // ← DIRECT
    this.render(notes); // ← DIRECT

    // Notify other features (via USB)
    this.usbBridge.onTimelineLoaded(notes.length);
  }

  /**
   * High-frequency: DIRECT (no USB overhead).
   */
  onScroll(event: ScrollEvent): void {
    this.service.updateVirtualScroll(event); // ← DIRECT, not USB!
  }

  /**
   * Cross-feature: USB (rare event).
   */
  onNoteClick(noteId: string, event: Event): void {
    // First handle internally
    this.service.markAsRead(noteId); // ← DIRECT

    // Then notify other features
    this.usbBridge.onNoteClicked(noteId, event); // ← USB
  }
}
```

---

## ⚡ Performance-Regeln (Enterprise-Level)

**ABSOLUTE REGELN für Performance:**

1. **USB Overhead:** < 0.1ms pro Message (gemessen in PerformanceMonitor)
2. **App Start:** < 500ms (wie jetzt)
3. **Timeline Load:** < 1s für 100 notes (wie jetzt)
4. **Scroll Performance:** 60fps konstant (wie jetzt)
5. **Memory:** Kein Memory Leak (Features isoliert)

**Performance Monitoring:**

```typescript
// core/PerformanceMonitor.ts

export class PerformanceMonitor {
  private static enabled = import.meta.env.DEV; // Only in dev
  private static metrics = new Map<string, number[]>();

  /**
   * Measure USB request performance.
   */
  static async measureUSBRequest<T>(
    serviceName: string,
    method: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.enabled) return fn();

    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    // Track metrics
    const key = `${serviceName}.${method}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(duration);

    // Warn if slow
    if (duration > 10) {
      console.warn(`[PERF] Slow USB request: ${key} = ${duration.toFixed(2)}ms`);
    }

    // Fail if too slow (> 100ms)
    if (duration > 100) {
      console.error(`[PERF] CRITICAL: ${key} = ${duration.toFixed(2)}ms - USE DIRECT CALL!`);
    }

    return result;
  }

  /**
   * Get performance report.
   */
  static getReport(): string {
    let report = '\n[PERF] USB Performance Report:\n';

    this.metrics.forEach((durations, key) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      report += `  ${key}: avg=${avg.toFixed(2)}ms, max=${max.toFixed(2)}ms, calls=${durations.length}\n`;
    });

    return report;
  }
}

// In App.ts (dev mode only)
if (import.meta.env.DEV) {
  setInterval(() => {
    console.log(PerformanceMonitor.getReport());
  }, 60000); // Report every minute
}
```

---

## 🔄 USB Implementation

```typescript
// core/USB.ts

/**
 * Uniform Service Bus - Central communication layer for all features.
 *
 * ⚠️ RULE: Features NEVER call each other directly, ALWAYS through USB.
 *
 * Capabilities:
 * - Service Discovery & Registration
 * - Request/Response Pattern
 * - Pub/Sub Events
 * - Type Safety
 * - Debug Logging
 */

interface ServiceHandler {
  [method: string]: Function;
}

export class USB {
  // Service Registry
  private static services = new Map<string, any>();
  private static handlers = new Map<string, ServiceHandler>();

  // Pub/Sub
  private static listeners = new Map<string, Set<Function>>();

  // Debug Mode
  private static debugMode = true; // Set to false in production

  /**
   * Register a service.
   * @param serviceName - Unique service identifier
   * @param service - Service instance
   */
  static register(serviceName: string, service: any): void {
    if (this.services.has(serviceName)) {
      console.warn(`[USB] Service "${serviceName}" already registered. Overwriting.`);
    }
    this.services.set(serviceName, service);
    this.handlers.set(serviceName, {});

    if (this.debugMode) {
      console.log(`[USB] Service registered: ${serviceName}`);
    }
  }

  /**
   * Unregister a service.
   * @param serviceName - Service to remove
   */
  static unregister(serviceName: string): void {
    this.services.delete(serviceName);
    this.handlers.delete(serviceName);

    if (this.debugMode) {
      console.log(`[USB] Service unregistered: ${serviceName}`);
    }
  }

  /**
   * Get a service instance (use sparingly - prefer request/response).
   * @param serviceName - Service name
   * @returns Service instance or null
   */
  static getService<T>(serviceName: string): T | null {
    return this.services.get(serviceName) || null;
  }

  /**
   * Register a request handler for a service method.
   * @param serviceName - Service name
   * @param method - Method name
   * @param handler - Function to handle requests
   */
  static respond(serviceName: string, method: string, handler: Function): void {
    const serviceHandlers = this.handlers.get(serviceName);
    if (!serviceHandlers) {
      throw new Error(`[USB] Service "${serviceName}" not registered`);
    }
    serviceHandlers[method] = handler;

    if (this.debugMode) {
      console.log(`[USB] Handler registered: ${serviceName}.${method}`);
    }
  }

  /**
   * Send a request to a service.
   * @param serviceName - Target service
   * @param method - Method to call
   * @param params - Parameters
   * @returns Promise with result
   */
  static async request<T>(serviceName: string, method: string, params?: any): Promise<T> {
    const serviceHandlers = this.handlers.get(serviceName);
    if (!serviceHandlers) {
      throw new Error(`[USB] Service "${serviceName}" not found`);
    }

    const handler = serviceHandlers[method];
    if (!handler) {
      throw new Error(`[USB] Method "${method}" not found on service "${serviceName}"`);
    }

    if (this.debugMode) {
      console.log(`[USB] Request: ${serviceName}.${method}`, params);
    }

    try {
      const result = await handler(params);
      if (this.debugMode) {
        console.log(`[USB] Response: ${serviceName}.${method}`, result);
      }
      return result;
    } catch (error) {
      console.error(`[USB] Error in ${serviceName}.${method}:`, error);
      throw error;
    }
  }

  /**
   * Publish an event (Pub/Sub).
   * @param event - Event name (namespaced, e.g., 'timeline:note:clicked')
   * @param data - Event payload
   */
  static publish(event: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[USB] Publish: ${event}`, data);
    }

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (error) {
          console.error(`[USB] Error in subscriber for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Subscribe to an event (Pub/Sub).
   * @param event - Event name
   * @param callback - Called when event is published
   * @returns Unsubscribe function
   */
  static subscribe(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.debugMode) {
      console.log(`[USB] Subscribed to: ${event}`);
    }

    // Return unsubscribe function
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param event - Event name
   * @param callback - Callback to remove
   */
  static unsubscribe(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);

    if (this.debugMode) {
      console.log(`[USB] Unsubscribed from: ${event}`);
    }
  }

  /**
   * Clear all services and listeners (use sparingly, mainly for testing).
   */
  static clear(): void {
    this.services.clear();
    this.handlers.clear();
    this.listeners.clear();

    if (this.debugMode) {
      console.log('[USB] Cleared all services and listeners');
    }
  }

  /**
   * Set debug mode.
   * @param enabled - Enable/disable debug logging
   */
  static setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Get all registered services (for debugging).
   * @returns Array of service names
   */
  static getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }
}
```

---

## 📊 Migration zu Vertical Slices

### NEUE REIHENFOLGE (Context-optimiert)

**Phase 0: Foundation (1 Woche)**
1. USB (Uniform Service Bus) erstellen
2. API.md Grundstruktur anlegen
3. Core APIs dokumentieren (USB, NostrAdapter, RelayAdapter placeholders)
4. USB Debug Mode testen

**Phase 1: Vertical Slicing (3-4 Wochen)**

Pro Feature (in dieser Reihenfolge):

1. **Profile Feature** (Klein, isoliert, guter Pilot)
   - ProfileService.register() erstellen
   - Service-Methoden über USB.respond() registrieren
   - API.md: ProfileAPI dokumentieren
   - Internals kapseln
   - USB Request/Response + Pub/Sub integrieren
   - User testet
   - Commit

2. **Timeline Feature** (Groß, zentral)
   - TimelineService.register() erstellen
   - Service-Methoden über USB.respond() registrieren
   - API.md: TimelineAPI dokumentieren
   - Internals kapseln
   - USB integrieren (timeline:note:clicked → USB.publish → ProfileService)
   - User testet
   - Commit

3. **Notifications Feature** (Mittel, isoliert)
   - NotificationsService.register() erstellen
   - API.md dokumentieren
   - USB integrieren
   - User testet
   - Commit

4. **Single Note Feature** (Klein, abhängig von Timeline)
   - SingleNoteService.register() erstellen
   - API.md dokumentieren
   - Nutzt USB.request('timeline', ...) für note data
   - User testet
   - Commit

5. **Bookmarks Feature** (Klein, isoliert)
   - BookmarksService.register() erstellen
   - API.md dokumentieren
   - User testet
   - Commit

**Phase 2: Abstraction Layer (2-3 Wochen)**

JETZT erst NostrAdapter/RelayAdapter bauen (weil Features jetzt isoliert sind):

1. NostrAdapter erstellen
2. API.md: NostrAdapter API dokumentieren
3. Feature für Feature auf NostrAdapter umbauen (wie vorher geplant)
4. User testet nach jedem Feature

**Phase 3: nostr-tools v2.x Migration (1-2 Wochen)**

Nur Adapter anfassen (wie vorher geplant)

**Phase 4: NIP-17 DMs (2-3 Wochen)**

DM Feature als komplett neue Vertical Slice (perfektes Beispiel für Pattern)

---

## 🧠 Warum das Claude's Context-Problem löst

### Workflow VORHER (scheitert):

```
User: "Fix Timeline scroll bug"

Claude Context Load:
- TimelineComponent (relevant)
- TimelineService (relevant)
- PostService (wird von Timeline genutzt)
- ProfileService (Timeline zeigt Profile an)
- ReactionService (Timeline zeigt Reactions)
- ZapService (Timeline zeigt Zaps)
- ThreadOrchestrator (Timeline nutzt Threads)
- FeedOrchestrator (Timeline ist ein Feed)
- NostrTransport (alle nutzen es)
- EventCacheOrchestrator (alle nutzen es)
- ... 15+ weitere Files

→ Context explodiert
→ Context komprimiert
→ Vergesse dass ReactionService auch Profile braucht
→ Breche Profile während Timeline-Fix
```

### Workflow NACHHER (funktioniert):

```
User: "Fix Timeline scroll bug"

Claude Context Load:
✅ features/timeline/TimelineComponent.ts (relevant)
✅ features/timeline/TimelineService.ts (relevant)
✅ features/timeline/TimelineOrchestrator.ts (relevant)
✅ core/USB.ts (API Reference - klein!)
✅ core/NostrAdapter.ts (API Reference)
✅ API.md (Contract Reference)

❌ features/profile/ (BLACK BOX - kommuniziert über USB)
❌ features/notifications/ (BLACK BOX - kommuniziert über USB)
❌ features/dm/ (BLACK BOX - kommuniziert über USB)
❌ features/bookmarks/ (BLACK BOX - kommuniziert über USB)

→ Context bleibt klein
→ Fokus auf Timeline Feature nur
→ Andere Features können nicht brechen (isoliert durch USB)
→ API.md garantiert Kompatibilität
→ USB Debug Logging zeigt alle Cross-Feature Kommunikation
```

---

## ⚠️ NEUE Critical Success Factors

**ZUSÄTZLICH zu den vorherigen:**

7. **API.md MUSS bei JEDER Änderung aktualisiert werden** (vor Code schreiben)
8. **Claude MUSS API.md lesen bevor Feature-Arbeit** (Context-Primer)
9. **Features sind Black Boxes** (nur Public API nutzen)
10. **Ein Feature zur Zeit** (Context-Load minimieren)
11. **User reviewed API.md vor Commit** (Architektur-Validierung)
12. **USB NUR für Cross-Feature** (internal = DIRECT)
13. **Performance < 0.1ms pro USB call** (gemessen in PerformanceMonitor)
14. **No USB for High-Frequency** (scroll, render, etc. = DIRECT)

---

## 🎯 Updated Timeline

**Total: 6-10 Wochen** (statt 5-8, wegen Vertical Slicing Phase)

Aber: **VIEL höhere Erfolgswahrscheinlichkeit** wegen Context-Management.

---

## 📝 NEUE Next Steps

1. ✅ **JETZT:** current-tasks.md abarbeiten
2. ⏳ **DANN:** Phase 0 (EventBus + API.md Foundation)
3. ⏳ **DANN:** Phase 1 (Vertical Slicing, Feature für Feature)
4. ⏳ **DANN:** Phase 2 (Abstraction Layer)
5. ⏳ **DANN:** Phase 3 (nostr-tools v2.x Migration)
6. ⏳ **ZIEL:** Phase 4 (NIP-17 DMs als perfekte Vertical Slice)

---

**Status:** Planning Phase - Extended with Vertical Slice Architecture + Hybrid USB
**Last Updated:** 2025-10-30
**Critical Additions:**
- Context Memory Problem + Microservices Solution
- USB Hybrid-Ansatz (selektiv, nicht überall)
- Performance-First: USB < 0.1ms, App bleibt schnell
**Owner:** Claude + User (gemeinsame Verantwortung)

---

## 📊 TL;DR - Final Architecture Summary

### Was wir bauen:

1. **Vertical Slices** - Features isoliert (Timeline, Profile, DMs, etc.)
2. **USB Hybrid** - NUR für Cross-Feature Communication (selten)
3. **Direct Calls** - Feature-intern und Core Services (häufig, performance-critical)
4. **Performance Monitoring** - USB Overhead < 0.1ms gemessen

### Kommunikations-Regeln:

```
INTERNAL (99% der Calls):        Component → Service → Orchestrator (DIRECT)
CROSS-FEATURE (1% der Calls):    Feature A → USB → Feature B (USB)
HIGH-FREQUENCY (scroll, etc.):   ALWAYS DIRECT (never USB)
APP-WIDE (login, theme):         USB (rare events)
```

### Warum das funktioniert:

- ✅ Context bleibt klein (ein Feature zur Zeit)
- ✅ Performance bleibt hoch (direct calls intern)
- ✅ Features isoliert (USB nur für Cross-Feature)
- ✅ Keine Breaking Changes (Abstraction Layer)
- ✅ Messbar (PerformanceMonitor)

### Was NICHT passiert:

- ❌ Alles durch USB (wäre zu langsam)
- ❌ Schwerfälliges Ungetüm (Performance-First)
- ❌ Context-Overload (Vertical Slices)
- ❌ Feature-Spaghetti (USB Bridge Pattern)
