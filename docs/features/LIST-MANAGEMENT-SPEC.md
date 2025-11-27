# List Management Specification

## CORE PRINCIPLE

List management is **AGNOSTIC** - the system works identically for ALL list types (Follows, Mutes, Bookmarks, future lists).

## DATA MODEL

### Per List Entity

Each list exists in **2 versions**:
- **Public**: Visible to everyone on relays
- **Private**: Encrypted, only visible to logged-in user

### Storage Locations (3 total)

```
┌─────────────────────────────────────────────────────────────┐
│                    localStorage (Browser)                    │
│                     = WORKING VERSION                        │
│                                                              │
│  Single array with isPrivate flag per item                  │
│  UI shows as ONE list (private items have "Private Badge")  │
└─────────────────────────────────────────────────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│   Local JSON Files    │       │       Relays          │
│   ~/.noornote/        │       │                       │
│                       │       │   ONE EVENT per list: │
│   {list}-public.json  │       │   - tags: public      │
│   {list}-private.json │       │   - content: private  │
└───────────────────────┘       └───────────────────────┘
```

### CRITICAL: JSON Identity

**Local JSON files MUST be IDENTICAL to what gets published to relays.**

This means: **ONE serialization routine** for both destinations.

```typescript
// CORRECT: Single source of truth for serialization
const json = serializeListForExport(browserItems);
await writeToFile(json);      // Same JSON
await publishToRelays(json);  // Same JSON
```

## USER OPERATIONS (4 Buttons)

### Relay Sync
| Button | Direction | Behavior |
|--------|-----------|----------|
| **Sync from Relays** | Relays → Browser | Fetch + merge with confirmation if local has more |
| **Sync to Relays** | Browser → Relays | Overwrite relays with browser items |

### Local Backup
| Button | Direction | Behavior |
|--------|-----------|----------|
| **Save to File** | Browser → Files | Overwrite files with browser items |
| **Restore from File** | Files → Browser | Overwrite browser with file items |

## NOSTR EVENT STRUCTURE (NIP-51)

### THE GOLDEN RULE: ONE EVENT, SAME-EVENT ENCRYPTION

Per NIP-51 standard, **ALL lists** use the same pattern:
- **Public items** → event `tags` array
- **Private items** → event `content` (encrypted JSON array of tags)
- **BOTH IN THE SAME EVENT!**

```
┌─────────────────────────────────────────┐
│            ONE Nostr Event              │
│                                         │
│  kind: 3 (or 10000, 10003, etc.)       │
│                                         │
│  tags: [                                │
│    ["p", "public_follow_1"],            │
│    ["p", "public_follow_2"]             │
│  ]                                      │
│                                         │
│  content: encrypted(JSON.stringify([    │
│    ["p", "private_follow_1"],           │
│    ["p", "private_follow_2"]            │
│  ]))                                    │
│                                         │
└─────────────────────────────────────────┘
```

### Event Kinds per List

| List | Kind | Public | Private |
|------|------|--------|---------|
| **Follows** | 3 | tags | encrypted content |
| **Mutes** | 10000 | tags | encrypted content |
| **Bookmarks** | 10003 | tags | encrypted content |

**IMPORTANT: kind:30000, 30002, 30003 are for SETS (multiple named lists per user like "close friends", "news sources") - NOT for private items!**

### Tag Types

| Tag | Meaning | Used in |
|-----|---------|---------|
| `p` | Pubkey (user) | Follows, Mutes |
| `e` | Event ID | Bookmarks, Muted threads |
| `a` | Parameterized replaceable event | Bookmarks (articles) |
| `t` | Hashtag | Bookmarks, Interests |
| `r` | URL | Bookmarks |
| `word` | Muted word (lowercase) | Mutes |

### Encryption

- **NIP-44**: Current standard (preferred)
- **NIP-04**: Deprecated but supported for backward compatibility
- **Detection**: Check for "iv" in ciphertext → NIP-04, otherwise NIP-44
- **Key**: Shared key computed using author's own public+private key pair

## CLIENT COMPATIBILITY

**Jumble and YakiHonne do NOT support private items** - they only read/write the public `tags`.

**NoorNote DOES support private items** - we read/write both `tags` AND encrypted `content`.

This means:
- **Public items** sync bidirectionally with Jumble/YakiHonne
- **Private items** are NoorNote-only (invisible to other clients, but preserved)

## VALIDATION REQUIREMENT

**Published PUBLIC items MUST be visible in Jumble and YakiHonne.**

These clients implement NIP-51 correctly for public items. If our public items don't appear there, OUR implementation is wrong.

Never assume other clients are broken. Debug OUR code first.

## IMPLEMENTATION RULES

1. **ONE event per list** - public in tags, private in encrypted content
2. **ONE serialization routine** for files AND relays
3. **isPrivate flag** on each item determines tags vs content
4. **Browser is working copy** - all edits happen here first
5. **Files and Relays are backups** - only updated on explicit user action
6. **Test public items against Jumble/YakiHonne** before considering relay sync "working"

## EDGE CASE: Private Items bei Mixed-Client Usage

### Das Problem

Dieses Problem betrifft **ALLE Listen** (Follows, Mutes, Bookmarks) wenn der User mehrere Clients mit unterschiedlicher Private-Item-Unterstützung verwendet.

**Szenario A - Client OHNE Private-Support überschreibt:**
1. NoorNote publisht: `tags=[public]` + `content=encrypted([private])`
2. User nutzt Primal/Jumble (kein Private-Support) und ändert public Items
3. Primal publisht: `tags=[modified_public]` + `content=""` (leer!)
4. Private Items sind auf dem Relay VERLOREN (Primal kann encrypted content nicht preserven)

**Szenario B - Client MIT Private-Support löscht legitim:**
1. NoorNote-A publisht: `tags=[public]` + `content=encrypted([private])`
2. User nutzt NoorNote-B und löscht ein private Item
3. NoorNote-B publisht: `tags=[public]` + `content=encrypted([remaining_private])`
4. Private Item Löschung ist LEGITIM und sollte syncen

### Die Lösung

Bei "Sync from Relays" prüfen wir `event.content`:

```
WENN event.content LEER oder nur Whitespace:
  → Anderer Client (ohne Private-Support) hat überschrieben
  → BEHALTE alle lokalen private Items (nicht als "removed" markieren)
  → Nur public Items normal syncen

WENN event.content NICHT LEER:
  → Entschlüssle private Items vom Relay
  → Vergleiche normal (erlaube legitime Löschungen)
  → Vertraue den private Items vom Relay
```

### Implementierung (in ListSyncManager)

```typescript
// Bei calculateDiff:
// relayContentWasEmpty wird vom Adapter übergeben
if (relayContentWasEmpty) {
  // Anderer Client hat überschrieben - lokale private Items behalten
  const removed = browserItems.filter(item => {
    if ((item as any).isPrivate) return false; // Private Items NIE entfernen
    return !relayIds.has(this.adapter.getItemId(item));
  });
} else {
  // Content existiert - normal vergleichen
  // Private Items vom Relay sind autoritativ
}

// Bei applySyncFromRelays mit 'overwrite' Strategie:
if (relayContentWasEmpty) {
  // Lokale private Items behalten auch bei overwrite
  const localPrivateItems = browserItems.filter(item => (item as any).isPrivate);
  this.adapter.setBrowserItems([...relayItems, ...localPrivateItems]);
} else {
  // Normales overwrite - Relay komplett vertrauen
  this.adapter.setBrowserItems(relayItems);
}
```

### User Guidance

- **Private Items löschen:** Lokal in NoorNote löschen, dann "Sync to Relays"
- **Andere Clients nutzen:** Public Items syncen normal; private Items bleiben lokal erhalten
- **Mehrere NoorNote-Instanzen:** Private Item Löschungen syncen korrekt zwischen ihnen

## FUTURE: Auto-Sync

Once manual sync works flawlessly:
- Auto-sync to relays on changes (debounced)
- Auto-backup to files periodically
- Conflict resolution UI

**But first: Get manual sync working correctly.**
