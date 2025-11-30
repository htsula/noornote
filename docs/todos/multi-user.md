# Multi-User Support - Implementation Plan

## Overview

Enable multiple account management in NoorNote so users can switch between accounts without re-entering credentials. Required for testing NIP-17 DMs between own accounts.

## Prerequisites - Read These Files First

Before implementing, read and understand:

1. **`src/services/AuthService.ts`** - Current auth logic, session storage, auth methods
2. **`src/services/KeychainStorage.ts`** - Secure storage (Keychain/IndexedDB fallback)
3. **`src/services/PlatformService.ts`** - Platform detection (Tauri vs Browser)
4. **`src/components/ui/UserStatus.ts`** - Current user display component (to be replaced)
5. **`src/components/layout/MainLayout.ts`** - Where UserStatus is integrated (lines 586-610, `.secondary-user` container)
6. **`src/components/auth/AuthComponent.ts`** - Login UI (reused for "Add account")
7. **`docs/todos/x-platform/platform-strategy.md`** - Dual-platform strategy, feature matrix

## Auth Methods by Platform

| Platform | Auth Method | nsec Storage? |
|----------|-------------|---------------|
| Browser | Browser Extension (NIP-07) | No (extension manages) |
| Browser | Hardware Remote Signer (bunker://) | No (bunkerUri only) |
| Tauri | NoorSigner (Local Key Signer) | No (daemon manages) |
| Tauri | Hardware Remote Signer (bunker://) | No (bunkerUri only) |

**Key insight:** No auth method requires nsec storage in AccountStorageService. Keys are managed by:
- Extension (browser manages)
- NoorSigner daemon (daemon manages)
- Remote signer (bunkerUri stored, no secrets)

## UX Reference (Jumble/YakiHonne Pattern)

```
┌─────────────────────────────┐
│  ● username                 │  ← Current user (green dot = active)
│  [Sign Out ▼]               │  ← Dropdown trigger
├─────────────────────────────┤
│  SWITCH ACCOUNT             │
│  ┌─────────────────────────┐│
│  │ 👤 alice    [Remote] ●  ││  ← Active account
│  │ 👤 bob      [Extension] ││  ← Other stored accounts
│  │ + Add account           ││
│  └─────────────────────────┘│
│  ← Log out alice            │
│  ← Log out all              │
└─────────────────────────────┘
```

**Badges:**
- `[Extension]` = NIP-07 Browser Extension (Browser only)
- `[NoorSigner]` = Local Key Signer (Tauri only)
- `[Remote]` = Hardware Remote Signer (bunker://)
- `●` green dot = currently active

## Architecture Changes

### 1. AccountStorageService (NEW)

```typescript
// src/services/AccountStorageService.ts

interface StoredAccount {
  pubkey: string;           // Unique identifier (hex)
  npub: string;             // Bech32 format
  authMethod: AuthMethod;   // 'extension' | 'nip46' | 'key-signer'
  displayName?: string;     // Cached from profile
  avatarUrl?: string;       // Cached from profile
  addedAt: number;          // Timestamp
  lastUsedAt: number;       // For sorting
  // Method-specific data:
  bunkerUri?: string;       // For nip46 (Hardware Remote Signer)
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

### 2. AuthService Extension

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
  // authenticate() → also calls accountStorage.addAccount()
  // authenticateWithBunker() → also calls accountStorage.addAccount()
  // authenticateWithKeySigner() → also calls accountStorage.addAccount()
}
```

### 3. AccountSwitcher Component (NEW)

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

### 4. Profile Caching for Accounts

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

## Edge Cases & Considerations

### Auth Method Availability
- **Extension**: May not be available → show as "unavailable" with option to remove
- **NIP-46 Bunker**: Session may expire → need re-auth flow
- **NoorSigner**: Daemon may not be running → show connection status

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
- bunkerUri stored in localStorage (contains no secrets)
- Never show sensitive data in UI
- "Remove account" cleans up all related storage

## File Changes Summary

| File | Change |
|------|--------|
| `src/services/AccountStorageService.ts` | NEW |
| `src/services/AuthService.ts` | Extend |
| `src/components/ui/AccountSwitcher.ts` | NEW (replaces UserStatus) |
| `src/components/ui/UserStatus.ts` | DEPRECATED |
| `src/styles/components/_account-switcher.scss` | NEW |
| `src/styles/main.scss` | Add import |
| `src/components/layout/MainLayout.ts` | Update to use AccountSwitcher |

## Testing Scenarios

1. **Add second account**: Login → Add account → Login with different creds → Switch back
2. **Switch accounts**: Should update timeline, profile, relay lists
3. **Remove account**: Should delete from storage
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
2. If yes: Migrate to new format
   - Create StoredAccount from session data
   - Add to AccountStorageService
3. Set migration flag in localStorage to skip next time

```typescript
// AccountStorageService
private async migrateFromSingleAccount(): Promise<void> {
  const migrationDone = localStorage.getItem('noornote_accounts_migration_done');
  if (migrationDone) return;

  const oldSession = localStorage.getItem('noornote_auth_session');
  if (!oldSession) {
    localStorage.setItem('noornote_accounts_migration_done', 'true');
    return;
  }

  const session = JSON.parse(oldSession);

  // Add to accounts storage
  this.addAccount({
    pubkey: session.pubkey,
    npub: session.npub,
    authMethod: session.authMethod,
    addedAt: Date.now(),
    lastUsedAt: Date.now()
  });

  localStorage.setItem('noornote_accounts_migration_done', 'true');
}
```
