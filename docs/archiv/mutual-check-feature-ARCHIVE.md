# Mutual Check Feature - Daily Background Monitoring with Synthetic Notifications

**Status:** Planned
**Priority:** MEDIUM
**Total Effort:** 10-15 hours
**Created:** 2025-11-21
**Updated:** 2025-11-21

---

## Feature Overview

**Goal:** Automatically monitor mutual follow relationships and notify users of both new mutuals and lost mutuals.

**User Experience:**
1. App runs silent background check once per 24 hours
2. Compares today's mutual list with yesterday's snapshot
3. Detects **TWO types of changes**:
   - ✅ **New Mutuals:** Someone I follow started following me back → "XYZ is now a new mutual!"
   - ⚠️ **Lost Mutuals:** Someone stopped following me back → "XYZ stopped following back"
4. Each change triggers **dual notification system**:
   - **Notification** in NotificationView (like Zaps, Replies)
   - **Green indicator dot** next to "Lists → Mutuals" in sidebar
5. User can act via two paths:
   - Click notification → See details
   - Click "Mutuals" (with green dot) → See full list
6. Green dot persists until user opens Mutuals tab
7. Notification disappears when NotificationView is opened (standard behavior)
8. Dedicated Mutuals tab shows full list with mutual badges

**Key Innovations:**
- **Synthetic notifications:** Locally generated, not from Nostr events, integrated seamlessly
- **Dual-indicator system:** Notification (temporary) + Sidebar dot (persistent)
- **Bidirectional tracking:** Both gains and losses detected

---

## User Stories

### Story 1: Background Detection
```
As a user,
I want the app to automatically check mutual follow status daily,
So I don't have to manually monitor who unfollowed me.
```

**Acceptance Criteria:**
- ✅ Check runs once every 24 hours
- ✅ Check happens in background (user sees nothing during check)
- ✅ Check is rate-limited to avoid relay spam
- ✅ Works even if app wasn't open for multiple days

### Story 2: Unfollow Notification
```
As a user,
When someone I follow stops following me back,
I want to see a notification in my NotificationView,
So I'm informed like with Zaps or Replies.
```

**Acceptance Criteria:**
- ✅ Notification appears in NotificationView (mixed with Nostr notifications)
- ✅ Shows usernames (up to 2) and count of unfollowers
- ✅ Marked as unread, increments notification badge
- ✅ "View Details" button links to Mutuals tab
- ✅ Marked as read when NotificationView is opened

### Story 3: Mutual List View
```
As a user,
I want to see a list of all people I follow with their mutual status,
So I can decide who to unfollow.
```

**Acceptance Criteria:**
- ✅ Shows all followings with green "✓ Mutual" or gray "Not following back" badge
- ✅ Filter: "Show only non-mutuals"
- ✅ Unfollow button for each user
- ✅ Stats: "Following: 150 | Mutuals: 87 (58%)"
- ✅ Recent unfollows section at top
- ✅ Accessible via sidebar: Lists → Mutuals

### Story 4: Persistent Visual Indicator
```
As a user,
When mutual status changes occur,
I want to see a persistent indicator in the sidebar,
So I don't miss changes even if I dismiss the notification.
```

**Acceptance Criteria:**
- ✅ Green dot appears next to "Lists → Mutuals" when changes detected
- ✅ Dot persists even after notification is read
- ✅ Dot disappears only when user opens Mutuals tab
- ✅ Dot is visually distinct (pulsing animation, green color)
- ✅ Dot state persists across app restarts

### Story 5: New Mutual Notification (NEW!)
```
As a user,
When someone I follow starts following me back,
I want to see a positive notification celebrating this new connection,
So I feel encouraged and can engage with them.
```

**Acceptance Criteria:**
- ✅ Notification appears in NotificationView (mixed with Nostr notifications)
- ✅ Shows usernames (up to 2) and count of new mutuals
- ✅ Positive messaging: "XYZ is now a new mutual!"
- ✅ Marked as unread, increments notification badge
- ✅ "View Details" button links to Mutuals tab
- ✅ Marked as read when NotificationView is opened
- ✅ Visually distinct from unfollow notifications (positive styling)

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        App.ts                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     MutualCheckScheduler.start()                    │   │
│  │  - Runs on app startup (if logged in)               │   │
│  │  - Checks every hour if 24h passed                  │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           MutualCheckScheduler (Background Job)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Load previous mutuals snapshot (localStorage)   │   │
│  │  2. Fetch current mutual list (via MutualOrch.)     │   │
│  │  3. Compare:                                        │   │
│  │     - New mutuals: in current, NOT in previous      │   │
│  │     - Lost mutuals: in previous, NOT in current     │   │
│  │  4. Create synthetic notifications if changes       │   │
│  │  5. Save new snapshot for tomorrow                  │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│        SyntheticNotificationService.createNotification()    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Create synthetic notification object            │   │
│  │  2. Save to localStorage                            │   │
│  │  3. Emit 'notification:new' event                   │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│      NotificationsOrchestrator.fetchNotifications()         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Fetch Nostr events (Zaps, Replies, Reactions)  │   │
│  │  2. Fetch synthetic notifications (Mutual changes)  │   │
│  │  3. Merge and sort by timestamp                     │   │
│  │  4. Return unified notification list                │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           NotificationsView.render()                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Render notifications (mixed):                      │   │
│  │  - "alice zapped you 1000 sats"                     │   │
│  │  - "bob is now a new mutual!" ←─────────────────────┼───┐
│  │  - "charlie stopped following back" ←───────────────┼───┼──┐
│  │  - "dave replied to your note"                      │   │  │
│  └─────────────────────────────────────────────────────┘   │  │
└─────────────────────────────────────────────────────────────┘  │
                                                              │  │
                              Synthetic Notification (New) ───┘  │
                              Synthetic Notification (Lost) ─────┘
```

---

## Implementation Plan

### Phase 1: Core Services (4-6 hours)

#### 1.1 SyntheticNotificationService

**File:** `src/services/SyntheticNotificationService.ts` (NEW)

**Purpose:** Manage locally-generated notifications (not from Nostr events)

```typescript
export interface SyntheticNotification {
  id: string;
  type: 'mutual_unfollow' | 'mutual_new'; // Two types!
  timestamp: number;
  seen: boolean;
  data: {
    pubkeys: string[]; // Unified field for both types
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
   * Create a new mutual unfollow notification
   */
  createUnfollowNotification(unfollowerPubkeys: string[]): void {
    const notification: SyntheticNotification = {
      id: `mutual-unfollow-${Date.now()}`,
      type: 'mutual_unfollow',
      timestamp: Math.floor(Date.now() / 1000),
      seen: false,
      data: {
        pubkeys: unfollowerPubkeys,
        count: unfollowerPubkeys.length
      }
    };

    this.saveNotification(notification);
    this.eventBus.emit('notification:new', notification);
  }

  /**
   * Create a new mutual follow notification (NEW!)
   */
  createNewMutualNotification(newMutualPubkeys: string[]): void {
    const notification: SyntheticNotification = {
      id: `mutual-new-${Date.now()}`,
      type: 'mutual_new',
      timestamp: Math.floor(Date.now() / 1000),
      seen: false,
      data: {
        pubkeys: newMutualPubkeys,
        count: newMutualPubkeys.length
      }
    };

    this.saveNotification(notification);
    this.eventBus.emit('notification:new', notification);
  }

  /**
   * Save notification to localStorage
   */
  private saveNotification(notif: SyntheticNotification): void {
    const existing = this.getAll();
    existing.unshift(notif); // Add to top

    // Keep only last 100 synthetic notifications
    const trimmed = existing.slice(0, 100);

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
  }

  /**
   * Get all synthetic notifications
   */
  getAll(): SyntheticNotification[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Mark notification as seen
   */
  markAsSeen(id: string): void {
    const all = this.getAll();
    const notif = all.find(n => n.id === id);
    if (notif) {
      notif.seen = true;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
      this.eventBus.emit('notifications:updated');
    }
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.getAll().filter(n => !n.seen).length;
  }

  /**
   * Clear old notifications (older than 30 days)
   */
  cleanup(): void {
    const all = this.getAll();
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const recent = all.filter(n => n.timestamp > thirtyDaysAgo);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recent));
  }
}
```

**Estimated Effort:** 1-2 hours

---

#### 1.2 MutualCheckStorage

**File:** `src/services/storage/MutualCheckStorage.ts` (NEW)

**Purpose:** Persist mutual check state across app sessions

```typescript
export interface MutualSnapshot {
  timestamp: number;
  mutualPubkeys: string[];
}

export class MutualCheckStorage {
  private static instance: MutualCheckStorage;
  private readonly LAST_CHECK_KEY = 'noornote_mutual_last_check';
  private readonly SNAPSHOT_KEY = 'noornote_mutual_snapshot';
  private readonly UNSEEN_CHANGES_KEY = 'noornote_mutual_unseen_changes';

  public static getInstance(): MutualCheckStorage {
    if (!MutualCheckStorage.instance) {
      MutualCheckStorage.instance = new MutualCheckStorage();
    }
    return MutualCheckStorage.instance;
  }

  /**
   * Get timestamp of last check
   */
  getLastCheckTimestamp(): number | null {
    const stored = localStorage.getItem(this.LAST_CHECK_KEY);
    return stored ? parseInt(stored) : null;
  }

  /**
   * Get previous mutual snapshot
   */
  getPreviousMutuals(): string[] {
    const stored = localStorage.getItem(this.SNAPSHOT_KEY);
    if (!stored) return [];

    const snapshot: MutualSnapshot = JSON.parse(stored);
    return snapshot.mutualPubkeys;
  }

  /**
   * Save new mutual snapshot
   */
  saveMutualSnapshot(mutualPubkeys: string[]): void {
    const snapshot: MutualSnapshot = {
      timestamp: Date.now(),
      mutualPubkeys
    };

    localStorage.setItem(this.SNAPSHOT_KEY, JSON.stringify(snapshot));
    localStorage.setItem(this.LAST_CHECK_KEY, Date.now().toString());
  }

  /**
   * Check if there are unseen changes (for green dot indicator)
   */
  hasUnseenChanges(): boolean {
    return localStorage.getItem(this.UNSEEN_CHANGES_KEY) === 'true';
  }

  /**
   * Mark that changes have occurred (show green dot)
   */
  markHasChanges(): void {
    localStorage.setItem(this.UNSEEN_CHANGES_KEY, 'true');
  }

  /**
   * Mark changes as seen (hide green dot)
   */
  markChangesAsSeen(): void {
    localStorage.removeItem(this.UNSEEN_CHANGES_KEY);
  }

  /**
   * Clear all stored data (for logout)
   */
  clear(): void {
    localStorage.removeItem(this.LAST_CHECK_KEY);
    localStorage.removeItem(this.SNAPSHOT_KEY);
    localStorage.removeItem(this.UNSEEN_CHANGES_KEY);
  }
}
```

**Estimated Effort:** 1 hour

---

#### 1.3 MutualOrchestrator

**File:** `src/services/orchestration/MutualOrchestrator.ts` (NEW)

**Purpose:** Check mutual follow status via Nostr relays

```typescript
import { Orchestrator } from './Orchestrator';
import { NostrTransport } from '../transport/NostrTransport';
import { AuthService } from '../AuthService';
import { RelayConfig } from '../RelayConfig';
import { FollowOrchestrator } from './FollowOrchestrator';
import type { NostrEvent } from '@nostr-dev-kit/ndk';

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
   * Get all mutual pubkeys (users who follow back)
   * This is the performance-critical method - runs in background
   */
  async getAllMutualPubkeys(): Promise<string[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return [];

    // Get list of users current user follows
    const followings = await this.followOrch.getFollowList();
    if (followings.length === 0) return [];

    const mutuals: string[] = [];
    const batchSize = 10; // Process 10 at a time to avoid overwhelming relays

    console.log(`[MutualOrchestrator] Checking ${followings.length} followings for mutual status...`);

    // Process in batches
    for (let i = 0; i < followings.length; i += batchSize) {
      const batch = followings.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(f => this.checkIfMutual(f.pubkey, currentUser.pubkey))
      );

      batchResults.forEach((isMutual, idx) => {
        if (isMutual) {
          mutuals.push(batch[idx].pubkey);
        }
      });

      // Rate limiting: Wait 500ms between batches
      if (i + batchSize < followings.length) {
        await this.delay(500);
      }

      // Progress logging (silent in production, useful for debugging)
      const progress = Math.min(i + batchSize, followings.length);
      console.log(`[MutualOrchestrator] Progress: ${progress}/${followings.length}`);
    }

    console.log(`[MutualOrchestrator] Found ${mutuals.length} mutuals out of ${followings.length} followings`);
    return mutuals;
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
      }], 3000); // 3 second timeout

      if (followList.length === 0) return false;

      // Check if current user is in their follow list
      const followsTags = followList[0].tags.filter(t => t[0] === 'p');
      return followsTags.some(t => t[1] === currentUserPubkey);
    } catch (error) {
      // Silent fail - don't interrupt background check
      console.warn(`[MutualOrchestrator] Failed to check mutual status for ${userPubkey}:`, error);
      return false;
    }
  }

  /**
   * Get mutual status for a single user (for UI display)
   */
  async checkSingleMutual(userPubkey: string): Promise<boolean> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return false;

    return await this.checkIfMutual(userPubkey, currentUser.pubkey);
  }

  /**
   * Helper: Delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Estimated Effort:** 2-3 hours

---

#### 1.4 MutualCheckScheduler

**File:** `src/services/MutualCheckScheduler.ts` (NEW)

**Purpose:** Background job that runs daily check

```typescript
import { MutualOrchestrator } from './orchestration/MutualOrchestrator';
import { MutualCheckStorage } from './storage/MutualCheckStorage';
import { SyntheticNotificationService } from './SyntheticNotificationService';
import { AuthService } from './AuthService';

export class MutualCheckScheduler {
  private static instance: MutualCheckScheduler;
  private checkInterval: NodeJS.Timeout | null = null;
  private mutualOrchestrator: MutualOrchestrator;
  private storage: MutualCheckStorage;
  private syntheticNotificationService: SyntheticNotificationService;
  private authService: AuthService;
  private isRunning: boolean = false;

  private constructor() {
    this.mutualOrchestrator = MutualOrchestrator.getInstance();
    this.storage = MutualCheckStorage.getInstance();
    this.syntheticNotificationService = SyntheticNotificationService.getInstance();
    this.authService = AuthService.getInstance();
  }

  public static getInstance(): MutualCheckScheduler {
    if (!MutualCheckScheduler.instance) {
      MutualCheckScheduler.instance = new MutualCheckScheduler();
    }
    return MutualCheckScheduler.instance;
  }

  /**
   * Start the scheduler
   */
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
    }, 60 * 60 * 1000); // Every 60 minutes
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[MutualCheckScheduler] Stopped');
  }

  /**
   * Check if 24 hours have passed since last check
   */
  private async checkIfDue(): Promise<void> {
    if (!this.authService.getCurrentUser()) {
      this.stop();
      return;
    }

    const lastCheck = this.storage.getLastCheckTimestamp();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // Check if never checked OR >24h since last check
    if (!lastCheck || (now - lastCheck) > twentyFourHours) {
      console.log('[MutualCheckScheduler] 24h passed, starting check...');
      await this.performDailyCheck();
    } else {
      const nextCheck = new Date(lastCheck + twentyFourHours);
      console.log(`[MutualCheckScheduler] Next check at: ${nextCheck.toLocaleString()}`);
    }
  }

  /**
   * Perform the daily mutual check
   */
  private async performDailyCheck(): Promise<void> {
    console.log('[MutualCheckScheduler] Starting daily mutual check...');
    const startTime = Date.now();

    try {
      // Get current mutual list
      const currentMutuals = await this.mutualOrchestrator.getAllMutualPubkeys();

      // Get previous snapshot
      const previousMutuals = this.storage.getPreviousMutuals();

      // Find NEW mutuals (in current but NOT in previous)
      const newMutuals = currentMutuals.filter(
        pubkey => !previousMutuals.includes(pubkey)
      );

      // Find LOST mutuals (in previous but NOT in current)
      const lostMutuals = previousMutuals.filter(
        pubkey => !currentMutuals.includes(pubkey)
      );

      console.log(`[MutualCheckScheduler] Check complete. Previous: ${previousMutuals.length}, Current: ${currentMutuals.length}, New: ${newMutuals.length}, Lost: ${lostMutuals.length}`);

      // Create notifications if changes detected
      let hasChanges = false;

      if (newMutuals.length > 0) {
        console.log(`[MutualCheckScheduler] Creating notification for ${newMutuals.length} new mutuals`);
        this.syntheticNotificationService.createNewMutualNotification(newMutuals);
        hasChanges = true;
      }

      if (lostMutuals.length > 0) {
        console.log(`[MutualCheckScheduler] Creating notification for ${lostMutuals.length} lost mutuals`);
        this.syntheticNotificationService.createUnfollowNotification(lostMutuals);
        hasChanges = true;
      }

      // Mark as having unseen changes (show green dot in sidebar)
      if (hasChanges) {
        this.storage.markHasChanges();
      }

      // Save new snapshot for tomorrow's comparison
      this.storage.saveMutualSnapshot(currentMutuals);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[MutualCheckScheduler] Daily check completed in ${duration}s`);
    } catch (error) {
      console.error('[MutualCheckScheduler] Daily check failed:', error);
      // Don't throw - will retry in 24h
    }
  }

  /**
   * Force a check now (for testing/manual trigger)
   */
  async forceCheck(): Promise<void> {
    await this.performDailyCheck();
  }
}
```

**Estimated Effort:** 2-3 hours

---

### Phase 2: NotificationsOrchestrator Integration (2-3 hours)

**Modified:** `src/services/orchestration/NotificationsOrchestrator.ts`

**Changes:**
1. Fetch synthetic notifications alongside Nostr events
2. Merge and sort by timestamp
3. Return unified notification list

```typescript
// Add to existing file
import { SyntheticNotificationService } from '../SyntheticNotificationService';

export class NotificationsOrchestrator extends Orchestrator {
  private syntheticNotificationService: SyntheticNotificationService;

  private constructor() {
    super('NotificationsOrchestrator');
    // ... existing code ...
    this.syntheticNotificationService = SyntheticNotificationService.getInstance();
  }

  /**
   * Fetch all notifications (Nostr + Synthetic)
   */
  async fetchNotifications(): Promise<NotificationGroup[]> {
    // 1. Fetch regular Nostr events
    const nostrNotifications = await this.fetchNostrNotifications();

    // 2. Fetch synthetic notifications
    const syntheticNotifications = this.fetchSyntheticNotifications();

    // 3. Merge and sort by timestamp (descending)
    const allNotifications = [...nostrNotifications, ...syntheticNotifications];
    allNotifications.sort((a, b) => b.timestamp - a.timestamp);

    return allNotifications;
  }

  /**
   * Convert synthetic notifications to NotificationGroup format
   */
  private fetchSyntheticNotifications(): NotificationGroup[] {
    const synthetics = this.syntheticNotificationService.getAll();

    return synthetics.map(s => {
      if (s.type === 'mutual_unfollow') {
        return {
          type: 'mutual_unfollow' as NotificationType,
          timestamp: s.timestamp,
          events: [], // No real Nostr events
          metadata: {
            id: s.id,
            pubkeys: s.data.pubkeys,
            count: s.data.count,
            seen: s.seen
          }
        };
      }

      if (s.type === 'mutual_new') {
        return {
          type: 'mutual_new' as NotificationType,
          timestamp: s.timestamp,
          events: [],
          metadata: {
            id: s.id,
            pubkeys: s.data.pubkeys,
            count: s.data.count,
            seen: s.seen
          }
        };
      }

      // Future: Handle other synthetic notification types
      return null;
    }).filter(n => n !== null) as NotificationGroup[];
  }

  /**
   * Get total unread count (Nostr + Synthetic)
   */
  getUnreadCount(): number {
    const nostrUnread = this.getNostrUnreadCount(); // Existing method
    const syntheticUnread = this.syntheticNotificationService.getUnreadCount();
    return nostrUnread + syntheticUnread;
  }
}
```

**Update NotificationType:**

```typescript
// In types/notifications.ts or NotificationsOrchestrator.ts
export type NotificationType =
  | 'zap'
  | 'reply'
  | 'reaction'
  | 'repost'
  | 'mention'
  | 'mutual_unfollow'
  | 'mutual_new'; // NEW
```

**Estimated Effort:** 1-2 hours

---

### Phase 3: NotificationsView Rendering (2-3 hours)

**Modified:** `src/components/views/NotificationsView.ts`

**Changes:**
1. Add rendering for `mutual_unfollow` notification type
2. Add rendering for `mutual_new` notification type (NEW!)
3. Mark synthetic notifications as seen when view is opened

```typescript
// Add to existing file
import { SyntheticNotificationService } from '../../services/SyntheticNotificationService';

export class NotificationsView extends View {
  private syntheticNotificationService: SyntheticNotificationService;

  constructor() {
    super();
    // ... existing code ...
    this.syntheticNotificationService = SyntheticNotificationService.getInstance();
  }

  /**
   * Render notification item based on type
   */
  private renderNotificationItem(group: NotificationGroup): string {
    switch (group.type) {
      case 'zap':
        return this.renderZapNotification(group);
      case 'reply':
        return this.renderReplyNotification(group);
      case 'reaction':
        return this.renderReactionNotification(group);
      case 'mutual_unfollow':
        return this.renderMutualUnfollowNotification(group);
      case 'mutual_new': // NEW
        return this.renderMutualNewNotification(group);
      default:
        return '';
    }
  }

  /**
   * Render mutual unfollow notification
   */
  private async renderMutualUnfollowNotification(group: NotificationGroup): Promise<string> {
    const { count, pubkeys, id, seen } = group.metadata;
    const firstTwoPubkeys = pubkeys.slice(0, 2);

    // Fetch usernames (use cached profiles if available)
    const profiles = await Promise.all(
      firstTwoPubkeys.map(pubkey =>
        this.userProfileService.getUserProfile(pubkey)
      )
    );

    const usernames = profiles.map(p => p?.name || p?.username || 'Unknown');

    // Build message
    let message: string;
    if (count === 1) {
      message = `${usernames[0]} stopped following back`;
    } else if (count === 2) {
      message = `${usernames[0]} and ${usernames[1]} stopped following back`;
    } else {
      const others = count - 2;
      message = `${usernames[0]}, ${usernames[1]}, and ${others} ${others === 1 ? 'other' : 'others'} stopped following back`;
    }

    const timeAgo = this.formatTimeAgo(group.timestamp);

    return `
      <div class="notification-item notification-item--mutual-unfollow ${seen ? '' : 'notification-item--unread'}"
           data-notification-id="${id}">
        <div class="notification-icon notification-icon--warning">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9V9h2v4zm0-6H9V5h2v2z"/>
          </svg>
        </div>
        <div class="notification-content">
          <p class="notification-message">${this.escapeHtml(message)}</p>
          <time class="notification-timestamp">${timeAgo}</time>
        </div>
        <button class="notification-action btn btn--small btn--passive"
                data-action="view-mutuals">
          View Details
        </button>
      </div>
    `;
  }

  /**
   * Render new mutual notification (NEW!)
   */
  private async renderMutualNewNotification(group: NotificationGroup): Promise<string> {
    const { count, pubkeys, id, seen } = group.metadata;
    const firstTwoPubkeys = pubkeys.slice(0, 2);

    // Fetch usernames (use cached profiles if available)
    const profiles = await Promise.all(
      firstTwoPubkeys.map(pubkey =>
        this.userProfileService.getUserProfile(pubkey)
      )
    );

    const usernames = profiles.map(p => p?.name || p?.username || 'Unknown');

    // Build message
    let message: string;
    if (count === 1) {
      message = `${usernames[0]} is now a new mutual!`;
    } else if (count === 2) {
      message = `${usernames[0]} and ${usernames[1]} are now new mutuals!`;
    } else {
      const others = count - 2;
      message = `${usernames[0]}, ${usernames[1]}, and ${others} ${others === 1 ? 'other' : 'others'} are now new mutuals!`;
    }

    const timeAgo = this.formatTimeAgo(group.timestamp);

    return `
      <div class="notification-item notification-item--mutual-new ${seen ? '' : 'notification-item--unread'}"
           data-notification-id="${id}">
        <div class="notification-icon notification-icon--success">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm4.3 6.3l-5 5a1 1 0 01-1.4 0l-2-2a1 1 0 111.4-1.4L8.6 11l4.3-4.3a1 1 0 111.4 1.4z"/>
          </svg>
        </div>
        <div class="notification-content">
          <p class="notification-message">${this.escapeHtml(message)}</p>
          <time class="notification-timestamp">${timeAgo}</time>
        </div>
        <button class="notification-action btn btn--small btn--positive"
                data-action="view-mutuals">
          View Details
        </button>
      </div>
    `;
  }

  /**
   * Mark synthetic notifications as seen when view is opened
   */
  private markSyntheticNotificationsAsSeen(): void {
    const unread = this.syntheticNotificationService.getAll().filter(n => !n.seen);

    unread.forEach(notif => {
      this.syntheticNotificationService.markAsSeen(notif.id);
    });

    if (unread.length > 0) {
      // Update badge count
      this.eventBus.emit('notifications:updated');
    }
  }

  /**
   * Handle button clicks
   */
  private setupEventListeners(): void {
    // ... existing code ...

    // Handle "View Details" button for mutual changes
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.dataset.action === 'view-mutuals') {
        e.preventDefault();
        this.router.navigate('/mutuals?filter=recent-changes');
      }
    });
  }

  /**
   * Override render to mark notifications as seen
   */
  async render(): Promise<void> {
    // ... existing render logic ...

    // Mark synthetic notifications as seen after 1 second
    setTimeout(() => {
      this.markSyntheticNotificationsAsSeen();
    }, 1000);
  }
}
```

**Estimated Effort:** 2-3 hours

---

### Phase 4: App.ts Integration (30 minutes)

**Modified:** `src/App.ts`

**Changes:** Initialize scheduler on app startup

```typescript
import { MutualCheckScheduler } from './services/MutualCheckScheduler';

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

**Estimated Effort:** 30 minutes

---

### Phase 5: MainLayout Sidebar Integration (1-2 hours)

**Modified:** `src/components/layout/MainLayout.ts`

**Changes:** Add green dot indicator to Lists → Mutuals menu item

```typescript
import { MutualCheckStorage } from '../../services/storage/MutualCheckStorage';
import { EventBus } from '../../services/EventBus';

export class MainLayout {
  private mutualCheckStorage: MutualCheckStorage;
  private eventBus: EventBus;

  constructor() {
    // ... existing code ...
    this.mutualCheckStorage = MutualCheckStorage.getInstance();
    this.eventBus = EventBus.getInstance();

    // Listen for mutual changes
    this.eventBus.on('notification:new', () => {
      this.updateMutualsIndicator();
    });
  }

  /**
   * Render Lists section in sidebar
   */
  private renderListsSection(): string {
    const hasUnseenChanges = this.mutualCheckStorage.hasUnseenChanges();

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
          ${hasUnseenChanges ? '<span class="status-indicator status-indicator--green"></span>' : ''}
        </button>
        <button class="sidebar-item" data-tab="muted">
          <span class="sidebar-item-icon">🔇</span>
          <span class="sidebar-item-label">Muted Users</span>
        </button>
        <button class="sidebar-item" data-tab="cache">
          <span class="sidebar-item-icon">💾</span>
          <span class="sidebar-item-label">Cache</span>
        </button>
      </div>
    `;
  }

  /**
   * Handle tab switches
   */
  private handleTabSwitch(tabName: string): void {
    // ... existing tab switch logic ...

    // If user opens Mutuals tab, mark changes as seen
    if (tabName === 'mutuals') {
      this.mutualCheckStorage.markChangesAsSeen();
      this.updateMutualsIndicator();
    }
  }

  /**
   * Update the green dot indicator
   */
  private updateMutualsIndicator(): void {
    const mutualsTab = this.container.querySelector('[data-tab="mutuals"]');
    if (!mutualsTab) return;

    const hasUnseenChanges = this.mutualCheckStorage.hasUnseenChanges();
    const existingIndicator = mutualsTab.querySelector('.status-indicator');

    if (hasUnseenChanges && !existingIndicator) {
      // Add green dot
      const indicator = document.createElement('span');
      indicator.className = 'status-indicator status-indicator--green';
      mutualsTab.appendChild(indicator);
    } else if (!hasUnseenChanges && existingIndicator) {
      // Remove green dot
      existingIndicator.remove();
    }
  }
}
```

**Estimated Effort:** 1-2 hours

---

### Phase 6: UI Styling (30 minutes - 1 hour)

#### 6.1 Notification Styles

**Modified:** `src/styles/components/_notifications.scss`

**Add styles for both notification types:**

```scss
// Unfollow notification (warning)
.notification-item--mutual-unfollow {
  border-left: 3px solid $color-warning; // Orange/Yellow warning color

  .notification-icon--warning {
    color: $color-warning;
    background: rgba($color-warning, 0.1);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .notification-action {
    background: $color-4; // Pink button
    color: white;
    padding: calc($gap / 3) calc($gap / 1.5);
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s ease;

    &:hover {
      background: darken($color-4, 10%);
      transform: translateY(-1px);
    }
  }
}

.notification-item--unread.notification-item--mutual-unfollow {
  background: rgba($color-warning, 0.05);
}

// New mutual notification (success) - NEW!
.notification-item--mutual-new {
  border-left: 3px solid $color-success; // Green success color

  .notification-icon--success {
    color: $color-success;
    background: rgba($color-success, 0.1);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .notification-action {
    background: $color-success; // Green button
    color: white;
    padding: calc($gap / 3) calc($gap / 1.5);
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s ease;

    &:hover {
      background: darken($color-success, 10%);
      transform: translateY(-1px);
    }
  }
}

.notification-item--unread.notification-item--mutual-new {
  background: rgba($color-success, 0.05);
}
```

#### 6.2 Sidebar Green Dot Indicator

**Modified:** `src/styles/components/_sidebar.scss` (or appropriate location)

**Add styles for status indicator dot:**

```scss
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-left: calc($gap / 2);

  &--green {
    background: #10b981; // Emerald green
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

// Ensure sidebar item has flex layout for alignment
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

**Estimated Effort:** 30 minutes - 1 hour

---

### Phase 7: Optional - Dedicated Mutuals View (4-6 hours)

**Note:** This is optional - the core feature works without it

**File:** `src/components/views/MutualCheckView.ts` (NEW)
**File:** `src/components/layout/managers/MutualSidebarManager.ts` (NEW)

**Features:**
- Full list of followings with mutual badges
- Filter: "Show only non-mutuals"
- Stats display
- Unfollow button
- Recent changes section at top (both new and lost mutuals)

**Implementation:** Similar to `MuteListView.ts` using `BaseListSidebarManager` pattern

**Estimated Effort:** 4-6 hours (optional)

---

## Data Flow & Timing

### Scenario 1: First-Time User

```
Day 1, 10:00
  User logs in
    → App.ts initializes MutualCheckScheduler
    → Scheduler.start()
    → checkIfDue(): lastCheck = null → RUN CHECK
    → MutualOrchestrator.getAllMutualPubkeys()
        → Fetch 150 followings
        → Check each for mutual status (batched, 10 at a time)
        → Result: 87 mutuals
    → MutualCheckStorage.saveMutualSnapshot([87 pubkeys])
    → No notification (first check, nothing to compare)
    → Set checkInterval (every 60 minutes)

Day 1, 11:00 - 23:00
  Hourly checks
    → checkIfDue(): lastCheck = 10:00 (1h ago) → SKIP
    → Next check at Day 2, 10:01
```

### Scenario 2: Daily Check Detects Both New and Lost Mutuals

```
Day 2, 10:01
  Hourly check
    → checkIfDue(): lastCheck = Day 1, 10:00 (24h 1min ago) → RUN CHECK
    → getAllMutualPubkeys() → [86 mutuals]
    → Previous snapshot: 87 mutuals
    → Compare:
        - NEW mutuals: charlie_pubkey (someone new followed back!)
        - LOST mutuals: alice_pubkey, bob_pubkey (2 unfollowers)
        - Net change: 87 - 2 + 1 = 86
    → SyntheticNotificationService.createNewMutualNotification([charlie])
        → Create notification object (mutual_new)
        → Save to localStorage
        → Emit 'notification:new' event
    → SyntheticNotificationService.createUnfollowNotification([alice, bob])
        → Create notification object (mutual_unfollow)
        → Save to localStorage
        → Emit 'notification:new' event
    → MutualCheckStorage.markHasChanges()
        → Green dot appears in sidebar: "Lists → Mutuals ●"
    → MutualCheckStorage.saveMutualSnapshot([86 pubkeys])
    → MainLayout.updateMutualsIndicator()
        → Green dot rendered next to Mutuals menu item
    → User sees:
        - Notification badge: "5" (2 zaps + 2 mutual notifications)
        - Green dot: "Mutuals ●" in sidebar

User opens NotificationView (10:30)
    → NotificationsOrchestrator.fetchNotifications()
        → Fetch Nostr events: [3 zaps, 2 replies]
        → Fetch synthetic: [1 mutual_new, 1 mutual_unfollow]
        → Merge & sort
    → NotificationsView.render()
        → Display:
            - "alice zapped you 1000 sats" (5m ago)
            - "charlie is now a new mutual!" (29m ago) ← NEW (green, positive)
            - "alice and bob stopped following back" (29m ago) ← WARNING (orange)
            - "dave replied to your note" (1h ago)
    → After 1s: markSyntheticNotificationsAsSeen()
        → Both notifications marked as seen
        → Notification badge decrements to "3"
        → Green dot PERSISTS (still visible: "Mutuals ●")

User continues browsing (11:00)
    → Green dot still visible in sidebar
    → Persistent reminder that mutual status changed

User clicks "Lists → Mutuals" (14:00)
    → MainLayout.handleTabSwitch('mutuals')
    → MutualCheckStorage.markChangesAsSeen()
    → MainLayout.updateMutualsIndicator()
        → Green dot disappears
    → MutualCheckView renders (optional)
        → Shows full list with mutual badges
        → Highlights recent changes at top:
            - "✅ New: charlie (3h ago)"
            - "⚠️ Lost: alice, bob (3h ago)"
```

### Scenario 3: App Closed for Multiple Days

```
Day 1, 10:00
  Last check performed
    → Snapshot: 100 mutuals

App closed for 3 days

Day 4, 15:00
  User opens app
    → App.ts initializes MutualCheckScheduler
    → checkIfDue(): lastCheck = Day 1, 10:00 (72h ago) → RUN CHECK
    → getAllMutualPubkeys() → [98 mutuals]
    → Compare:
        - Previous: 100
        - Current: 98
        - NEW: 3 new mutuals (users started following back)
        - LOST: 5 unfollows
        - Net: 100 - 5 + 3 = 98
    → Create TWO notifications:
        - "alice, bob, and 1 other are now new mutuals!"
        - "charlie, dave, and 3 others stopped following back"
    → Save new snapshot

Result: User is notified of all changes that happened while app was closed
```

---

## Edge Cases & Error Handling

### Edge Case 1: User Unfollows Someone

**Problem:** If user unfollows alice, alice disappears from following list, looks like alice unfollowed back

**Solution:** Only check mutual status for users still in current following list

```typescript
// In MutualCheckScheduler.performDailyCheck()
const lostMutuals = previousMutuals.filter(pubkey => {
  // Only consider as lost mutual if:
  // 1. Was in previous mutuals
  // 2. Current user STILL follows them (not in current mutuals)
  // 3. Current user hasn't unfollowed them

  const stillFollowing = currentFollowingsList.includes(pubkey);
  const notInCurrentMutuals = !currentMutuals.includes(pubkey);

  return stillFollowing && notInCurrentMutuals;
});
```

### Edge Case 2: Relay Errors

**Problem:** Relay timeout/error during check

**Solution:** Silent fail, retry in 24h

```typescript
try {
  const isMutual = await this.checkIfMutual(pubkey);
  return isMutual;
} catch (error) {
  console.warn('Relay error, assuming non-mutual');
  return false; // Conservative: Don't mark as unfollower on error
}
```

### Edge Case 3: Performance on Large Following Lists

**Problem:** User follows 1000+ people, check takes too long

**Solutions:**
1. **Batch processing:** 10 at a time with 500ms delays
2. **Timeout per request:** 3 seconds max
3. **Progress logging:** User can see in dev tools (optional UI progress bar)
4. **Background execution:** Doesn't block UI

**Estimated time for 1000 follows:**
- 1000 / 10 batches = 100 batches
- 100 batches × 0.5s delay = 50 seconds
- 1000 requests × 3s avg = ~5 minutes total (with parallelism)

**Acceptable:** Happens once per day in background

### Edge Case 4: User Has No Followers

**Problem:** New user, no one follows back yet

**Solution:**
- First check saves empty snapshot
- Next check compares empty to empty → no notification
- Works correctly

### Edge Case 5: Multiple Devices

**Problem:** User uses app on desktop + mobile, checks run twice

**Solution:** Each device maintains its own snapshot (localStorage is per-device)
- Not a problem: Each device tracks independently
- User might see notification on both devices (acceptable)

---

## Testing Plan

### Unit Tests

**SyntheticNotificationService:**
- ✅ Create unfollow notification
- ✅ Create new mutual notification
- ✅ Save to localStorage
- ✅ Retrieve all notifications
- ✅ Mark as seen
- ✅ Get unread count
- ✅ Cleanup old notifications

**MutualCheckStorage:**
- ✅ Save and retrieve snapshot
- ✅ Get last check timestamp
- ✅ Clear on logout

**MutualOrchestrator:**
- ✅ Check single mutual (mock relay response)
- ✅ Get all mutuals with batching
- ✅ Handle relay errors gracefully

**MutualCheckScheduler:**
- ✅ Check runs when >24h passed
- ✅ Check skips when <24h passed
- ✅ New mutuals detected correctly
- ✅ Lost mutuals detected correctly
- ✅ Both notifications created when both types of changes occur

### Integration Tests

**Scenario 1: First Check**
1. User logs in (fresh install)
2. Check runs immediately
3. Snapshot saved
4. No notification created

**Scenario 2: New Mutual Detection**
1. Day 1: Check runs, 10 mutuals
2. Manually modify snapshot to 9 mutuals
3. Day 2: Check runs
4. Verify notification created for 1 new mutual

**Scenario 3: Unfollow Detection**
1. Day 1: Check runs, 10 mutuals
2. Manually modify snapshot to 12 mutuals
3. Day 2: Check runs
4. Verify notification created for 2 unfollowers

**Scenario 4: Both Changes**
1. Day 1: Check runs, 10 mutuals
2. Manually modify snapshot: add 2, remove 1 → 11 in snapshot
3. Day 2: Check runs (real: 10 mutuals)
4. Verify TWO notifications:
   - 1 new mutual (real had someone new)
   - 2 unfollowers (snapshot had 2 extra)

**Scenario 5: NotificationView Integration**
1. Create both synthetic notification types manually
2. Open NotificationView
3. Verify both notifications render correctly with different styles
4. Verify marked as seen after 1s
5. Verify badge updates

### Manual Testing Checklist

- [ ] Install fresh app, login
- [ ] Verify first check runs (console logs)
- [ ] Verify snapshot saved in localStorage
- [ ] Manually edit snapshot to simulate new mutuals
- [ ] Wait 24h OR force check
- [ ] Verify "new mutual" notification appears (green, positive)
- [ ] Manually edit snapshot to simulate unfollows
- [ ] Force check
- [ ] Verify "unfollow" notification appears (orange, warning)
- [ ] Verify both notification types can appear simultaneously
- [ ] Verify notification badge increments
- [ ] Open NotificationView
- [ ] Verify both notification types render with correct styling
- [ ] Wait 1s, verify marked as seen
- [ ] Verify badge decrements
- [ ] Click "View Details" button
- [ ] Logout, verify storage cleared

---

## Performance Considerations

### Network Impact

**Worst Case: 1000 Followings**
- 1000 relay requests (Kind 3 events)
- Batched: 10 requests every 500ms
- Total time: ~5-8 minutes
- Happens once per 24 hours
- User sees nothing (background)

**Mitigation:**
- Timeout per request: 3 seconds (fail fast)
- Batch size: Configurable (default 10)
- Rate limiting: 500ms between batches
- Silent failures: Don't block check on errors

### Storage Impact

**localStorage Usage:**
```json
{
  "noornote_mutual_last_check": "1732185600000",
  "noornote_mutual_snapshot": {
    "timestamp": 1732185600000,
    "mutualPubkeys": ["pubkey1...", "pubkey2...", ...] // ~100 pubkeys
  },
  "noornote_synthetic_notifications": [
    {
      "id": "mutual-new-1732185600000",
      "type": "mutual_new",
      "timestamp": 1732185600,
      "seen": false,
      "data": {
        "pubkeys": ["pubkey1"],
        "count": 1
      }
    },
    {
      "id": "mutual-unfollow-1732185700000",
      "type": "mutual_unfollow",
      "timestamp": 1732185700,
      "seen": false,
      "data": {
        "pubkeys": ["pubkey2", "pubkey3"],
        "count": 2
      }
    }
  ],
  "noornote_mutual_unseen_changes": "true"
}
```

**Size Estimate:**
- Last check: 50 bytes
- Snapshot (100 mutuals): ~6 KB
- Notifications (last 100): ~25 KB (both types)
- Unseen changes flag: 30 bytes
- **Total: ~31 KB** (negligible)

### UI Performance

**NotificationView:**
- Additional fetch: O(1) (localStorage)
- Merge operation: O(n) where n = total notifications (~100)
- Rendering: No impact (same as other notifications)

**Conclusion:** Performance impact is minimal and acceptable

---

## Future Enhancements

### Enhancement 1: Weekly Summary

**Feature:** "This week: +3 mutuals, -2 unfollows"

**Implementation:**
- Track daily changes
- Aggregate over 7 days
- Send summary notification on Sunday

### Enhancement 2: Mutual Score

**Feature:** Show "mutual strength" based on interactions

```typescript
interface MutualStrength {
  pubkey: string;
  isMutual: boolean;
  interactions: {
    zaps: number;
    replies: number;
    reactions: number;
  };
  score: number; // 0-100
}
```

### Enhancement 3: Export/Import

**Feature:** Export mutual list to CSV

```
Username,Pubkey,Is Mutual,Last Interaction
alice,npub1abc...,true,2 days ago
bob,npub1def...,false,never
```

### Enhancement 4: Mutual Recommendations

**Feature:** "5 users follow you back but you don't follow them yet"

---

## File Structure Summary

### New Files (8 total)

```
src/services/
  SyntheticNotificationService.ts           (NEW - 180 lines)
  MutualCheckScheduler.ts                   (NEW - 140 lines)

src/services/storage/
  MutualCheckStorage.ts                     (NEW - 80 lines)

src/services/orchestration/
  MutualOrchestrator.ts                     (NEW - 120 lines)

src/components/views/
  MutualCheckView.ts                        (OPTIONAL - 200 lines)

src/components/layout/managers/
  MutualSidebarManager.ts                   (OPTIONAL - 150 lines)
```

### Modified Files (5 total)

```
src/App.ts                                          (+15 lines)
src/services/orchestration/NotificationsOrchestrator.ts (+50 lines)
src/components/views/NotificationsView.ts           (+90 lines)
src/components/layout/MainLayout.ts                 (+40 lines)
src/styles/components/_notifications.scss           (+60 lines)
```

**Total New Code:** ~770 lines (core feature) + ~350 lines (optional view) = **~1120 lines**

---

## Effort Breakdown

| Phase | Task | Effort |
|-------|------|--------|
| **1** | SyntheticNotificationService (both types) | 1.5-2h |
| **1** | MutualCheckStorage | 1h |
| **1** | MutualOrchestrator | 2-3h |
| **1** | MutualCheckScheduler (bidirectional) | 2.5-3h |
| **2** | NotificationsOrchestrator integration | 1-2h |
| **3** | NotificationsView rendering (both types) | 2.5-3h |
| **4** | App.ts integration | 30min |
| **5** | MainLayout sidebar integration | 1-2h |
| **6** | UI Styling (both notification types) | 1-1.5h |
| **7** | Testing & debugging | 2-3h |
| | **Core Feature Total** | **12-17h** |
| **Optional** | MutualCheckView + UI | 4-6h |
| | **With Optional View** | **16-23h** |

---

## Success Criteria

### Core Feature

- [ ] Background check runs once per 24 hours
- [ ] Check completes within 10 minutes for 500 followings
- [ ] New mutuals correctly detected (no false positives)
- [ ] Lost mutuals correctly detected (no false positives)
- [ ] Both notification types created when both changes occur
- [ ] Synthetic notifications appear in NotificationView
- [ ] Notification badge increments/decrements correctly
- [ ] Notifications marked as seen when view opened
- [ ] "View Details" button works
- [ ] Storage persists across app restarts
- [ ] Scheduler stops on logout, starts on login
- [ ] No performance impact on app startup
- [ ] Green dot appears for any change (new or lost)
- [ ] Green dot persists until Mutuals tab opened
- [ ] Visual distinction between new (green) and lost (orange) notifications

### Optional View

- [ ] Shows full list of followings
- [ ] Mutual badges display correctly
- [ ] Unfollow button works
- [ ] Stats display correctly
- [ ] Recent changes section at top (both new and lost)

---

## Rollout Plan

### Phase 1: Core Feature (Week 1-2)
- Implement all core services
- Integration with NotificationView
- Both notification types (new + lost)
- Basic testing

### Phase 2: Beta Testing (Week 3)
- Deploy to test users
- Monitor performance
- Collect feedback on timing (24h interval OK?)
- Check for false positives (both types)
- Verify user sentiment (positive feature?)

### Phase 3: Optional View (Week 4)
- Implement dedicated Mutuals tab
- Add bulk actions
- Add stats dashboard

### Phase 4: Enhancements (Future)
- Weekly summaries
- Mutual strength scoring
- Export functionality

---

## Known Limitations

1. **No Real-Time Updates:** Only checks once per 24h (by design)
2. **No Historical Data:** Can't retroactively detect changes before feature installed
3. **Relay-Dependent:** If relay doesn't have user's follow list, shows as non-mutual
4. **Storage:** Uses localStorage (cleared on browser cache clear)

---

## References

### Existing Code Patterns

- **BaseListSidebarManager:** `src/components/layout/managers/BaseListSidebarManager.ts`
- **FollowOrchestrator:** `src/services/orchestration/FollowOrchestrator.ts`
- **NotificationsOrchestrator:** `src/services/orchestration/NotificationsOrchestrator.ts`
- **NotificationsView:** `src/components/views/NotificationsView.ts`

### Nostr Protocol

- **Kind 3 (Follow List):** https://github.com/nostr-protocol/nips/blob/master/02.md
- **NIP-02 (Follow Lists):** https://github.com/nostr-protocol/nips/blob/master/02.md

---

**Last Updated:** 2025-11-21
**Author:** Development Team
**Status:** Ready for Implementation
