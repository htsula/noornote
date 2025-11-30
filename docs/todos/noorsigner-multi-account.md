# NoorSigner Multi-Account Support

## Übersicht

NoorSigner verwaltet mehrere Keys, damit NoorNote Account-Switching unterstützt.

---

## NoorSigner Stand (Phasen 1-3) - ✅ FERTIG

### CLI Commands
```bash
noorsigner add-account     # nsec + Passwort einrichten
noorsigner list-accounts   # Alle Accounts auflisten
noorsigner switch <npub>   # Account wechseln
noorsigner remove-account <npub>  # Account entfernen
noorsigner init            # Alias für add-account (erster Account)
noorsigner daemon          # Daemon starten
```

### Dateistruktur
```
~/.noorsigner/
├── accounts/
│   ├── npub1abc.../
│   │   ├── keys.encrypted    # Encrypted nsec
│   │   └── trust_session     # 24h password cache
│   └── npub1def.../
│       ├── keys.encrypted
│       └── trust_session
├── active_account            # Currently active npub
└── noorsigner.sock           # Daemon socket (shared)
```

### API Endpoints (Socket IPC)

**`list_accounts`**
```json
Request:  { "id": "req-001", "method": "list_accounts" }
Response: { "id": "req-001", "accounts": [...], "active_pubkey": "abc123..." }
```

**`add_account`**
```json
Request:  { "id": "req-002", "method": "add_account", "nsec": "nsec1...", "password": "...", "set_active": true }
Response: { "id": "req-002", "success": true, "pubkey": "...", "npub": "..." }
```

**`switch_account`**
```json
Request:  { "id": "req-003", "method": "switch_account", "pubkey": "def456...", "password": "..." }
Response: { "id": "req-003", "success": true, "pubkey": "...", "npub": "..." }
```

**`remove_account`**
```json
Request:  { "id": "req-004", "method": "remove_account", "pubkey": "...", "password": "..." }
Response: { "id": "req-004", "success": true }
```

**`get_active_account`**
```json
Request:  { "id": "req-005", "method": "get_active_account" }
Response: { "id": "req-005", "pubkey": "...", "npub": "...", "is_unlocked": true }
```

---

## Phase 4: NoorNote Integration - ❌ TODO

### 4.1 KeySignerClient.ts erweitern

```typescript
class KeySignerClient {
  // Existing methods...

  // NEW: Multi-account methods
  async listAccounts(): Promise<Account[]>
  async addAccount(nsec: string, password: string, setActive?: boolean): Promise<AddAccountResult>
  async switchAccount(pubkeyOrNpub: string, password: string): Promise<SwitchResult>
  async removeAccount(pubkey: string, password: string): Promise<boolean>
  async getActiveAccount(): Promise<ActiveAccount>
}
```

### 4.2 AccountSwitcher Component

Dropdown in `.secondary-user` (ersetzt UserStatus):

```
┌─────────────────────────────┐
│  ● username                 │  ← Current user (green dot = active)
│  [Sign Out ▼]               │  ← Dropdown trigger
├─────────────────────────────┤
│  SWITCH ACCOUNT             │
│  ┌─────────────────────────┐│
│  │ 👤 alice    [NoorSigner]││  ← Active account
│  │ 👤 bob      [NoorSigner]││  ← Password required to switch
│  │ + Add account           ││
│  └─────────────────────────┘│
│  ← Log out alice            │
│  ← Log out all              │
└─────────────────────────────┘
```

**Passwort-Dialog bei Switch:**
- NoorSigner erfordert Passwort für jeden Account
- Modal mit Passwort-Eingabe vor Switch
- Trust Session (24h) gilt pro Account

### 4.3 "Add Account" Flow

1. User klickt "+ Add account" in AccountSwitcher
2. Router navigiert zu `/login?addAccount=true`
3. AuthComponent erkennt `addAccount` param
4. Nach erfolgreichem Login:
   - Account zu NoorSigner hinzugefügt (via `add_account` API)
   - Zurück zur vorherigen Route
5. AccountSwitcher zeigt neuen Account

### 4.4 Account Switch Flow

1. User klickt auf anderen Account
2. Passwort-Modal erscheint
3. Nach Eingabe: `KeySignerClient.switchAccount(npub, password)`
4. Bei Erfolg:
   - `user:logout` emittiert (clears caches)
   - `user:login` emittiert (loads new profile)
   - UI aktualisiert sich

### 4.5 AccountStorageService

Speichert Account-Metadaten in localStorage (nicht die Keys - die sind in NoorSigner):

```typescript
interface StoredAccount {
  pubkey: string;
  npub: string;
  displayName?: string;   // Cached from profile
  avatarUrl?: string;     // Cached from profile
  addedAt: number;
  lastUsedAt: number;
}

class AccountStorageService {
  private readonly STORAGE_KEY = 'noornote_accounts';

  getAccounts(): StoredAccount[]
  addAccount(account: StoredAccount): void
  removeAccount(pubkey: string): void
  updateAccount(pubkey: string, updates: Partial<StoredAccount>): void
}
```

---

## Betroffene Dateien

### NoorSigner (../noorsigner/) - ✅ FERTIG
- `main.go` - CLI Commands
- `accounts.go` - Multi-Account Storage, Migration
- `daemon.go` - API Endpoints
- `README.md` - Dokumentation

### NoorNote - ❌ TODO
| Datei | Änderung |
|-------|----------|
| `src/services/KeySignerClient.ts` | Neue API Methods |
| `src/services/AccountStorageService.ts` | NEU - Account Metadata |
| `src/components/ui/AccountSwitcher.ts` | NEU - ersetzt UserStatus |
| `src/components/ui/UserStatus.ts` | DEPRECATED |
| `src/styles/components/_account-switcher.scss` | NEU |
| `src/components/layout/MainLayout.ts` | Update für AccountSwitcher |
| `src/components/auth/AuthComponent.ts` | Add Account Flow |

---

## Implementation Checklist

### Phase 4 Tasks
- [ ] KeySignerClient.ts: `listAccounts()` implementieren
- [ ] KeySignerClient.ts: `addAccount()` implementieren
- [x] KeySignerClient.ts: `switchAccount()` implementieren ✅
- [ ] KeySignerClient.ts: `removeAccount()` implementieren
- [ ] KeySignerClient.ts: `getActiveAccount()` implementieren
- [ ] AccountStorageService erstellen
- [ ] AccountSwitcher Component erstellen
- [x] Passwort-Modal für Switch erstellen ✅
- [ ] MainLayout: UserStatus → AccountSwitcher ersetzen
- [ ] AuthComponent: `addAccount` Query-Param Support
- [ ] SCSS für AccountSwitcher

### Zusätzlich erledigt (2024-11-30)
- [x] Per-user file storage (`~/.noornote/{npub}/`) ✅
- [x] Cache-Clearing bei user:login Events ✅
- [x] RestoreListsService für cascading restore ✅

---

## Edge Cases

### Passwort-Handling
- Jeder Account hat eigenes Passwort
- Trust Session (24h) gilt pro Account separat
- Bei Switch: Passwort-Prompt wenn Trust Session abgelaufen

### Account Switch
1. Current session saved
2. `user:logout` emittiert (clears caches, subscriptions)
3. `user:login` emittiert (loads profile, relay lists)
4. UI updates

### Security
- Keys bleiben in NoorSigner (nie in NoorNote)
- Nur Metadaten (displayName, avatar) in localStorage
- Passwort wird nie gespeichert
