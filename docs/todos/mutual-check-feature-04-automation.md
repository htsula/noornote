# Phase 4: Background Scheduler + Notifications

**Status:** ✅ IMPLEMENTED (2025-12-02)
**Priority:** MEDIUM
**Effort:** 4-5 hours
**Dependencies:** Phase 2 + 3 complete
**Phase:** 4 of 6

---

## Goal

Automate the mutual checking process with background jobs and integrate with the **existing notification system** (NotificationsView).

**User Value:** "I want to be automatically notified when my mutual relationships change, without having to remember to check manually."

---

## Scope

### In Scope
- ✅ Background scheduler (runs once per 4-5 hours)
- ✅ **Delayed start: 2-5 minutes after app startup** (not immediate)
- ✅ Automatic snapshot comparison
- ✅ **Integration with existing NotificationsOrchestrator** (like Likes/Zaps)
- ✅ Dual-indicator system:
  - Notification in NotificationView (NV) - mixed with Zaps/Likes
  - Green dot in sidebar ("Follows" tab)
- ✅ **Persistent file storage** (`~/.noornote/{npub}/mutual-check-data.json`)
- ✅ Lifecycle management (start on login, stop on logout)

### Out of Scope
- ❌ Reciprocity analysis (Phase 5)
- ❌ Strength scoring (Phase 6)
- ❌ Real-time detection (stays interval-based)

---

## ⚠️ CRITICAL: Storage Architecture

**Problem:** localStorage can be cleared by user → data loss

**Solution:** Dual-layer storage with file as Source of Truth

```
┌─────────────────────────────────────────────────────────┐
│                    STORAGE FLOW                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ~/.noornote/{npub}/mutual-check-data.json             │
│  ════════════════════════════════════════              │
│           ↑ Write after check          ↓ Read on start │
│           │                            │               │
│           │                            ▼               │
│       ┌───┴────────────────────────────────┐          │
│       │         localStorage               │          │
│       │   (Runtime cache for fast access)  │          │
│       └────────────────────────────────────┘          │
│                        ↑                              │
│                        │                              │
│               MutualChangeStorage                     │
│               (Single API for both)                   │
│                                                        │
└─────────────────────────────────────────────────────────┘
```

### File Structure

```json
// ~/.noornote/npub1abc.../mutual-check-data.json
{
  "version": 1,
  "snapshot": {
    "timestamp": 1701388800000,
    "mutualPubkeys": ["pubkey1", "pubkey2", ...]
  },
  "lastCheckTimestamp": 1701388800000,
  "unseenChanges": true,
  "changes": [
    { "pubkey": "abc", "type": "unfollow", "detectedAt": 1701388800000 },
    { "pubkey": "def", "type": "new_mutual", "detectedAt": 1701388800000 }
  ],
  "checkHistory": [
    { "timestamp": 1701388800000, "unfollowCount": 1, "newMutualCount": 2, "durationMs": 5400 }
  ]
}
```

### Startup Flow

```
App Start
    │
    ├─► 1. User Login
    │
    ├─► 2. Read file → localStorage (MutualChangeStorage.initFromFile())
    │       - If file exists: populate localStorage
    │       - If file missing: first run, localStorage stays empty
    │
    ├─► 3. Start other services (Timeline, Notifications, etc.)
    │
    └─► 4. setTimeout(startScheduler, 2-5 minutes)
            │
            └─► Scheduler checks if due, runs if needed
```

---

## ⚠️ CRITICAL: Scheduler Timing

**Why delayed start?**
- Heavy operation (fetches Kind:3 from relays for ALL follows)
- User may just quickly open app to check something
- Avoid unnecessary load on startup

**Implementation:**
```typescript
// In App.ts handleUserLogin()
const SCHEDULER_DELAY_MS = 3 * 60 * 1000; // 3 minutes

setTimeout(async () => {
  const scheduler = MutualChangeScheduler.getInstance();
  await scheduler.start();
}, SCHEDULER_DELAY_MS);
```

**Consequence:**
- User opens app for <3 min → No check runs → That's OK
- User has app open >3 min → Check runs if due → "Tolle Überraschung"

---

## ⚠️ CRITICAL: Notification Integration

**NOT a separate SyntheticNotificationService!**

**Instead:** Inject into existing `NotificationsOrchestrator` as synthetic events.

### NotificationType Extension

```typescript
// In NotificationsOrchestrator.ts
export type NotificationType =
  | 'mention' | 'reply' | 'thread-reply' | 'repost' | 'reaction' | 'zap' | 'article'
  | 'mutual_unfollow'   // NEW: Someone stopped following back
  | 'mutual_new';       // NEW: Someone started following back
```

### Synthetic Event Injection

```typescript
// MutualChangeDetector creates synthetic NostrEvents
// These get injected into NotificationsOrchestrator

const syntheticEvent: NostrEvent = {
  id: `mutual-unfollow-${Date.now()}`,
  pubkey: unfollowerPubkey, // The person who unfollowed
  kind: 99001, // Custom kind for mutual changes (not published to relays)
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['type', 'mutual_unfollow'], // or 'mutual_new'
    ['p', currentUserPubkey]
  ],
  content: '',
  sig: '' // Empty - synthetic event
};

// Inject into NotificationsOrchestrator
notificationsOrch.injectSyntheticNotification(syntheticEvent, 'mutual_unfollow');
```

### NotificationsView Rendering

Mutual notifications appear in NV alongside Zaps/Likes:

```
┌────────────────────────────────────────────────┐
│ 🔔 Notifications                               │
├────────────────────────────────────────────────┤
│ ⚡ alice zapped your note (1000 sats)    2h    │
│ ❤️ bob liked your note                   3h    │
│ ⚠️ charlie stopped following back        5h    │  ← Mutual notification
│ ✅ dana started following you back!      1d    │  ← Mutual notification
│ 💬 eve replied to your note              1d    │
└────────────────────────────────────────────────┘
```

---

## User Stories

### Story 1: Delayed Automatic Checks
```
As a user,
The app should check for mutual changes after I've had it open for a few minutes,
So I get notified without impacting startup performance.
```

**Acceptance Criteria:**
- [ ] Scheduler starts 2-5 minutes after login (not immediately)
- [ ] Check runs once every 4-5 hours (if app stays open)
- [ ] Check runs on next eligible startup if app was closed
- [ ] Silent background operation (no UI during check)

### Story 2: Notification in NV
```
As a user,
When changes are detected, I want to see them in my Notifications,
So I'm informed just like with Zaps or Replies.
```

**Acceptance Criteria:**
- [ ] Mutual notifications appear in NotificationsView
- [ ] Mixed chronologically with Zaps/Likes/Replies
- [ ] Unfollow: "⚠️ alice stopped following back"
- [ ] New mutual: "✅ bob started following you back!"
- [ ] Clicking notification navigates to Follows tab
- [ ] Badge count includes mutual notifications

### Story 3: Persistent Storage
```
As a user,
I want my mutual check data to survive browser cache clearing,
So I don't lose my change history.
```

**Acceptance Criteria:**
- [ ] Data stored in `~/.noornote/{npub}/mutual-check-data.json`
- [ ] File read into localStorage on app startup
- [ ] File updated after each check
- [ ] localStorage used as runtime cache

### Story 4: Sidebar Green Dot
```
As a user,
I want a persistent indicator in the sidebar when changes occur,
So I don't miss changes even if I dismiss the notification.
```

**Acceptance Criteria:**
- [ ] Green dot appears next to "Follows" tab
- [ ] Persists even after notification is read
- [ ] Disappears only when user opens Follows tab
- [ ] State persists across app restarts (via file)

---

## Technical Implementation

### New Services

**1. MutualChangeStorage** (handles dual-layer storage)

```typescript
// src/services/storage/MutualChangeStorage.ts

export class MutualChangeStorage {
  private static instance: MutualChangeStorage;

  // File path: ~/.noornote/{npub}/mutual-check-data.json
  private getFilePath(): string { ... }

  /**
   * Initialize from file on app startup
   * MUST be called BEFORE scheduler starts
   */
  async initFromFile(): Promise<void> {
    const data = await this.readFile();
    if (data) {
      this.populateLocalStorage(data);
    }
  }

  /**
   * Save to both localStorage AND file
   */
  async save(): Promise<void> {
    const data = this.collectFromLocalStorage();
    await this.writeFile(data);
  }

  // ... getSnapshot, saveSnapshot, getChanges, etc.
}
```

**2. MutualChangeDetector** (comparison logic)

```typescript
// src/services/MutualChangeDetector.ts

export class MutualChangeDetector {
  /**
   * Perform comparison and create notifications
   * Returns detected changes
   */
  async detect(): Promise<{ unfollows: string[], newMutuals: string[] }> {
    // 1. Get current mutuals from MutualService
    // 2. Get previous snapshot from MutualChangeStorage
    // 3. Compare and find changes
    // 4. Inject synthetic notifications into NotificationsOrchestrator
    // 5. Save new snapshot
    // 6. Return changes for logging
  }
}
```

**3. MutualChangeScheduler** (background job)

```typescript
// src/services/MutualChangeScheduler.ts

export class MutualChangeScheduler {
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

  /**
   * Start scheduler (called 2-5 min after login)
   */
  async start(): Promise<void> {
    // Check immediately if due
    await this.checkIfDue();

    // Then check every 4 hours
    this.checkInterval = setInterval(() => this.checkIfDue(), this.CHECK_INTERVAL_MS);
  }

  private async checkIfDue(): Promise<void> {
    const lastCheck = storage.getLastCheckTimestamp();
    const now = Date.now();

    if (!lastCheck || (now - lastCheck) > this.CHECK_INTERVAL_MS) {
      await this.detector.detect();
    }
  }
}
```

---

### App.ts Integration

```typescript
// src/App.ts

private async handleUserLogin(data: { npub: string; pubkey: string }): Promise<void> {
  // ... existing code ...

  // Initialize mutual change storage from file FIRST
  const { MutualChangeStorage } = await import('./services/storage/MutualChangeStorage');
  const mutualStorage = MutualChangeStorage.getInstance();
  await mutualStorage.initFromFile();

  // Start scheduler DELAYED (2-5 minutes)
  const SCHEDULER_DELAY_MS = 3 * 60 * 1000; // 3 minutes

  setTimeout(async () => {
    const { MutualChangeScheduler } = await import('./services/MutualChangeScheduler');
    const scheduler = MutualChangeScheduler.getInstance();
    await scheduler.start();
    console.log('[App] MutualChangeScheduler started (delayed)');
  }, SCHEDULER_DELAY_MS);
}
```

---

### NotificationsOrchestrator Integration

```typescript
// Add to NotificationsOrchestrator.ts

/**
 * Inject a synthetic notification (not from relays)
 * Used by MutualChangeDetector for mutual change notifications
 */
public injectSyntheticNotification(event: NostrEvent, type: NotificationType): void {
  const notification: NotificationEvent = {
    event,
    type,
    timestamp: event.created_at
  };

  // Add to notifications (avoid duplicates)
  const exists = this.notifications.some(n => n.event.id === event.id);
  if (!exists) {
    this.notifications.push(notification);
    this.notifications.sort((a, b) => b.timestamp - a.timestamp);

    // Emit updates
    this.eventBus.emit('notifications:badge-update');
    this.eventBus.emit('notifications:new', { notification });
  }
}
```

---

## Testing

### Manual Testing Checklist

- [ ] App starts → File read into localStorage
- [ ] Wait 3+ minutes → Scheduler starts
- [ ] Verify check runs if >4h since last
- [ ] Force check via dev tools: `MutualChangeScheduler.getInstance().forceCheck()`
- [ ] Verify notifications appear in NotificationsView
- [ ] Verify notification badge increments
- [ ] Verify green dot appears next to "Follows"
- [ ] Open Follows tab → Green dot disappears
- [ ] Clear localStorage → Restart app → Data restored from file
- [ ] Logout → Scheduler stops
- [ ] Login → Storage initialized, scheduler delayed

### Edge Cases

- [ ] First run (no file) → Creates initial snapshot, no notifications
- [ ] App closed for 3 days → Runs check on next open (after delay)
- [ ] No changes → No notifications, no green dot
- [ ] Only new mutuals → Only positive notification
- [ ] Only unfollows → Only negative notification
- [ ] Both changes → Both notifications (separate entries)

---

## Performance Considerations

**Background Check:**
- Runs once per 4-5 hours (if app open)
- Delayed start (2-5 min after login)
- Batched relay requests
- Silent, non-blocking

**For 100 followings:** ~5-8 seconds
**For 500 followings:** ~30-60 seconds

**Acceptable:** User sees nothing, happens in background

---

## Success Criteria

- [ ] File storage works reliably
- [ ] Scheduler delay prevents startup impact
- [ ] Notifications appear in NV (like Zaps)
- [ ] Green dot works correctly
- [ ] No false positives
- [ ] Data survives localStorage clearing

---

## What's Next

**Phase 5:** Add reciprocity check (zap asymmetry detection) 🔥

---

---

## 🔧 Debug Helpers (DevTools Console)

The following debug helpers are available in the browser console:

```javascript
// === MutualChangeStorage ===
__MUTUAL_CHANGE_STORAGE__.logState()
// Logs: Snapshot, Last Check, Unseen Changes, Changes array

// === MutualChangeScheduler ===
__MUTUAL_CHANGE_SCHEDULER__.getStatus()
// Returns: { isRunning, lastCheckAttempt, lastSuccessfulCheck, nextCheckDue }

__MUTUAL_CHANGE_SCHEDULER__.forceCheck()
// Force immediate check (bypasses 4h interval) - useful for testing

__MUTUAL_CHANGE_SCHEDULER__.stop()
// Stop the scheduler manually
```

### Testing Flow

1. Login and wait 3 minutes for scheduler to start
2. Or use "Check for Changes" link in Follows tab (immediate, no delay)
3. First check creates initial snapshot (no notifications)
4. Second check compares with snapshot → detects changes
5. Use `forceCheck()` to skip 4h wait during testing

---

**Last Updated:** 2025-12-02
**Status:** ✅ Implemented
