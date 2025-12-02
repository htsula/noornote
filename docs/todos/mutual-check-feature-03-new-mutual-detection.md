# Phase 3: New Mutual Detection (Manual)

**Status:** ✅ IMPLEMENTED (2025-12-02) - Combined with Phase 2+4
**Priority:** MEDIUM
**Effort:** 1-2 hours
**Dependencies:** Phase 2 complete
**Phase:** 3 of 6

---

> ⚠️ **IMPLEMENTATION NOTE:** Phase 2, 3, and 4 are implemented together.
> Storage uses the dual-layer architecture defined in Phase 4:
> - **File** (`~/.noornote/{npub}/mutual-check-data.json`) = Source of Truth
> - **localStorage** = Runtime cache
> See `mutual-check-feature-04-automation.md` for full storage architecture.

---

## Goal

Detect when someone starts following you back (positive signal) to balance the unfollow detection.

**User Value:** "I want to celebrate when someone follows me back, not just see the negative (unfollows)."

---

## Scope

### In Scope
- ✅ Detect new mutuals in snapshot comparison
- ✅ Show new mutuals in changes modal (alongside unfollowers)
- ✅ Highlight new mutuals in main list
- ✅ Positive messaging: "alice started following you back!"
- ✅ Separate visual treatment (green vs. red)

### Out of Scope
- ❌ Automatic background checks (Phase 4)
- ❌ Notifications (Phase 4)
- ❌ Reciprocity analysis (Phase 5)

---

## User Stories

### Story 1: Detect New Mutuals
```
As a user,
When I click "Check for Changes",
I want to see both unfollows AND new mutuals,
So I get a balanced view of my network changes.
```

**Acceptance Criteria:**
- [ ] Snapshot comparison detects new mutuals
- [ ] New mutuals = users in current mutuals but NOT in previous
- [ ] Changes modal shows both sections:
  - "2 users stopped following back" (red/orange)
  - "1 new mutual" (green)
- [ ] Each section can be empty independently

### Story 2: Highlight New Mutuals
```
As a user,
I want new mutuals highlighted in the main list,
So I can easily spot them.
```

**Acceptance Criteria:**
- [ ] New mutuals have badge: "✅ New mutual (1d ago)"
- [ ] Badge is green (distinct from unfollow orange)
- [ ] Badge persists until next "Mark as Seen"
- [ ] Badge disappears after snapshot update

### Story 3: Positive Messaging
```
As a user,
I want positive, encouraging messages for new mutuals,
So the feature doesn't feel purely negative.
```

**Acceptance Criteria:**
- [ ] Modal header: "Changes Since 2d ago" (neutral)
- [ ] Unfollows section: Red/orange with warning icon
- [ ] New mutuals section: Green with checkmark icon
- [ ] If only new mutuals: Celebratory tone
- [ ] If both: Balanced presentation

---

## Technical Implementation

### Updated MutualSidebarManager

```typescript
// Extend existing MutualSidebarManager.ts

export class MutualSidebarManager {
  private unfollowedPubkeys: Set<string> = new Set();
  private newMutualPubkeys: Set<string> = new Set(); // NEW

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

    // Find new mutuals (in current but NOT in previous) - NEW
    const newMutuals = currentMutuals.filter(
      pubkey => !snapshot.mutualPubkeys.includes(pubkey)
    );

    if (unfollowers.length === 0 && newMutuals.length === 0) {
      ToastService.show('No changes detected', 'success');
      return;
    }

    // Store for highlighting
    this.unfollowedPubkeys = new Set(unfollowers);
    this.newMutualPubkeys = new Set(newMutuals);

    // Show modal with changes
    await this.showChangesModal(unfollowers, newMutuals, snapshot.timestamp);

    // Re-render to show highlights
    this.renderList();
  }

  /**
   * Render item with both unfollow and new mutual highlights
   */
  private renderItem(item: MutualItemWithProfile): string {
    let badgeClass = item.isMutual ? 'mutual-badge--yes' : 'mutual-badge--no';
    let badgeText = item.isMutual ? '✓ Mutual' : 'Not following back';

    // Check for highlights
    const isUnfollowed = this.unfollowedPubkeys.has(item.pubkey);
    const isNewMutual = this.newMutualPubkeys.has(item.pubkey);

    let itemClass = 'mutual-item';
    if (isUnfollowed) {
      badgeText = '⚠️ Unfollowed recently';
      badgeClass += ' mutual-badge--warning';
      itemClass += ' mutual-item--unfollowed';
    } else if (isNewMutual) {
      badgeText = '✅ New mutual';
      badgeClass += ' mutual-badge--new';
      itemClass += ' mutual-item--new-mutual';
    }

    return `
      <div class="${itemClass}" data-pubkey="${item.pubkey}">
        <div class="mutual-item__info">
          <span class="mutual-item__username">${this.escapeHtml(item.username)}</span>
          <span class="mutual-badge ${badgeClass}">
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
   * Show modal with detected changes (updated)
   */
  private async showChangesModal(
    unfollowerPubkeys: string[],
    newMutualPubkeys: string[],
    snapshotTime: number
  ): Promise<void> {
    const modal = this.container.querySelector('.changes-modal') as HTMLElement;
    if (!modal) return;

    // Fetch usernames for both groups
    const unfollowers = await Promise.all(
      unfollowerPubkeys.map(async (pubkey) => {
        const item = this.allItems.find(i => i.pubkey === pubkey);
        return item ? item.username : 'Unknown';
      })
    );

    const newMutuals = await Promise.all(
      newMutualPubkeys.map(async (pubkey) => {
        const item = this.allItems.find(i => i.pubkey === pubkey);
        return item ? item.username : 'Unknown';
      })
    );

    const timeSince = this.formatTimeAgo(snapshotTime);
    const totalChanges = unfollowers.length + newMutuals.length;

    modal.innerHTML = `
      <div class="changes-modal__backdrop"></div>
      <div class="changes-modal__content">
        <h3>Changes Since ${timeSince}</h3>
        <p class="changes-summary">
          ${totalChanges} ${totalChanges === 1 ? 'change' : 'changes'} detected
        </p>

        ${newMutuals.length > 0 ? `
          <div class="changes-section changes-section--positive">
            <h4 class="changes-section__title">
              ✅ New Mutuals (${newMutuals.length})
            </h4>
            <ul class="changes-list">
              ${newMutuals.map(name => `
                <li class="changes-list__item changes-list__item--positive">
                  ${this.escapeHtml(name)} started following you back!
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${unfollowers.length > 0 ? `
          <div class="changes-section changes-section--negative">
            <h4 class="changes-section__title">
              ⚠️ Unfollows (${unfollowers.length})
            </h4>
            <ul class="changes-list">
              ${unfollowers.map(name => `
                <li class="changes-list__item changes-list__item--negative">
                  ${this.escapeHtml(name)} stopped following back
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="changes-modal__actions">
          <button class="btn btn--primary mark-seen-btn">Mark as Seen</button>
          <button class="btn btn--passive close-modal-btn">Close</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Event listeners (same as Phase 2)
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
   * Mark changes as seen (updated)
   */
  private markAsSeen(): void {
    const currentMutuals = this.allItems
      .filter(item => item.isMutual)
      .map(item => item.pubkey);

    this.storage.saveSnapshot(currentMutuals);

    // Clear both highlight sets
    this.unfollowedPubkeys.clear();
    this.newMutualPubkeys.clear();

    this.renderList();

    ToastService.show('Snapshot updated', 'success');
  }
}
```

**Effort:** 1 hour

---

### Updated SCSS

```scss
// Add to src/styles/components/_mutuals.scss

// New mutual highlight
.mutual-item--new-mutual {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.05);
}

.mutual-badge--new {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  font-weight: 600;
}

// Changes modal sections
.changes-summary {
  font-size: 14px;
  color: $color-4;
  margin-bottom: $gap * 1.5;
  padding-bottom: $gap;
  border-bottom: 1px solid $color-2;
}

.changes-section {
  margin-bottom: $gap * 1.5;

  &:last-of-type {
    margin-bottom: $gap;
  }
}

.changes-section__title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 calc($gap / 2) 0;
}

.changes-section--positive {
  .changes-section__title {
    color: #10b981;
  }
}

.changes-section--negative {
  .changes-section__title {
    color: #ef4444;
  }
}

.changes-list {
  list-style: none;
  padding: 0;
  margin: 0;

  &__item {
    padding: calc($gap / 2);
    border-radius: 4px;
    margin-bottom: calc($gap / 3);
    font-size: 13px;

    &--positive {
      background: rgba(16, 185, 129, 0.05);
      color: #059669;
      border-left: 3px solid #10b981;
    }

    &--negative {
      background: rgba(239, 68, 68, 0.05);
      color: #dc2626;
      border-left: 3px solid #ef4444;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
}
```

**Effort:** 30 minutes

---

## Testing

### Manual Testing Checklist

- [ ] Start with Phase 2 working correctly
- [ ] Have someone follow you back via Nostr client
- [ ] Click "Check for Changes"
- [ ] Verify modal shows both sections:
  - New mutuals (green)
  - Unfollows (red/orange)
- [ ] Verify counts are correct
- [ ] Verify usernames display correctly
- [ ] Verify new mutual highlights appear in list
- [ ] Verify highlights use correct colors (green vs. red)
- [ ] Click "Mark as Seen"
- [ ] Verify both highlight types clear
- [ ] Click "Check for Changes" again → "No changes"

### Scenarios

**Scenario 1: Only new mutuals**
- 2 people follow back
- 0 unfollows
- Result: Modal shows only green section

**Scenario 2: Only unfollows**
- 0 new mutuals
- 2 unfollows
- Result: Modal shows only red section (Phase 2 behavior)

**Scenario 3: Both changes**
- 1 new mutual
- 2 unfollows
- Result: Modal shows both sections, green first (positive before negative)

**Scenario 4: No changes**
- Result: Toast message "No changes detected"

---

## Success Criteria

- [ ] New mutual detection works correctly
- [ ] Modal shows both change types
- [ ] Highlights use correct colors
- [ ] Positive tone achieved (not purely negative)
- [ ] No false positives
- [ ] Users appreciate balanced view

---

## Why This Matters

**Without Phase 3:**
- Feature feels purely negative
- Users focus only on losses
- Psychological impact: discouraging

**With Phase 3:**
- Balanced emotional impact
- Celebrates new connections
- Users see both growth and attrition
- More likely to engage regularly

---

## What's Next

**Phase 4:** Automate checks with background scheduler + notifications

**Dependencies for Phase 4:**
- Phase 3 must be complete
- User validation that manual detection is valuable
- Proof that users check regularly (indicates automation would be useful)

---

**Last Updated:** 2025-11-21
**Status:** Ready for Implementation
