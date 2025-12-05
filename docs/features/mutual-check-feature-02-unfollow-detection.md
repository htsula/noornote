# Phase 2: Unfollow Detection (Manual)

**Status:** ✅ IMPLEMENTED (2025-12-02) - Combined with Phase 3+4
**Priority:** HIGH
**Effort:** 2-3 hours
**Dependencies:** Phase 1 complete
**Phase:** 2 of 6

---

> ⚠️ **IMPLEMENTATION NOTE:** Phase 2, 3, and 4 are implemented together.
> Storage uses the dual-layer architecture defined in Phase 4:
> - **File** (`~/.noornote/{npub}/mutual-check-data.json`) = Source of Truth
> - **localStorage** = Runtime cache
> See `mutual-check-feature-04-automation.md` for full storage architecture.

---

## Goal

Detect when someone stops following you back by comparing snapshots over time.

**User Value:** "I want to know who unfollowed me since last time I checked, so I can decide whether to unfollow them back."

---

## Scope

### In Scope
- ✅ Save snapshot of current mutuals to localStorage
- ✅ Manual "Check for Changes" button
- ✅ Compare current vs. previous snapshot
- ✅ Show list of users who unfollowed since last check
- ✅ Highlight recent unfollows in main list
- ✅ Timestamp of last check

### Out of Scope
- ❌ New mutual detection (Phase 3)
- ❌ Automatic background checks (Phase 4)
- ❌ Notifications (Phase 4)
- ❌ Reciprocity analysis (Phase 5)

---

## User Stories

### Story 1: Save Snapshot
```
As a user,
When I first open the Mutuals tab,
The system should save the current state as a baseline,
So future changes can be detected.
```

**Acceptance Criteria:**
- [ ] Snapshot saved automatically on first visit
- [ ] Snapshot contains: timestamp + list of mutual pubkeys
- [ ] Snapshot stored in localStorage
- [ ] No UI indication (silent save)

### Story 2: Manual Change Detection
```
As a user,
I want to click "Check for Changes" to see who unfollowed,
So I can track changes over time.
```

**Acceptance Criteria:**
- [ ] Button displays in header: "Check for Changes"
- [ ] Button shows last check timestamp: "Last checked: 2 days ago"
- [ ] Clicking button compares current vs. previous snapshot
- [ ] Shows modal/section with list of unfollowers
- [ ] Shows count: "2 users stopped following back"

### Story 3: Highlight Recent Unfollows
```
As a user,
I want to see which users recently unfollowed highlighted in the main list,
So I can easily spot them.
```

**Acceptance Criteria:**
- [ ] Users who unfollowed have warning badge: "⚠️ Unfollowed (2d ago)"
- [ ] Badge is orange/red (distinct from regular badges)
- [ ] Badge persists until next check
- [ ] Badge disappears after next snapshot update

### Story 4: Reset Snapshot
```
As a user,
After reviewing unfollowers, I want to save new baseline,
So next check shows only new changes.
```

**Acceptance Criteria:**
- [ ] After viewing changes, button shows: "Mark as Seen"
- [ ] Clicking updates snapshot to current state
- [ ] Clears recent unfollow highlights
- [ ] Updates "Last checked" timestamp

---

## Technical Implementation

### New Service: MutualCheckStorage

```typescript
// src/services/storage/MutualCheckStorage.ts

export interface MutualSnapshot {
  timestamp: number;
  mutualPubkeys: string[];
}

export class MutualCheckStorage {
  private static instance: MutualCheckStorage;
  private readonly SNAPSHOT_KEY = 'noornote_mutual_snapshot';
  private readonly LAST_CHECK_KEY = 'noornote_mutual_last_check';

  public static getInstance(): MutualCheckStorage {
    if (!MutualCheckStorage.instance) {
      MutualCheckStorage.instance = new MutualCheckStorage();
    }
    return MutualCheckStorage.instance;
  }

  /**
   * Get previous snapshot
   */
  getSnapshot(): MutualSnapshot | null {
    const stored = localStorage.getItem(this.SNAPSHOT_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Save new snapshot
   */
  saveSnapshot(mutualPubkeys: string[]): void {
    const snapshot: MutualSnapshot = {
      timestamp: Date.now(),
      mutualPubkeys
    };

    localStorage.setItem(this.SNAPSHOT_KEY, JSON.stringify(snapshot));
    localStorage.setItem(this.LAST_CHECK_KEY, Date.now().toString());
  }

  /**
   * Get timestamp of last check
   */
  getLastCheckTimestamp(): number | null {
    const stored = localStorage.getItem(this.LAST_CHECK_KEY);
    return stored ? parseInt(stored) : null;
  }

  /**
   * Clear storage (for logout)
   */
  clear(): void {
    localStorage.removeItem(this.SNAPSHOT_KEY);
    localStorage.removeItem(this.LAST_CHECK_KEY);
  }
}
```

**Effort:** 30 minutes

---

### Updated MutualSidebarManager

```typescript
// Add to existing MutualSidebarManager.ts

import { MutualCheckStorage, MutualSnapshot } from '../../../services/storage/MutualCheckStorage';

export class MutualSidebarManager {
  private storage: MutualCheckStorage;
  private unfollowedPubkeys: Set<string> = new Set();

  constructor(containerElement: HTMLElement) {
    // ... existing code ...
    this.storage = MutualCheckStorage.getInstance();
  }

  /**
   * Render the mutuals tab
   */
  async render(): Promise<void> {
    this.container.innerHTML = '<div class="loading">Loading mutuals...</div>';

    try {
      const mutualsStatus = await this.mutualOrch.getAllMutualsStatus();

      // Fetch profiles
      const itemsWithProfiles = await Promise.all(/* ... existing code ... */);

      this.allItems = itemsWithProfiles;

      // Check if this is first visit (no snapshot)
      const snapshot = this.storage.getSnapshot();
      if (!snapshot) {
        // First visit: save initial snapshot
        const currentMutuals = this.allItems
          .filter(item => item.isMutual)
          .map(item => item.pubkey);
        this.storage.saveSnapshot(currentMutuals);
        console.log('[MutualSidebarManager] Initial snapshot saved');
      }

      this.renderList();
    } catch (error) {
      console.error('Failed to render mutuals:', error);
      this.container.innerHTML = '<div class="error">Failed to load mutuals</div>';
    }
  }

  /**
   * Render the list with header
   */
  private renderList(): void {
    const filteredItems = this.showOnlyNonMutuals
      ? this.allItems.filter(item => !item.isMutual)
      : this.allItems;

    const mutualCount = this.allItems.filter(item => item.isMutual).length;
    const totalCount = this.allItems.length;
    const percentage = totalCount > 0 ? Math.round((mutualCount / totalCount) * 100) : 0;

    const lastCheck = this.storage.getLastCheckTimestamp();
    const lastCheckText = lastCheck ? this.formatTimeAgo(lastCheck) : 'Never';

    this.container.innerHTML = `
      <div class="mutuals-container">
        <div class="mutuals-header">
          <div class="mutuals-stats">
            Following: ${totalCount} | Mutuals: ${mutualCount} (${percentage}%)
          </div>
          <div class="mutuals-actions">
            <span class="last-check">Last checked: ${lastCheckText}</span>
            <button class="btn btn--small btn--primary check-changes-btn">
              Check for Changes
            </button>
          </div>
        </div>
        <div class="mutuals-filter">
          <label>
            <input type="checkbox" ${this.showOnlyNonMutuals ? 'checked' : ''} class="filter-toggle">
            Show only non-mutuals
          </label>
        </div>
        <div class="mutuals-list">
          ${filteredItems.map(item => this.renderItem(item)).join('')}
        </div>
        <div class="changes-modal" style="display: none;"></div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render item with unfollow highlight
   */
  private renderItem(item: MutualItemWithProfile): string {
    const badgeClass = item.isMutual ? 'mutual-badge--yes' : 'mutual-badge--no';
    let badgeText = item.isMutual ? '✓ Mutual' : 'Not following back';

    // Add unfollow highlight
    const isUnfollowed = this.unfollowedPubkeys.has(item.pubkey);
    if (isUnfollowed && !item.isMutual) {
      badgeText = '⚠️ Unfollowed recently';
    }

    return `
      <div class="mutual-item ${isUnfollowed ? 'mutual-item--unfollowed' : ''}" data-pubkey="${item.pubkey}">
        <div class="mutual-item__info">
          <span class="mutual-item__username">${this.escapeHtml(item.username)}</span>
          <span class="mutual-badge ${badgeClass} ${isUnfollowed ? 'mutual-badge--warning' : ''}">
            ${badgeText}
          </span>
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
    // ... existing filter and unfollow listeners ...

    // Check for changes button
    const checkBtn = this.container.querySelector('.check-changes-btn');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => this.checkForChanges());
    }
  }

  /**
   * Check for changes since last snapshot
   */
  private async checkForChanges(): Promise<void> {
    const snapshot = this.storage.getSnapshot();
    if (!snapshot) {
      ToastService.show('No previous snapshot found', 'info');
      return;
    }

    const currentMutuals = this.allItems
      .filter(item => item.isMutual)
      .map(item => item.pubkey);

    // Find unfollowers (in previous but NOT in current)
    const unfollowers = snapshot.mutualPubkeys.filter(
      pubkey => !currentMutuals.includes(pubkey)
    );

    if (unfollowers.length === 0) {
      ToastService.show('No changes detected', 'success');
      return;
    }

    // Store unfollowers for highlighting
    this.unfollowedPubkeys = new Set(unfollowers);

    // Show modal with unfollowers
    await this.showChangesModal(unfollowers, snapshot.timestamp);

    // Re-render to show highlights
    this.renderList();
  }

  /**
   * Show modal with detected changes
   */
  private async showChangesModal(unfollowerPubkeys: string[], snapshotTime: number): Promise<void> {
    const modal = this.container.querySelector('.changes-modal') as HTMLElement;
    if (!modal) return;

    // Fetch usernames
    const unfollowers = await Promise.all(
      unfollowerPubkeys.map(async (pubkey) => {
        const item = this.allItems.find(i => i.pubkey === pubkey);
        return item ? item.username : 'Unknown';
      })
    );

    const timeSince = this.formatTimeAgo(snapshotTime);

    modal.innerHTML = `
      <div class="changes-modal__backdrop"></div>
      <div class="changes-modal__content">
        <h3>Changes Since ${timeSince}</h3>
        <p class="changes-count">
          ${unfollowers.length} ${unfollowers.length === 1 ? 'user' : 'users'} stopped following back
        </p>
        <ul class="unfollowers-list">
          ${unfollowers.map(name => `<li>${this.escapeHtml(name)}</li>`).join('')}
        </ul>
        <div class="changes-modal__actions">
          <button class="btn btn--primary mark-seen-btn">Mark as Seen</button>
          <button class="btn btn--passive close-modal-btn">Close</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Event listeners
    modal.querySelector('.mark-seen-btn')?.addEventListener('click', () => {
      this.markAsSeen();
      modal.style.display = 'none';
    });

    modal.querySelector('.close-modal-btn')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.querySelector('.changes-modal__backdrop')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  /**
   * Mark changes as seen (update snapshot)
   */
  private markAsSeen(): void {
    const currentMutuals = this.allItems
      .filter(item => item.isMutual)
      .map(item => item.pubkey);

    this.storage.saveSnapshot(currentMutuals);
    this.unfollowedPubkeys.clear();
    this.renderList();

    ToastService.show('Snapshot updated', 'success');
  }

  /**
   * Format time ago
   */
  private formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }
}
```

**Effort:** 1.5 hours

---

### Updated SCSS

```scss
// Add to src/styles/components/_mutuals.scss

.mutuals-actions {
  display: flex;
  align-items: center;
  gap: $gap;
}

.last-check {
  font-size: 12px;
  color: $color-4;
}

.mutual-item--unfollowed {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.mutual-badge--warning {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.changes-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.changes-modal__backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.changes-modal__content {
  position: relative;
  background: $color-1;
  border: 1px solid $color-2;
  border-radius: 8px;
  padding: $gap * 2;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 $gap 0;
    font-size: 18px;
    color: $color-5;
  }
}

.changes-count {
  font-size: 14px;
  color: $color-4;
  margin-bottom: $gap;
}

.unfollowers-list {
  list-style: none;
  padding: 0;
  margin: 0 0 $gap * 1.5 0;
  max-height: 300px;
  overflow-y: auto;

  li {
    padding: calc($gap / 2);
    border-bottom: 1px solid $color-2;
    font-size: 14px;
    color: $color-5;

    &:last-child {
      border-bottom: none;
    }
  }
}

.changes-modal__actions {
  display: flex;
  gap: $gap;
  justify-content: flex-end;
}
```

**Effort:** 30 minutes

---

## Testing

### Manual Testing Checklist

- [ ] First visit: Snapshot saved automatically (check localStorage)
- [ ] Click "Check for Changes" immediately → "No changes"
- [ ] Manually unfollow someone via Nostr client
- [ ] Click "Check for Changes" → Shows unfollower
- [ ] Verify modal displays correctly
- [ ] Verify unfollower count is accurate
- [ ] Verify usernames display correctly
- [ ] Click "Close" → Modal closes, highlights remain
- [ ] Click "Mark as Seen" → Snapshot updates, highlights clear
- [ ] Click "Check for Changes" again → "No changes"
- [ ] Verify "Last checked" timestamp updates

### Edge Cases

- [ ] No snapshot exists → First visit flow works
- [ ] All mutuals → "No changes"
- [ ] Multiple unfollowers → All shown in modal
- [ ] User manually clears localStorage → Creates new snapshot

---

## Success Criteria

- [ ] Snapshot saves correctly
- [ ] Comparison algorithm works (no false positives)
- [ ] Modal displays unfollowers
- [ ] Highlights work
- [ ] "Mark as Seen" resets state
- [ ] No crashes or errors
- [ ] Users find feature useful (validation step)

---

## What's Next

**Phase 3:** Add new mutual detection (positive signal)

**Dependencies for Phase 3:**
- Phase 2 must be complete
- User feedback that unfollow detection is valuable

---

**Last Updated:** 2025-11-21
**Status:** Ready for Implementation
