# Phase 1: Static Mutuals List (MVP)

**Status:** Planned
**Priority:** HIGH
**Effort:** 4-6 hours
**Dependencies:** None
**Phase:** 1 of 6

---

## Goal

Create a simple, static list showing all people you follow with their mutual status.

**User Value:** "I want to see at a glance who follows me back and who doesn't, so I can clean up my follows."

---

## Scope

### In Scope
- ✅ New tab under Lists → Mutuals
- ✅ Display all followings with mutual status badges
- ✅ Stats display: "Following: 150 | Mutuals: 87 (58%)"
- ✅ Unfollow button for each user
- ✅ Filter: "Show only non-mutuals"
- ✅ Basic styling (consistent with existing lists)

### Out of Scope
- ❌ Change detection (Phase 2)
- ❌ Snapshots/history (Phase 2)
- ❌ Notifications (Phase 4)
- ❌ Background checks (Phase 4)
- ❌ Reciprocity analysis (Phase 5)
- ❌ Strength scoring (Phase 6)

---

## User Stories

### Story 1: View Mutuals List
```
As a user,
I want to see all people I follow with their mutual status,
So I can identify who doesn't follow me back.
```

**Acceptance Criteria:**
- [ ] Tab accessible from sidebar: Lists → Mutuals
- [ ] Shows all followings (fetched from current follow list)
- [ ] Each item shows: Avatar, Username, Mutual badge
- [ ] Badge: "✓ Mutual" (green) or "Not following back" (gray)
- [ ] List is sorted alphabetically

### Story 2: View Stats
```
As a user,
I want to see overall mutual statistics,
So I understand my follow/mutual ratio.
```

**Acceptance Criteria:**
- [ ] Header shows: "Following: 150 | Mutuals: 87 (58%)"
- [ ] Percentage is calculated correctly
- [ ] Stats update when user unfollows someone

### Story 3: Unfollow Non-Mutuals
```
As a user,
I want to unfollow people who don't follow me back,
So I can keep my timeline relevant.
```

**Acceptance Criteria:**
- [ ] Unfollow button next to each user
- [ ] Button works (publishes Kind 3 event)
- [ ] User removed from list immediately (optimistic UI)
- [ ] Stats update after unfollow

### Story 4: Filter Non-Mutuals
```
As a user,
I want to filter to only see non-mutuals,
So I can quickly identify and clean up follows.
```

**Acceptance Criteria:**
- [ ] Toggle filter: "Show only non-mutuals"
- [ ] When active, hides all mutuals
- [ ] Stats remain unchanged (show total, not filtered)

---

## Technical Implementation

### Architecture

```
MainLayout (sidebar)
  └─> MutualSidebarManager
       └─> MutualOrchestrator
            └─> FollowOrchestrator (get my follows)
            └─> NostrTransport (check mutual status)
```

### New Files

**1. MutualOrchestrator.ts**

```typescript
// src/services/orchestration/MutualOrchestrator.ts
import { Orchestrator } from './Orchestrator';
import { NostrTransport } from '../transport/NostrTransport';
import { AuthService } from '../AuthService';
import { RelayConfig } from '../RelayConfig';
import { FollowOrchestrator } from './FollowOrchestrator';

export interface MutualStatus {
  pubkey: string;
  isMutual: boolean;
}

export class MutualOrchestrator extends Orchestrator {
  private static instance: MutualOrchestrator;
  private transport: NostrTransport;
  private authService: AuthService;
  private relayConfig: RelayConfig;
  private followOrch: FollowOrchestrator;

  private constructor() {
    super('MutualOrchestrator');
    this.transport = NostrTransport.getInstance();
    this.authService = AuthService.getInstance();
    this.relayConfig = RelayConfig.getInstance();
    this.followOrch = FollowOrchestrator.getInstance();
  }

  public static getInstance(): MutualOrchestrator {
    if (!MutualOrchestrator.instance) {
      MutualOrchestrator.instance = new MutualOrchestrator();
    }
    return MutualOrchestrator.instance;
  }

  /**
   * Get all followings with their mutual status
   */
  async getAllMutualsStatus(): Promise<MutualStatus[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return [];

    // Get list of users current user follows
    const followings = await this.followOrch.getFollowList();
    if (followings.length === 0) return [];

    const results: MutualStatus[] = [];
    const batchSize = 10; // Process 10 at a time

    console.log(`[MutualOrchestrator] Checking ${followings.length} followings...`);

    // Process in batches
    for (let i = 0; i < followings.length; i += batchSize) {
      const batch = followings.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(f => this.checkIfMutual(f.pubkey, currentUser.pubkey))
      );

      batch.forEach((following, idx) => {
        results.push({
          pubkey: following.pubkey,
          isMutual: batchResults[idx]
        });
      });

      // Rate limiting
      if (i + batchSize < followings.length) {
        await this.delay(500);
      }

      const progress = Math.min(i + batchSize, followings.length);
      console.log(`[MutualOrchestrator] Progress: ${progress}/${followings.length}`);
    }

    return results;
  }

  /**
   * Check if a specific user follows back
   */
  private async checkIfMutual(userPubkey: string, currentUserPubkey: string): Promise<boolean> {
    try {
      const relays = this.relayConfig.getAllRelays().map(r => r.url);

      // Fetch user's follow list (Kind 3)
      const followList = await this.transport.fetch(relays, [{
        kinds: [3],
        authors: [userPubkey],
        limit: 1
      }], 3000);

      if (followList.length === 0) return false;

      // Check if current user is in their follow list
      const followsTags = followList[0].tags.filter(t => t[0] === 'p');
      return followsTags.some(t => t[1] === currentUserPubkey);
    } catch (error) {
      console.warn(`[MutualOrchestrator] Failed to check ${userPubkey}:`, error);
      return false;
    }
  }

  /**
   * Helper: Delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Effort:** 2 hours

---

**2. MutualSidebarManager.ts**

```typescript
// src/components/layout/managers/MutualSidebarManager.ts
import { BaseListSidebarManager } from './BaseListSidebarManager';
import { MutualOrchestrator, MutualStatus } from '../../../services/orchestration/MutualOrchestrator';
import { UserProfileService } from '../../../services/UserProfileService';
import { FollowOrchestrator } from '../../../services/orchestration/FollowOrchestrator';
import { ToastService } from '../../../services/ToastService';

interface MutualItemWithProfile {
  pubkey: string;
  isMutual: boolean;
  username: string;
}

export class MutualSidebarManager {
  private container: HTMLElement;
  private mutualOrch: MutualOrchestrator;
  private followOrch: FollowOrchestrator;
  private userProfileService: UserProfileService;
  private allItems: MutualItemWithProfile[] = [];
  private showOnlyNonMutuals: boolean = false;

  constructor(containerElement: HTMLElement) {
    this.container = containerElement;
    this.mutualOrch = MutualOrchestrator.getInstance();
    this.followOrch = FollowOrchestrator.getInstance();
    this.userProfileService = UserProfileService.getInstance();
  }

  /**
   * Render the mutuals tab
   */
  async render(): Promise<void> {
    this.container.innerHTML = '<div class="loading">Loading mutuals...</div>';

    try {
      // Fetch mutual status for all followings
      const mutualsStatus = await this.mutualOrch.getAllMutualsStatus();

      // Fetch profiles
      const itemsWithProfiles = await Promise.all(
        mutualsStatus.map(async (status) => {
          const profile = await this.userProfileService.getUserProfile(status.pubkey);
          return {
            pubkey: status.pubkey,
            isMutual: status.isMutual,
            username: profile?.name || profile?.username || 'Unknown'
          };
        })
      );

      // Sort alphabetically
      itemsWithProfiles.sort((a, b) => a.username.localeCompare(b.username));

      this.allItems = itemsWithProfiles;
      this.renderList();
    } catch (error) {
      console.error('Failed to render mutuals:', error);
      this.container.innerHTML = '<div class="error">Failed to load mutuals</div>';
    }
  }

  /**
   * Render the list with current filter
   */
  private renderList(): void {
    const filteredItems = this.showOnlyNonMutuals
      ? this.allItems.filter(item => !item.isMutual)
      : this.allItems;

    const mutualCount = this.allItems.filter(item => item.isMutual).length;
    const totalCount = this.allItems.length;
    const percentage = totalCount > 0 ? Math.round((mutualCount / totalCount) * 100) : 0;

    this.container.innerHTML = `
      <div class="mutuals-container">
        <div class="mutuals-header">
          <div class="mutuals-stats">
            Following: ${totalCount} | Mutuals: ${mutualCount} (${percentage}%)
          </div>
          <div class="mutuals-filter">
            <label>
              <input type="checkbox" ${this.showOnlyNonMutuals ? 'checked' : ''} class="filter-toggle">
              Show only non-mutuals
            </label>
          </div>
        </div>
        <div class="mutuals-list">
          ${filteredItems.map(item => this.renderItem(item)).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render a single mutual item
   */
  private renderItem(item: MutualItemWithProfile): string {
    const badgeClass = item.isMutual ? 'mutual-badge--yes' : 'mutual-badge--no';
    const badgeText = item.isMutual ? '✓ Mutual' : 'Not following back';

    return `
      <div class="mutual-item" data-pubkey="${item.pubkey}">
        <div class="mutual-item__info">
          <span class="mutual-item__username">${this.escapeHtml(item.username)}</span>
          <span class="mutual-badge ${badgeClass}">${badgeText}</span>
        </div>
        <button class="mutual-item__unfollow btn btn--small btn--danger">
          Unfollow
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Filter toggle
    const filterToggle = this.container.querySelector('.filter-toggle') as HTMLInputElement;
    if (filterToggle) {
      filterToggle.addEventListener('change', () => {
        this.showOnlyNonMutuals = filterToggle.checked;
        this.renderList();
      });
    }

    // Unfollow buttons
    const unfollowButtons = this.container.querySelectorAll('.mutual-item__unfollow');
    unfollowButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const item = (e.target as HTMLElement).closest('.mutual-item');
        const pubkey = item?.getAttribute('data-pubkey');
        if (pubkey) {
          await this.handleUnfollow(pubkey);
        }
      });
    });
  }

  /**
   * Handle unfollow
   */
  private async handleUnfollow(pubkey: string): Promise<void> {
    try {
      await this.followOrch.unfollowUser(pubkey);

      // Remove from local list
      this.allItems = this.allItems.filter(item => item.pubkey !== pubkey);

      // Re-render
      this.renderList();

      ToastService.show('Unfollowed successfully', 'success');
    } catch (error) {
      console.error('Failed to unfollow:', error);
      ToastService.show('Failed to unfollow', 'error');
    }
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
```

**Effort:** 2 hours

---

**3. SCSS Styling**

```scss
// src/styles/components/_mutuals.scss

.mutuals-container {
  display: flex;
  flex-direction: column;
  gap: $gap;
  padding: $gap;
}

.mutuals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: $gap;
  border-bottom: 1px solid $color-2;
}

.mutuals-stats {
  font-size: 14px;
  font-weight: 600;
  color: $color-5;
}

.mutuals-filter {
  label {
    display: flex;
    align-items: center;
    gap: calc($gap / 2);
    font-size: 13px;
    color: $color-4;
    cursor: pointer;
  }

  input[type="checkbox"] {
    cursor: pointer;
  }
}

.mutuals-list {
  display: flex;
  flex-direction: column;
  gap: calc($gap / 2);
}

.mutual-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: calc($gap / 2);
  border-radius: 4px;
  background: $color-1;
  border: 1px solid $color-2;
  transition: background 0.2s ease;

  &:hover {
    background: $color-2;
  }
}

.mutual-item__info {
  display: flex;
  align-items: center;
  gap: $gap;
}

.mutual-item__username {
  font-size: 14px;
  font-weight: 600;
  color: $color-5;
}

.mutual-badge {
  font-size: 12px;
  padding: calc($gap / 4) calc($gap / 2);
  border-radius: 3px;
  font-weight: 600;

  &--yes {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  &--no {
    background: rgba(156, 163, 175, 0.1);
    color: #9ca3af;
  }
}

.mutual-item__unfollow {
  font-size: 12px;
  padding: calc($gap / 3) calc($gap / 1.5);
}
```

**Effort:** 30 minutes

---

### MainLayout Integration

**Modified:** `src/components/layout/MainLayout.ts`

```typescript
// Add to sidebar rendering
private renderListsSection(): string {
  return `
    <div class="sidebar-section">
      <h3 class="sidebar-section-title">Lists</h3>
      <button class="sidebar-item" data-tab="bookmarks">
        <span class="sidebar-item-icon">📑</span>
        <span class="sidebar-item-label">Bookmarks</span>
      </button>
      <button class="sidebar-item" data-tab="follows">
        <span class="sidebar-item-icon">👥</span>
        <span class="sidebar-item-label">Follows</span>
      </button>
      <button class="sidebar-item" data-tab="mutuals">
        <span class="sidebar-item-icon">🔄</span>
        <span class="sidebar-item-label">Mutuals</span>
      </button>
      <button class="sidebar-item" data-tab="muted">
        <span class="sidebar-item-icon">🔇</span>
        <span class="sidebar-item-label">Muted Users</span>
      </button>
    </div>
  `;
}

// Add to tab switch handler
private handleTabSwitch(tabName: string): void {
  if (tabName === 'mutuals') {
    const mutualManager = new MutualSidebarManager(this.secondaryContent);
    mutualManager.render();
  }
}
```

**Effort:** 30 minutes

---

## Testing

### Manual Testing Checklist

- [ ] Click Lists → Mutuals in sidebar
- [ ] Verify list loads (with loading state)
- [ ] Verify all followings appear
- [ ] Verify mutual badges are correct (spot-check 5-10 users)
- [ ] Verify stats are calculated correctly
- [ ] Toggle "Show only non-mutuals" filter
- [ ] Verify filter works (mutuals disappear)
- [ ] Verify stats remain unchanged when filtered
- [ ] Click unfollow button
- [ ] Verify user is removed from list
- [ ] Verify stats update after unfollow
- [ ] Verify toast message appears

### Edge Cases

- [ ] User follows 0 people → Shows "No followings"
- [ ] All follows are mutuals → Filter shows empty list
- [ ] None are mutuals → Filter shows all
- [ ] Relay timeout → Shows error message gracefully

---

## Performance Considerations

### For 100 Followings
- 100 relay requests (Kind 3 events)
- Batched: 10 requests every 500ms
- Total time: ~5-8 seconds
- **Acceptable for manual, one-time load**

### For 500+ Followings
- May take 30-60 seconds
- Consider progress indicator
- Consider caching (Phase 2+)

---

## Success Criteria

- [ ] Tab renders correctly
- [ ] Mutual status is accurate (manual verification)
- [ ] Stats calculate correctly
- [ ] Filter works
- [ ] Unfollow works
- [ ] No crashes or errors
- [ ] Users engage with tab (analytics)

---

## What's Next

**Phase 2:** Add change detection (snapshot comparison)

**Dependencies for Phase 2:**
- This phase must be complete
- User validation that basic list is useful

---

**Last Updated:** 2025-11-21
**Status:** Ready for Implementation
