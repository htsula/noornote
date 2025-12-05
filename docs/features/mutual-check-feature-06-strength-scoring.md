# Phase 6: Strength Scoring (Full Analytics)

**Status:** Planned
**Priority:** LOW (future enhancement)
**Effort:** 15-20 hours
**Dependencies:** Phase 5 complete
**Phase:** 6 of 6 (Final)

---

## Goal

Provide comprehensive relationship strength analysis based on all interaction types (Zaps, Replies, Reactions, Mentions).

**User Value:** "I want a complete picture of my relationship strength with each mutual, so I can curate my timeline based on actual engagement, not just follow status."

---

## Scope

### In Scope
- ✅ Track all interaction types:
  - Zaps (given/received) - weighted highest
  - Replies (given/received) - weighted high
  - Reactions (given/received) - weighted medium
  - Mentions (given/received) - weighted low
- ✅ Calculate strength score (0-100)
- ✅ Visual score display (progress bars)
- ✅ Sort by strength
- ✅ Strength categories: Strong (80-100), Active (50-79), Weak (20-49), Dead (0-19)
- ✅ IndexedDB cache layer (performance)
- ✅ Incremental updates (only fetch new events)
- ✅ Weekly summary notification
- ✅ Export to CSV

### Out of Scope
- ❌ Machine learning predictions
- ❌ Automated unfollowing
- ❌ Relationship recommendations

---

## Why Full Strength Scoring

### Limitations of Phase 5 (Zaps Only)

**Problem:**
- Not everyone zaps
- Some valuable relationships exist without zaps
- Zaps alone don't show full picture

**Example:**
- alice: 15 zaps sent, 0 replies, 0 reactions → Flagged asymmetric
- bob: 0 zaps, 50 meaningful replies → Not flagged, but actually strong

### Solution: Multi-Dimensional Scoring

**Strength = f(Zaps, Replies, Reactions, Mentions, Recency)**

```
Score = (
  Zaps        × 0.40 +
  Replies     × 0.30 +
  Reactions   × 0.20 +
  Mentions    × 0.15 +
  Reciprocity × 0.05
)
```

**Result:** Holistic view of relationship quality

---

## User Stories

### Story 1: Comprehensive Tracking
```
As a user,
The system should track all interaction types with each mutual,
So relationship strength can be accurately calculated.
```

**Acceptance Criteria:**
- [ ] Tracks Zaps (Kind 9735)
- [ ] Tracks Replies (Kind 1 with "e" tag)
- [ ] Tracks Reactions (Kind 7)
- [ ] Tracks Mentions (Kind 1 with "p" tag)
- [ ] Stored in IndexedDB (not localStorage - too large)
- [ ] Updated incrementally (only new events since last check)

### Story 2: Strength Score Display
```
As a user,
I want to see a strength score (0-100) for each mutual,
So I can quickly identify strong vs. weak connections.
```

**Acceptance Criteria:**
- [ ] Score displayed as number + progress bar
- [ ] Color-coded:
  - Strong (80-100): Green
  - Active (50-79): Blue
  - Weak (20-49): Yellow
  - Dead (0-19): Gray
- [ ] Icon next to score: 🔥 Strong, ⚡ Active, 💤 Weak, 💀 Dead

### Story 3: Sort by Strength
```
As a user,
I want to sort my mutuals by strength score,
So I can focus on strongest/weakest connections.
```

**Acceptance Criteria:**
- [ ] Sort dropdown: "Alphabetical", "Strength (High → Low)", "Strength (Low → High)"
- [ ] Default: Alphabetical
- [ ] Sort persists across sessions

### Story 4: Detailed Breakdown
```
As a user,
I want to click a mutual to see detailed interaction breakdown,
So I understand what contributes to their strength score.
```

**Acceptance Criteria:**
- [ ] Modal/expandable section shows:
  - Zaps: 15 sent (45k sats), 3 received (5k sats)
  - Replies: 8 sent, 12 received
  - Reactions: 25 sent, 18 received
  - Mentions: 2 sent, 1 received
  - Reciprocity score: 0.85 (balanced)
  - Last interaction: 2 days ago
- [ ] Visual breakdown (pie chart or bars)

### Story 5: Weekly Summary
```
As a user,
I want a weekly summary of relationship changes,
So I can track trends over time.
```

**Acceptance Criteria:**
- [ ] Sunday notification: "This week: +3 strong connections, -2 weak"
- [ ] Shows top 3 improving relationships
- [ ] Shows top 3 declining relationships
- [ ] Link to detailed view

### Story 6: Export Data
```
As a user,
I want to export my mutual relationship data,
So I can analyze it externally or back it up.
```

**Acceptance Criteria:**
- [ ] Export button → Downloads CSV
- [ ] Columns: Username, Pubkey, Is Mutual, Strength Score, Category, Zaps Given/Received, Replies Given/Received, etc.
- [ ] Filename: `noornote-mutuals-2025-11-21.csv`

---

## Technical Implementation

### New Storage: InteractionDB (IndexedDB)

```typescript
// src/services/storage/InteractionDB.ts

export interface InteractionStats {
  pubkey: string;
  lastUpdated: number;
  zapsGiven: number;
  zapsReceived: number;
  satsGiven: number;
  satsReceived: number;
  repliesGiven: number;
  repliesReceived: number;
  reactionsGiven: number;
  reactionsReceived: number;
  mentionsGiven: number;
  mentionsReceived: number;
  lastInteraction: number | null;
  strengthScore: number;
  category: 'strong' | 'active' | 'weak' | 'dead';
}

export class InteractionDB {
  private static instance: InteractionDB;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'noornote_interactions';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'interactions';

  public static getInstance(): InteractionDB {
    if (!InteractionDB.instance) {
      InteractionDB.instance = new InteractionDB();
    }
    return InteractionDB.instance;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'pubkey' });
          store.createIndex('strengthScore', 'strengthScore');
          store.createIndex('category', 'category');
        }
      };
    });
  }

  async saveInteractionStats(stats: InteractionStats): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.put(stats);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getInteractionStats(pubkey: string): Promise<InteractionStats | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(pubkey);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllInteractionStats(): Promise<InteractionStats[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
```

**Effort:** 2 hours

---

### New Service: StrengthScoringService

```typescript
// src/services/StrengthScoringService.ts

export class StrengthScoringService {
  private static instance: StrengthScoringService;
  private interactionDB: InteractionDB;
  private transport: NostrTransport;
  private authService: AuthService;
  private relayConfig: RelayConfig;

  // Scoring weights
  private readonly WEIGHTS = {
    ZAPS: 0.40,
    REPLIES: 0.30,
    REACTIONS: 0.20,
    MENTIONS: 0.05,
    RECIPROCITY: 0.05
  };

  public static getInstance(): StrengthScoringService {
    if (!StrengthScoringService.instance) {
      StrengthScoringService.instance = new StrengthScoringService();
    }
    return StrengthScoringService.instance;
  }

  private constructor() {
    this.interactionDB = InteractionDB.getInstance();
    this.transport = NostrTransport.getInstance();
    this.authService = AuthService.getInstance();
    this.relayConfig = RelayConfig.getInstance();
  }

  /**
   * Update interaction stats for all mutuals
   */
  async updateAllStats(mutualPubkeys: string[]): Promise<void> {
    console.log(`[StrengthScoringService] Updating stats for ${mutualPubkeys.length} mutuals...`);

    const batchSize = 5; // Smaller batches for full interaction tracking
    for (let i = 0; i < mutualPubkeys.length; i += batchSize) {
      const batch = mutualPubkeys.slice(i, i + batchSize);

      await Promise.all(
        batch.map(pubkey => this.updateStatsForMutual(pubkey))
      );

      if (i + batchSize < mutualPubkeys.length) {
        await this.delay(1000); // Longer delays for performance
      }

      const progress = Math.min(i + batchSize, mutualPubkeys.length);
      console.log(`[StrengthScoringService] Progress: ${progress}/${mutualPubkeys.length}`);
    }

    console.log('[StrengthScoringService] All stats updated');
  }

  /**
   * Update stats for a single mutual (incremental)
   */
  private async updateStatsForMutual(mutualPubkey: string): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    // Get existing stats (for incremental update)
    const existingStats = await this.interactionDB.getInteractionStats(mutualPubkey);
    const since = existingStats ? existingStats.lastUpdated : 0;

    const relays = this.relayConfig.getAllRelays().map(r => r.url);

    // Fetch all interaction types since last update
    const [zapsGiven, zapsReceived, repliesGiven, repliesReceived, reactionsGiven, reactionsReceived, mentionsGiven, mentionsReceived] = await Promise.all([
      // Zaps given
      this.transport.fetch(relays, [{
        kinds: [9735],
        authors: [currentUser.pubkey],
        '#p': [mutualPubkey],
        since
      }], 5000),

      // Zaps received
      this.transport.fetch(relays, [{
        kinds: [9735],
        authors: [mutualPubkey],
        '#p': [currentUser.pubkey],
        since
      }], 5000),

      // Replies given (Kind 1 with 'e' tag pointing to mutual's notes)
      this.fetchRepliesGiven(currentUser.pubkey, mutualPubkey, since, relays),

      // Replies received
      this.fetchRepliesReceived(mutualPubkey, currentUser.pubkey, since, relays),

      // Reactions given
      this.transport.fetch(relays, [{
        kinds: [7],
        authors: [currentUser.pubkey],
        '#p': [mutualPubkey],
        since
      }], 5000),

      // Reactions received
      this.transport.fetch(relays, [{
        kinds: [7],
        authors: [mutualPubkey],
        '#p': [currentUser.pubkey],
        since
      }], 5000),

      // Mentions given
      this.transport.fetch(relays, [{
        kinds: [1],
        authors: [currentUser.pubkey],
        '#p': [mutualPubkey],
        since
      }], 5000),

      // Mentions received
      this.transport.fetch(relays, [{
        kinds: [1],
        authors: [mutualPubkey],
        '#p': [currentUser.pubkey],
        since
      }], 5000)
    ]);

    // Aggregate counts
    const stats: InteractionStats = {
      pubkey: mutualPubkey,
      lastUpdated: Date.now(),
      zapsGiven: (existingStats?.zapsGiven || 0) + zapsGiven.length,
      zapsReceived: (existingStats?.zapsReceived || 0) + zapsReceived.length,
      satsGiven: (existingStats?.satsGiven || 0) + this.sumZapAmounts(zapsGiven),
      satsReceived: (existingStats?.satsReceived || 0) + this.sumZapAmounts(zapsReceived),
      repliesGiven: (existingStats?.repliesGiven || 0) + repliesGiven.length,
      repliesReceived: (existingStats?.repliesReceived || 0) + repliesReceived.length,
      reactionsGiven: (existingStats?.reactionsGiven || 0) + reactionsGiven.length,
      reactionsReceived: (existingStats?.reactionsReceived || 0) + reactionsReceived.length,
      mentionsGiven: (existingStats?.mentionsGiven || 0) + mentionsGiven.length,
      mentionsReceived: (existingStats?.mentionsReceived || 0) + mentionsReceived.length,
      lastInteraction: this.getLatestTimestamp([...zapsGiven, ...zapsReceived, ...repliesGiven, ...repliesReceived, ...reactionsGiven, ...reactionsReceived]),
      strengthScore: 0, // Calculated below
      category: 'dead'
    };

    // Calculate strength score
    stats.strengthScore = this.calculateStrengthScore(stats);
    stats.category = this.categorizeStrength(stats.strengthScore);

    // Save to IndexedDB
    await this.interactionDB.saveInteractionStats(stats);
  }

  /**
   * Calculate strength score (0-100)
   */
  private calculateStrengthScore(stats: InteractionStats): number {
    // Normalize each metric (0-100 scale)
    const zapScore = this.normalize(stats.zapsGiven + stats.zapsReceived, 0, 20);
    const replyScore = this.normalize(stats.repliesGiven + stats.repliesReceived, 0, 50);
    const reactionScore = this.normalize(stats.reactionsGiven + stats.reactionsReceived, 0, 100);
    const mentionScore = this.normalize(stats.mentionsGiven + stats.mentionsReceived, 0, 10);

    // Reciprocity score (0-100)
    const totalGiven = stats.zapsGiven + stats.repliesGiven + stats.reactionsGiven;
    const totalReceived = stats.zapsReceived + stats.repliesReceived + stats.reactionsReceived;
    const reciprocityScore = totalGiven > 0 && totalReceived > 0
      ? Math.min(100, (Math.min(totalGiven, totalReceived) / Math.max(totalGiven, totalReceived)) * 100)
      : 0;

    // Weighted sum
    const score =
      zapScore * this.WEIGHTS.ZAPS +
      replyScore * this.WEIGHTS.REPLIES +
      reactionScore * this.WEIGHTS.REACTIONS +
      mentionScore * this.WEIGHTS.MENTIONS +
      reciprocityScore * this.WEIGHTS.RECIPROCITY;

    return Math.round(score);
  }

  /**
   * Normalize value to 0-100 scale
   */
  private normalize(value: number, min: number, max: number): number {
    if (value <= min) return 0;
    if (value >= max) return 100;
    return ((value - min) / (max - min)) * 100;
  }

  /**
   * Categorize strength
   */
  private categorizeStrength(score: number): 'strong' | 'active' | 'weak' | 'dead' {
    if (score >= 80) return 'strong';
    if (score >= 50) return 'active';
    if (score >= 20) return 'weak';
    return 'dead';
  }

  // ... helper methods (fetchRepliesGiven, sumZapAmounts, getLatestTimestamp, delay) ...
}
```

**Effort:** 4-5 hours

---

### Updated MutualCheckScheduler

```typescript
// Add to existing scheduler

import { StrengthScoringService } from './StrengthScoringService';

export class MutualCheckScheduler {
  private strengthScoringService: StrengthScoringService;

  private constructor() {
    // ... existing code ...
    this.strengthScoringService = StrengthScoringService.getInstance();
  }

  private async performCheck(): Promise<void> {
    // ... existing mutual check code ...

    // Update strength scores for all current mutuals
    await this.strengthScoringService.updateAllStats(currentMutuals);

    // ... rest of code ...
  }
}
```

**Effort:** 15 minutes

---

### Updated MutualSidebarManager

```typescript
// Major updates to rendering and sorting

export class MutualSidebarManager {
  private interactionDB: InteractionDB;
  private sortBy: 'alphabetical' | 'strength-high' | 'strength-low' = 'alphabetical';

  async render(): Promise<void> {
    // ... fetch mutuals ...

    // Fetch interaction stats from IndexedDB
    const allStats = await this.interactionDB.getAllInteractionStats();
    const statsMap = new Map(allStats.map(s => [s.pubkey, s]));

    // Attach stats to items
    this.allItems = itemsWithProfiles.map(item => ({
      ...item,
      stats: statsMap.get(item.pubkey) || null
    }));

    this.renderList();
  }

  private renderList(): void {
    // Sort items
    let sortedItems = [...this.allItems];
    if (this.sortBy === 'strength-high') {
      sortedItems.sort((a, b) => (b.stats?.strengthScore || 0) - (a.stats?.strengthScore || 0));
    } else if (this.sortBy === 'strength-low') {
      sortedItems.sort((a, b) => (a.stats?.strengthScore || 0) - (b.stats?.strengthScore || 0));
    } else {
      sortedItems.sort((a, b) => a.username.localeCompare(b.username));
    }

    // Apply filters
    // ... existing filter logic ...

    this.container.innerHTML = `
      <div class="mutuals-container">
        <div class="mutuals-header">
          <!-- ... stats ... -->
          <select class="sort-dropdown">
            <option value="alphabetical" ${this.sortBy === 'alphabetical' ? 'selected' : ''}>Alphabetical</option>
            <option value="strength-high" ${this.sortBy === 'strength-high' ? 'selected' : ''}>Strength (High → Low)</option>
            <option value="strength-low" ${this.sortBy === 'strength-low' ? 'selected' : ''}>Strength (Low → High)</option>
          </select>
        </div>
        <div class="mutuals-list">
          ${sortedItems.map(item => this.renderItemWithStrength(item)).join('')}
        </div>
      </div>
    `;
  }

  private renderItemWithStrength(item: MutualItemWithProfile): string {
    const stats = item.stats;
    const score = stats?.strengthScore || 0;
    const category = stats?.category || 'dead';

    const categoryIcon = {
      strong: '🔥',
      active: '⚡',
      weak: '💤',
      dead: '💀'
    }[category];

    const categoryColor = {
      strong: '#10b981',
      active: '#3b82f6',
      weak: '#f59e0b',
      dead: '#6b7280'
    }[category];

    return `
      <div class="mutual-item" data-pubkey="${item.pubkey}">
        <div class="mutual-item__info">
          <span class="mutual-item__username">${this.escapeHtml(item.username)}</span>
          <div class="strength-display">
            <span class="strength-icon">${categoryIcon}</span>
            <div class="strength-bar">
              <div class="strength-bar__fill" style="width: ${score}%; background: ${categoryColor};"></div>
            </div>
            <span class="strength-score">${score}</span>
          </div>
        </div>
        <button class="mutual-item__details" data-pubkey="${item.pubkey}">Details</button>
        <button class="mutual-item__unfollow btn btn--small btn--danger">Unfollow</button>
      </div>
    `;
  }
}
```

**Effort:** 3-4 hours

---

### Export Functionality

```typescript
// Add to MutualSidebarManager

private exportToCSV(): void {
  const rows = [
    ['Username', 'Pubkey', 'Is Mutual', 'Strength Score', 'Category', 'Zaps Given', 'Zaps Received', 'Sats Given', 'Sats Received', 'Replies Given', 'Replies Received', 'Reactions Given', 'Reactions Received']
  ];

  this.allItems.forEach(item => {
    const stats = item.stats;
    rows.push([
      item.username,
      item.pubkey,
      item.isMutual ? 'Yes' : 'No',
      (stats?.strengthScore || 0).toString(),
      stats?.category || 'unknown',
      (stats?.zapsGiven || 0).toString(),
      (stats?.zapsReceived || 0).toString(),
      (stats?.satsGiven || 0).toString(),
      (stats?.satsReceived || 0).toString(),
      (stats?.repliesGiven || 0).toString(),
      (stats?.repliesReceived || 0).toString(),
      (stats?.reactionsGiven || 0).toString(),
      (stats?.reactionsReceived || 0).toString()
    ]);
  });

  const csv = rows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `noornote-mutuals-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
```

**Effort:** 1 hour

---

## SCSS Updates

```scss
.strength-display {
  display: flex;
  align-items: center;
  gap: calc($gap / 2);
  margin-top: calc($gap / 4);
}

.strength-icon {
  font-size: 16px;
}

.strength-bar {
  flex: 1;
  height: 8px;
  background: $color-2;
  border-radius: 4px;
  overflow: hidden;

  &__fill {
    height: 100%;
    transition: width 0.3s ease;
  }
}

.strength-score {
  font-size: 13px;
  font-weight: 600;
  color: $color-5;
  min-width: 30px;
  text-align: right;
}

.sort-dropdown {
  padding: calc($gap / 3) calc($gap / 2);
  border: 1px solid $color-2;
  border-radius: 4px;
  background: $color-1;
  color: $color-5;
  font-size: 13px;
  cursor: pointer;
}
```

**Effort:** 30 minutes

---

## Performance Considerations

**Critical:**
- 100 mutuals × 8 interaction types = 800 relay queries
- Batched: 5 mutuals at a time
- Total time: **10-15 minutes**
- Runs once per 24 hours (acceptable)

**Optimization:**
- Incremental updates (only fetch events since last check)
- IndexedDB caching (fast local access)
- Background processing (no UI blocking)

---

## Testing

### Manual Testing Checklist

- [ ] IndexedDB initializes correctly
- [ ] First check: All stats calculated
- [ ] Incremental check: Only new events fetched
- [ ] Strength scores accurate (spot-check 5-10 users)
- [ ] Categories correct (strong/active/weak/dead)
- [ ] Sort by strength works
- [ ] Progress bars render correctly
- [ ] Details modal shows full breakdown
- [ ] Export CSV works
- [ ] Weekly summary generates correctly

---

## Success Criteria

- [ ] Full interaction tracking works
- [ ] Strength scores feel accurate to users
- [ ] Performance acceptable (<15 min background check)
- [ ] Users find insights valuable
- [ ] Export functionality used
- [ ] Timeline quality improves

---

## Final Thoughts

**This completes the Mutual Check roadmap.**

Phase 6 represents the **ultimate version** of the feature - full analytics, comprehensive scoring, and actionable insights.

**Total effort across all 6 phases: 30-40 hours**

**Recommended approach:**
1. Start with Phase 1 (MVP) - validate core value
2. Progress through phases based on user demand
3. Phase 5 (Reciprocity) likely provides best ROI for effort
4. Phase 6 (Full Scoring) is optional - only if users want deeper analytics

---

**Last Updated:** 2025-11-21
**Status:** Ready for Future Implementation
