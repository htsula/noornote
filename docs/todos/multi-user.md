# Multi-User Support - Implementation Plan

## Overview

Enable multiple account management in NoorNote so users can switch between accounts without re-entering credentials. Required for testing NIP-17 DMs between own accounts.

## Prerequisites - Read These Files First

Before implementing, read and understand:

1. **`src/services/AuthService.ts`** - Current auth logic, session storage, auth methods
2. **`src/services/KeychainStorage.ts`** - Secure nsec storage (Keychain/IndexedDB fallback)
3. **`src/services/PlatformService.ts`** - Platform detection (Tauri vs Browser)
4. **`src/components/ui/UserStatus.ts`** - Current user display component (to be replaced)
5. **`src/components/layout/MainLayout.ts`** - Where UserStatus is integrated (lines 586-610, `.secondary-user` container)
6. **`src/components/auth/AuthComponent.ts`** - Login UI (reused for "Add account")
7. **`docs/todos/x-platform/platform-strategy.md`** - Browser-first strategy, feature matrix

## UX Reference (Jumble/YakiHonne Pattern)

```
┌─────────────────────────────┐
│  ● username                 │  ← Current user (green dot = active)
│  [Sign Out ▼]               │  ← Dropdown trigger
├─────────────────────────────┤
│  SWITCH ACCOUNT             │
│  ┌─────────────────────────┐│
│  │ 👤 alice    [Remote] ●  ││  ← Active account
│  │ 👤 bob      [Local]     ││  ← Other stored accounts
│  │ + Add account           ││
│  └─────────────────────────┘│
│  ← Log out alice            │
│  ← Log out all              │
└─────────────────────────────┘
```

**Badges:**
- `[Remote]` = NIP-46 bunker, Extension
- `[Local]` = nsec stored locally
- `[Read-only]` = npub only
- `●` green dot = currently active

## Architecture Changes

### 1. AccountStorageService (NEW)

```typescript
// src/services/AccountStorageService.ts

interface StoredAccount {
  pubkey: string;           // Unique identifier
  npub: string;
  authMethod: AuthMethod;   // 'nsec' | 'npub' | 'extension' | 'nip46' | 'key-signer'
  displayName?: string;     // Cached from profile
  avatarUrl?: string;       // Cached from profile
  addedAt: number;          // Timestamp
  lastUsedAt: number;       // For sorting
  // Method-specific data:
  bunkerUri?: string;       // For nip46
}

class AccountStorageService {
  private readonly STORAGE_KEY = 'noornote_accounts';

  // Get all stored accounts
  getAccounts(): StoredAccount[]

  // Add account to storage (called after successful login)
  addAccount(account: StoredAccount): void

  // Remove account from storage
  removeAccount(pubkey: string): void

  // Update account (e.g., displayName from profile)
  updateAccount(pubkey: string, updates: Partial<StoredAccount>): void

  // Get specific account
  getAccount(pubkey: string): StoredAccount | null

  // Clear all accounts
  clearAll(): void
}
```

**Storage Location:** localStorage (`noornote_accounts`)

### 2. KeychainStorage Extension

**Platform-Aware Storage:**
- **Tauri:** Real Keychain (macOS Keychain, etc.) - secure
- **Browser:** IndexedDB fallback - less secure but functional

Most account types don't need nsec storage at all:
| Account Type | nsec Storage Needed? |
|--------------|---------------------|
| NIP-07 Extension | ❌ No (extension manages keys) |
| NoorSigner | ❌ No (daemon manages keys) |
| Remote Signer (bunker://) | ❌ No (bunkerUri in localStorage, no secrets) |
| Direct nsec | ✅ Yes (edge case, mostly Tauri users) |
| npub (read-only) | ❌ No |

```typescript
// Extend KeychainStorage to support multiple nsecs

// Current: Single key "noornote_nsec"
// New: Key per account "noornote_nsec_{pubkey}"

class KeychainStorage {
  // Existing (keep for backward compat during migration)
  static saveNsec(nsec: string): Promise<void>
  static loadNsec(): Promise<string | null>

  // NEW: Per-account nsec storage
  static saveNsecForAccount(pubkey: string, nsec: string): Promise<void>
  static loadNsecForAccount(pubkey: string): Promise<string | null>
  static deleteNsecForAccount(pubkey: string): Promise<void>
}
```

**Note:** KeychainStorage already handles platform detection via `PlatformService.isTauri`.

### 3. AuthService Extension

```typescript
class AuthService {
  // Existing methods remain unchanged

  // NEW: Switch to a stored account
  async switchAccount(pubkey: string): Promise<{ success: boolean; error?: string }>

  // NEW: Get stored accounts (delegates to AccountStorageService)
  getStoredAccounts(): StoredAccount[]

  // NEW: Remove account from storage
  async removeStoredAccount(pubkey: string): Promise<void>

  // NEW: Log out all accounts
  async signOutAll(): Promise<void>

  // MODIFY: After successful login, also add to AccountStorageService
  // authenticateWithNsec() → also calls accountStorage.addAccount()
  // authenticateWithBunker() → also calls accountStorage.addAccount()
  // etc.
}
```

### 4. AccountSwitcher Component (NEW)

Replaces `UserStatus` component with dropdown functionality.

```typescript
// src/components/ui/AccountSwitcher.ts

class AccountSwitcher {
  private dropdown: HTMLElement;
  private isOpen: boolean = false;

  // Render current user + dropdown trigger
  private renderTrigger(): HTMLElement

  // Render dropdown content
  private renderDropdown(): HTMLElement

  // Render single account item
  private renderAccountItem(account: StoredAccount, isActive: boolean): HTMLElement

  // Handle account switch
  private async handleSwitch(pubkey: string): Promise<void>

  // Handle add account (opens login modal/navigates to login)
  private handleAddAccount(): void

  // Handle logout current
  private handleLogout(): void

  // Handle logout all
  private handleLogoutAll(): void
}
```

**SCSS:** `src/styles/components/_account-switcher.scss`

### 5. Profile Caching for Accounts

When switching accounts, cache basic profile info for display:

```typescript
// In AccountStorageService or separate ProfileCacheService

async function cacheAccountProfile(pubkey: string): Promise<void> {
  const profile = await UserProfileService.getUserProfile(pubkey);
  accountStorage.updateAccount(pubkey, {
    displayName: profile.name || profile.display_name,
    avatarUrl: profile.picture
  });
}
```

## Implementation Phases

### Phase 1: Storage Infrastructure
- [ ] Create `AccountStorageService`
- [ ] Extend `KeychainStorage` for per-account nsec
- [ ] Add migration from old single-account storage

### Phase 2: AuthService Integration
- [ ] Add `switchAccount()` method
- [ ] Modify auth methods to save account after login
- [ ] Add `getStoredAccounts()`, `removeStoredAccount()`, `signOutAll()`
- [ ] Handle edge cases (extension unavailable, bunker expired, etc.)

### Phase 3: UI Component
- [ ] Create `AccountSwitcher` component
- [ ] Create SCSS styles (dropdown, badges, account items)
- [ ] Replace `UserStatus` with `AccountSwitcher` in MainLayout
- [ ] Add "Add account" flow (modal or navigate to login view)

### Phase 4: Polish & Edge Cases
- [ ] Profile caching for offline display
- [ ] Handle auth method availability (extension not installed, etc.)
- [ ] Error handling for expired bunker sessions
- [ ] Keyboard navigation for dropdown
- [ ] Mobile-friendly dropdown positioning

## Edge Cases & Considerations

### Auth Method Availability
- **Extension**: May not be available → show as "unavailable" with option to remove
- **NIP-46 Bunker**: Session may expire → need re-auth flow
- **Key-Signer**: Daemon may not be running → show connection status
- **nsec**: Always available (stored in Keychain)
- **npub**: Always available (read-only)

### Account Switch Flow
1. User clicks different account
2. Current session saved to storage (if needed)
3. New account loaded
4. `user:logout` emitted (clears caches)
5. `user:login` emitted (loads new profile, relay lists, etc.)
6. UI updates

### Storage Limits
- Reasonable limit: ~10 accounts
- Show warning if approaching limit
- Old unused accounts can be removed

### Security
- nsec stored in Keychain (OS-level security)
- bunkerUri stored in localStorage (contains no secrets)
- Never show nsec in UI
- "Remove account" should also delete nsec from Keychain

## File Changes Summary

| File | Change |
|------|--------|
| `src/services/AccountStorageService.ts` | NEW |
| `src/services/KeychainStorage.ts` | Extend |
| `src/services/AuthService.ts` | Extend |
| `src/components/ui/AccountSwitcher.ts` | NEW (replaces UserStatus) |
| `src/components/ui/UserStatus.ts` | DEPRECATED |
| `src/styles/components/_account-switcher.scss` | NEW |
| `src/styles/main.scss` | Add import |
| `src/components/layout/MainLayout.ts` | Update to use AccountSwitcher |

## Testing Scenarios

1. **Add second account**: Login → Add account → Login with different creds → Switch back
2. **Switch accounts**: Should update timeline, profile, relay lists
3. **Remove account**: Should delete from storage and Keychain
4. **Extension unavailable**: After browser restart, extension account shows unavailable
5. **Bunker expired**: NIP-46 account shows need to re-authenticate
6. **Logout all**: Clears all accounts and returns to login view

## Design Decisions

1. **"Add account" flow**: Navigate to existing LoginView (YakiHonne pattern)
   - Reuses existing AuthComponent
   - No new modal needed
   - "Cancel" returns to previous view

2. **Account switch**: In-place update with `user:logout` → `user:login` cycle
   - No page reload needed
   - Triggers relay list refresh, cache clear, etc.

3. **Maximum accounts**: Soft limit of 10, warn at 8

## Critical Implementation Details

### MainLayout Integration Point

UserStatus is created in `MainLayout.setUserStatus()` (line 586) and inserted into `.secondary-user`:

```typescript
// MainLayout.ts line 586-610
public setUserStatus(npub: string, pubkey: string): void {
  this.userStatus = new UserStatus({ npub, pubkey, onLogout: () => this.handleLogout() });
  const secondaryUser = this.element.querySelector('.secondary-user');
  secondaryUser.appendChild(this.userStatus.getElement());
}
```

**Change required:** Replace `UserStatus` with `AccountSwitcher` in:
- Import (line 8)
- Property declaration (line 31)
- `setUserStatus()` method (line 586)
- `clearUserStatus()` method (line 626)

### KeychainStorage Key Pattern

Current single-account pattern:
```typescript
KEY_NSEC = 'nsec'  // Keychain key: "noornote" + "nsec"
```

New multi-account pattern:
```typescript
// For account with pubkey "abc123..."
KEY_NSEC_PREFIX = 'nsec_'  // Keychain key: "noornote" + "nsec_abc123..."
```

**Tauri Keychain:** Uses `setPassword(service, key, value)` where service="noornote"
**Browser fallback:** Uses IndexedDB with key as identifier

### "Add Account" Navigation Flow

1. User clicks "+ Add account" in AccountSwitcher dropdown
2. Router navigates to `/login` with query param: `router.navigate('/login?addAccount=true')`
3. AuthComponent checks for `addAccount` param
4. After successful login:
   - Account added to AccountStorageService
   - If `addAccount=true`: Navigate back to previous route (not to timeline)
   - Router: `router.navigateBack()` or `router.navigate(previousRoute)`
5. AccountSwitcher updates to show new account

### Migration from Single-Account Storage

On first load after update:
1. Check if old `noornote_auth_session` exists
2. Check if old `nsec` key exists in Keychain
3. If yes: Migrate to new format
   - Create StoredAccount from session data
   - Move nsec to new key pattern (`nsec_{pubkey}`)
   - Delete old keys
4. Set migration flag in localStorage to skip next time

```typescript
// AccountStorageService
private async migrateFromSingleAccount(): Promise<void> {
  const oldSession = localStorage.getItem('noornote_auth_session');
  if (!oldSession) return;

  const session = JSON.parse(oldSession);
  if (session.authMethod === 'nsec') {
    // Migrate nsec from old key to new key pattern
    const oldNsec = await KeychainStorage.loadNsec();
    if (oldNsec) {
      await KeychainStorage.saveNsecForAccount(session.pubkey, oldNsec);
      await KeychainStorage.deleteNsec(); // Delete old key
    }
  }

  // Add to accounts storage
  this.addAccount({
    pubkey: session.pubkey,
    npub: session.npub,
    authMethod: session.authMethod,
    addedAt: Date.now(),
    lastUsedAt: Date.now()
  });

  localStorage.setItem('noornote_migration_done', 'true');
}
