# Phase 4: Background Scheduler + Notifications

**Status:** Planned
**Priority:** MEDIUM
**Effort:** 4-5 hours
**Dependencies:** Phase 2 + 3 complete
**Phase:** 4 of 6

---

## Goal

Automate the mutual checking process with daily background jobs and integrate with the notification system.

**User Value:** "I want to be automatically notified when my mutual relationships change, without having to remember to check manually."

---

## Scope

### In Scope
- ✅ Background scheduler (runs once per 24 hours)
- ✅ Automatic snapshot comparison
- ✅ Synthetic notifications (locally generated)
- ✅ Dual-indicator system:
  - Notification in NotificationView
  - Green dot in sidebar ("Lists → Mutuals")
- ✅ Integration with existing notification system
- ✅ Lifecycle management (start on login, stop on logout)

### Out of Scope
- ❌ Reciprocity analysis (Phase 5)
- ❌ Strength scoring (Phase 6)
- ❌ Real-time detection (stays 24h interval)

---

## User Stories

### Story 1: Automatic Daily Checks
```
As a user,
The app should automatically check for mutual changes once per day,
So I don't have to remember to check manually.
```

**Acceptance Criteria:**
- [ ] Background job runs automatically
- [ ] Runs once every 24 hours
- [ ] Silent (no UI indication during check)
- [ ] Batched relay requests (performance-friendly)
- [ ] Works even if app was closed for multiple days

### Story 2: Notification Integration
```
As a user,
When changes are detected, I want to see a notification,
So I'm informed just like with Zaps or Replies.
```

**Acceptance Criteria:**
- [ ] Notification appears in NotificationView
- [ ] Mixed with regular Nostr notifications
- [ ] Shows summary: "2 users stopped following back"
- [ ] Shows summary: "alice started following you back!"
- [ ] Marked as unread, increments notification badge
- [ ] Marked as read when NotificationView opened

### Story 3: Sidebar Green Dot
```
As a user,
I want a persistent indicator in the sidebar when changes occur,
So I don't miss changes even if I dismiss the notification.
```

**Acceptance Criteria:**
- [ ] Green dot appears next to "Lists → Mutuals"
- [ ] Persists even after notification is read
- [ ] Disappears only when user opens Mutuals tab
- [ ] Pulsing animation (visually distinct)
- [ ] State persists across app restarts

### Story 4: "View Details" Action
```
As a user,
I want to click the notification to see full details,
So I can quickly review all changes.
```

**Acceptance Criteria:**
- [ ] "View Details" button in notification
- [ ] Clicking navigates to Mutuals tab
- [ ] Automatically shows changes (as if "Check for Changes" clicked)
- [ ] Green dot clears after viewing

---

## Technical Implementation

### New Services

**1. SyntheticNotificationService**

```typescript
// src/services/SyntheticNotificationService.ts

export interface SyntheticNotification {
  id: string;
  type: 'mutual_unfollow' | 'mutual_new';
  timestamp: number;
  seen: boolean;
  data: {
    pubkeys: string[];
    count: number;
  };
}

export class SyntheticNotificationService {
  private static instance: SyntheticNotificationService;
  private readonly STORAGE_KEY = 'noornote_synthetic_notifications';
  private eventBus: EventBus;

  public static getInstance(): SyntheticNotificationService {
    if (!SyntheticNotificationService.instance) {
      SyntheticNotificationService.instance = new SyntheticNotificationService();
    }
    return SyntheticNotificationService.instance;
  }

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Create new mutual notification
   */
  createNewMutualNotification(pubkeys: string[]): void {
    const notification: SyntheticNotification = {
      id: `mutual-new-${Date.now()}`,
      type: 'mutual_new',
      timestamp: Math.floor(Date.now() / 1000),
      seen: false,
      data: { pubkeys, count: pubkeys.length }
    };

    this.saveNotification(notification);
    this.eventBus.emit('notification:new', notification);
  }

  /**
   * Create unfollow notification
   */
  createUnfollowNotification(pubkeys: string[]): void {
    const notification: SyntheticNotification = {
      id: `mutual-unfollow-${Date.now()}`,
      type: 'mutual_unfollow',
      timestamp: Math.floor(Date.now() / 1000),
      seen: false,
      data: { pubkeys, count: pubkeys.length }
    };

    this.saveNotification(notification);
    this.eventBus.emit('notification:new', notification);
  }

  private saveNotification(notif: SyntheticNotification): void {
    const existing = this.getAll();
    existing.unshift(notif);
    const trimmed = existing.slice(0, 100);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
  }

  getAll(): SyntheticNotification[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  markAsSeen(id: string): void {
    const all = this.getAll();
    const notif = all.find(n => n.id === id);
    if (notif) {
      notif.seen = true;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
      this.eventBus.emit('notifications:updated');
    }
  }

  getUnreadCount(): number {
    return this.getAll().filter(n => !n.seen).length;
  }
}
```

**Effort:** 1 hour

---

**2. MutualCheckScheduler**

```typescript
// src/services/MutualCheckScheduler.ts

import { MutualOrchestrator } from './orchestration/MutualOrchestrator';
import { MutualCheckStorage } from './storage/MutualCheckStorage';
import { SyntheticNotificationService } from './SyntheticNotificationService';
import { AuthService } from './AuthService';

export class MutualCheckScheduler {
  private static instance: MutualCheckScheduler;
  private checkInterval: NodeJS.Timeout | null = null;
  private mutualOrch: MutualOrchestrator;
  private storage: MutualCheckStorage;
  private syntheticNotifService: SyntheticNotificationService;
  private authService: AuthService;
  private isRunning: boolean = false;

  private constructor() {
    this.mutualOrch = MutualOrchestrator.getInstance();
    this.storage = MutualCheckStorage.getInstance();
    this.syntheticNotifService = SyntheticNotificationService.getInstance();
    this.authService = AuthService.getInstance();
  }

  public static getInstance(): MutualCheckScheduler {
    if (!MutualCheckScheduler.instance) {
      MutualCheckScheduler.instance = new MutualCheckScheduler();
    }
    return MutualCheckScheduler.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    if (!this.authService.getCurrentUser()) return;

    this.isRunning = true;
    console.log('[MutualCheckScheduler] Starting...');

    // Check immediately if due
    await this.checkIfDue();

    // Then check every hour
    this.checkInterval = setInterval(async () => {
      await this.checkIfDue();
    }, 60 * 60 * 1000);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[MutualCheckScheduler] Stopped');
  }

  private async checkIfDue(): Promise<void> {
    if (!this.authService.getCurrentUser()) {
      this.stop();
      return;
    }

    const lastCheck = this.storage.getLastCheckTimestamp();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (!lastCheck || (now - lastCheck) > twentyFourHours) {
      console.log('[MutualCheckScheduler] 24h passed, starting check...');
      await this.performCheck();
    } else {
      const nextCheck = new Date(lastCheck + twentyFourHours);
      console.log(`[MutualCheckScheduler] Next check: ${nextCheck.toLocaleString()}`);
    }
  }

  private async performCheck(): Promise<void> {
    console.log('[MutualCheckScheduler] Starting background check...');
    const startTime = Date.now();

    try {
      // Get current mutuals
      const mutualsStatus = await this.mutualOrch.getAllMutualsStatus();
      const currentMutuals = mutualsStatus
        .filter(m => m.isMutual)
        .map(m => m.pubkey);

      // Get previous snapshot
      const snapshot = this.storage.getSnapshot();
      const previousMutuals = snapshot ? snapshot.mutualPubkeys : [];

      // Find changes
      const newMutuals = currentMutuals.filter(
        pubkey => !previousMutuals.includes(pubkey)
      );

      const unfollowers = previousMutuals.filter(
        pubkey => !currentMutuals.includes(pubkey)
      );

      console.log(`[MutualCheckScheduler] Changes: +${newMutuals.length} new, -${unfollowers.length} lost`);

      // Create notifications
      let hasChanges = false;

      if (newMutuals.length > 0) {
        this.syntheticNotifService.createNewMutualNotification(newMutuals);
        hasChanges = true;
      }

      if (unfollowers.length > 0) {
        this.syntheticNotifService.createUnfollowNotification(unfollowers);
        hasChanges = true;
      }

      // Mark as having unseen changes (green dot)
      if (hasChanges) {
        this.storage.markHasChanges();
      }

      // Save new snapshot
      this.storage.saveSnapshot(currentMutuals);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[MutualCheckScheduler] Check completed in ${duration}s`);
    } catch (error) {
      console.error('[MutualCheckScheduler] Check failed:', error);
    }
  }

  async forceCheck(): Promise<void> {
    await this.performCheck();
  }
}
```

**Effort:** 1.5 hours

---

### Updated MutualCheckStorage

```typescript
// Add to existing MutualCheckStorage.ts

export class MutualCheckStorage {
  private readonly UNSEEN_CHANGES_KEY = 'noornote_mutual_unseen_changes';

  hasUnseenChanges(): boolean {
    return localStorage.getItem(this.UNSEEN_CHANGES_KEY) === 'true';
  }

  markHasChanges(): void {
    localStorage.setItem(this.UNSEEN_CHANGES_KEY, 'true');
  }

  markChangesAsSeen(): void {
    localStorage.removeItem(this.UNSEEN_CHANGES_KEY);
  }

  clear(): void {
    localStorage.removeItem(this.LAST_CHECK_KEY);
    localStorage.removeItem(this.SNAPSHOT_KEY);
    localStorage.removeItem(this.UNSEEN_CHANGES_KEY);
  }
}
```

**Effort:** 15 minutes

---

### App.ts Integration

```typescript
// src/App.ts

import { MutualCheckScheduler } from './services/MutualCheckScheduler';
import { MutualCheckStorage } from './services/storage/MutualCheckStorage';

export class App {
  private mutualCheckScheduler: MutualCheckScheduler | null = null;

  async initialize(): Promise<void> {
    // ... existing initialization ...

    // Start mutual check scheduler (only if logged in)
    if (this.authService.getCurrentUser()) {
      this.mutualCheckScheduler = MutualCheckScheduler.getInstance();
      await this.mutualCheckScheduler.start();
    }

    // Listen for login/logout events
    this.eventBus.on('user:login', async () => {
      if (!this.mutualCheckScheduler) {
        this.mutualCheckScheduler = MutualCheckScheduler.getInstance();
      }
      await this.mutualCheckScheduler.start();
    });

    this.eventBus.on('user:logout', () => {
      this.mutualCheckScheduler?.stop();
      MutualCheckStorage.getInstance().clear();
    });
  }
}
```

**Effort:** 15 minutes

---

### MainLayout Sidebar Integration

```typescript
// src/components/layout/MainLayout.ts

import { MutualCheckStorage } from '../../services/storage/MutualCheckStorage';

export class MainLayout {
  private mutualCheckStorage: MutualCheckStorage;

  constructor() {
    // ... existing code ...
    this.mutualCheckStorage = MutualCheckStorage.getInstance();

    // Listen for mutual changes
    this.eventBus.on('notification:new', () => {
      this.updateMutualsIndicator();
    });
  }

  private renderListsSection(): string {
    const hasUnseenChanges = this.mutualCheckStorage.hasUnseenChanges();

    return `
      <div class="sidebar-section">
        <h3 class="sidebar-section-title">Lists</h3>
        <button class="sidebar-item" data-tab="mutuals">
          <span class="sidebar-item-icon">🔄</span>
          <span class="sidebar-item-label">Mutuals</span>
          ${hasUnseenChanges ? '<span class="status-indicator status-indicator--green"></span>' : ''}
        </button>
        <!-- ... other items ... -->
      </div>
    `;
  }

  private handleTabSwitch(tabName: string): void {
    if (tabName === 'mutuals') {
      this.mutualCheckStorage.markChangesAsSeen();
      this.updateMutualsIndicator();
      // ... existing mutual tab rendering ...
    }
  }

  private updateMutualsIndicator(): void {
    const mutualsTab = this.container.querySelector('[data-tab="mutuals"]');
    if (!mutualsTab) return;

    const hasUnseenChanges = this.mutualCheckStorage.hasUnseenChanges();
    const existingIndicator = mutualsTab.querySelector('.status-indicator');

    if (hasUnseenChanges && !existingIndicator) {
      const indicator = document.createElement('span');
      indicator.className = 'status-indicator status-indicator--green';
      mutualsTab.appendChild(indicator);
    } else if (!hasUnseenChanges && existingIndicator) {
      existingIndicator.remove();
    }
  }
}
```

**Effort:** 30 minutes

---

### NotificationView Rendering

**Note:** This is a simplified version. Full integration requires updating NotificationsOrchestrator and NotificationGroup types.

```typescript
// Add to NotificationsView.ts

private renderMutualNotification(group: NotificationGroup): string {
  const { type, metadata } = group;
  const { pubkeys, count } = metadata;

  // Fetch usernames (simplified - actual implementation needs async)
  const usernames = this.getUsernamesFromPubkeys(pubkeys.slice(0, 2));

  let message: string;
  let iconClass: string;

  if (type === 'mutual_new') {
    iconClass = 'notification-icon--success';
    if (count === 1) {
      message = `${usernames[0]} started following you back!`;
    } else {
      message = `${usernames[0]} and ${count - 1} others started following you back!`;
    }
  } else {
    iconClass = 'notification-icon--warning';
    if (count === 1) {
      message = `${usernames[0]} stopped following back`;
    } else {
      message = `${usernames[0]} and ${count - 1} others stopped following back`;
    }
  }

  return `
    <div class="notification-item notification-item--mutual">
      <div class="notification-icon ${iconClass}">...</div>
      <div class="notification-content">
        <p>${message}</p>
      </div>
      <button class="btn btn--small" data-action="view-mutuals">
        View Details
      </button>
    </div>
  `;
}
```

**Effort:** 1 hour (full integration with NotificationsOrchestrator)

---

### SCSS Additions

```scss
// src/styles/components/_sidebar.scss

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-left: calc($gap / 2);

  &--green {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
    animation: pulse-green 2s ease-in-out infinite;
  }
}

@keyframes pulse-green {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: calc($gap / 2);
  position: relative;

  .status-indicator {
    position: absolute;
    right: calc($gap / 2);
  }
}
```

**Effort:** 15 minutes

---

## Testing

### Manual Testing Checklist

- [ ] App starts → Scheduler initializes
- [ ] Verify initial check runs if >24h since last
- [ ] Verify check skips if <24h since last
- [ ] Force check via dev tools: `MutualCheckScheduler.getInstance().forceCheck()`
- [ ] Verify notifications created
- [ ] Verify notification badge increments
- [ ] Verify green dot appears in sidebar
- [ ] Open NotificationView → Notifications visible
- [ ] Verify "View Details" button works
- [ ] Open Mutuals tab → Green dot disappears
- [ ] Logout → Verify scheduler stops
- [ ] Login → Verify scheduler restarts

### Edge Cases

- [ ] App closed for 3 days → Runs check on next open
- [ ] No changes → No notifications, no green dot
- [ ] Only new mutuals → Only positive notification
- [ ] Only unfollows → Only negative notification
- [ ] Both changes → Both notifications

---

## Performance Considerations

**Background Check:**
- Runs once per 24 hours
- Batched relay requests (same as manual check)
- Silent, non-blocking
- Progress logged to console

**For 100 followings:** ~5-8 seconds
**For 500 followings:** ~30-60 seconds

**Acceptable:** User sees nothing, happens in background

---

## Success Criteria

- [ ] Scheduler runs automatically
- [ ] Notifications integrate seamlessly
- [ ] Green dot works correctly
- [ ] No performance impact
- [ ] No false positives
- [ ] Users engage with notifications
- [ ] Retention improvement measured

---

## What's Next

**Phase 5:** Add reciprocity check (zap asymmetry detection) 🔥

**Dependencies for Phase 5:**
- Phase 4 must be complete
- User engagement with automation validated
- Proof that users value the feature

---

**Last Updated:** 2025-11-21
**Status:** Ready for Implementation
