# Phase 5: Reciprocity Check (Zap Asymmetry) 🔥

**Status:** Planned
**Priority:** LOW (future enhancement)
**Effort:** 3-4 hours
**Dependencies:** Phase 4 complete
**Phase:** 5 of 6

---

## Goal

Identify asymmetric relationships where you zap someone repeatedly but never receive zaps back.

**User Value:** "I want to know if I'm supporting someone financially who doesn't reciprocate, so I can make informed decisions about who I follow."

**🔥 This is the 'Fire' Feature 🔥**

---

## Why This Matters

### The Insight

**Zaps = Money = Strongest Signal**

- Following someone = attention investment (low cost)
- Zapping someone = financial investment (real cost)
- Reciprocal zapping = mutual value recognition
- **One-way zapping = potential exploitation**

### The Emotional Impact

**User realizes:** "I've sent alice 45,000 sats over 3 months, but she's never zapped me once."

**This triggers action:**
1. Self-awareness: "Am I being taken for granted?"
2. Evaluation: "Does alice provide value to me?"
3. Decision: Keep following or unfollow

**Result:** Cleaner timeline, better signal-to-noise ratio.

---

## Scope

### In Scope
- ✅ Track zaps given to each follow
- ✅ Track zaps received from each follow
- ✅ Display zap stats in **existing Follow-Liste** (not separate view)
- ✅ Show "Outgoing Zaps" / "Incoming Zaps" as `(count) sum` next to .mutual-badge
- ✅ Orange color (same as Zap icon) with transparent orange background
- ✅ Badge style matching .mutual-badge

### UI Design
```
[Avatar] Username [Mutual] [Zaps: In (12) 372 | Out (28) 1.2k]  [Unfollow]
                   ↑green   ↑orange zap badge
```
- Format: `Zaps: In (count) sats | Out (count) sats`
- Orange color (#f59e0b) from Zap icon
- Transparent orange background (like mutual-badge style)

### Loading Behavior (IMPORTANT)
- Follow-Liste loads instantly (same speed as now)
- Zap values load **asynchronously** in background
- While loading: Show `[Zaps: Loading...]` with pulsing CSS effect
- Once loaded: Replace with actual values `[Zaps: In (12) 372 | Out (28) 1.2k]`
- If no zaps: Show `[Zaps: In (0) 0 | Out (0) 0]` (display zeros, don't hide)

### Out of Scope
- ❌ Separate Mutuals view (integrate into Follow-Liste)
- ❌ Full interaction tracking (Replies, Reactions) - Phase 6
- ❌ Strength scoring algorithm - Phase 6
- ❌ Export functionality - Phase 6
- ❌ Weekly summaries - Phase 6

---

## User Stories

### Story 1: Track Zap History
```
As a user,
The system should track all zaps I've sent and received,
So asymmetric relationships can be detected.
```

**Acceptance Criteria:**
- [ ] Background job tracks zaps (Kind 9735)
- [ ] Stored in localStorage (per mutual)
- [ ] Updated daily (alongside mutual check)
- [ ] Only tracks zaps to/from mutuals (not everyone)

### Story 2: Asymmetry Detection
```
As a user,
I want to see which mutuals I zap but never zap me back,
So I can evaluate those relationships.
```

**Acceptance Criteria:**
- [ ] Asymmetry ratio calculated: zapsGiven / (zapsReceived || 1)
- [ ] Flagged if ratio > 5 (you zap 5x more than received)
- [ ] Badge in Mutuals list: "⚠️ Asymmetric (15 sent, 0 received)"
- [ ] Tooltip shows exact numbers

### Story 3: Asymmetric Filter
```
As a user,
I want to filter to only see asymmetric relations,
So I can review and decide who to unfollow.
```

**Acceptance Criteria:**
- [ ] New filter: "Show asymmetric relations"
- [ ] Shows only mutuals with ratio > 5
- [ ] Stats: "15 asymmetric relations detected"
- [ ] Sorted by asymmetry severity (highest ratio first)

### Story 4: Actionable Insights
```
As a user,
I want detailed zap stats for asymmetric relations,
So I can make informed decisions.
```

**Acceptance Criteria:**
- [ ] Tooltip/modal shows:
  - Zaps sent: 15 (45,000 sats)
  - Zaps received: 0 (0 sats)
  - First zap sent: 2 months ago
  - Last zap sent: 3 days ago
- [ ] "Unfollow" button prominent for asymmetric relations

---

## Technical Implementation

### Important: Use Aggregator Relays

**For zap queries, always use `RelayConfig.getAggregatorRelays()`** instead of user-configured relays only. Aggregator relays index events from many other relays and provide better event discovery for zaps.

```typescript
const relays = this.relayConfig.getAggregatorRelays();
// Returns: relay.damus.io, relay.snort.social, nos.lol, relay.primal.net
```

---

### New Service: ZapTrackingService

```typescript
// src/services/ZapTrackingService.ts

export interface ZapStats {
  pubkey: string;
  zapsGiven: number;
  zapsReceived: number;
  satsGiven: number;
  satsReceived: number;
  firstZapSent: number | null;
  lastZapSent: number | null;
  asymmetryRatio: number;
}

export class ZapTrackingService {
  private static instance: ZapTrackingService;
  private readonly STORAGE_KEY = 'noornote_zap_tracking';
  private transport: NostrTransport;
  private authService: AuthService;
  private relayConfig: RelayConfig;

  public static getInstance(): ZapTrackingService {
    if (!ZapTrackingService.instance) {
      ZapTrackingService.instance = new ZapTrackingService();
    }
    return ZapTrackingService.instance;
  }

  private constructor() {
    this.transport = NostrTransport.getInstance();
    this.authService = AuthService.getInstance();
    this.relayConfig = RelayConfig.getInstance();
  }

  /**
   * Update zap stats for all mutuals
   */
  async updateZapStats(mutualPubkeys: string[]): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    console.log(`[ZapTrackingService] Updating zap stats for ${mutualPubkeys.length} mutuals...`);

    const relays = this.relayConfig.getAllRelays().map(r => r.url);
    const stats: Record<string, ZapStats> = {};

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < mutualPubkeys.length; i += batchSize) {
      const batch = mutualPubkeys.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (pubkey) => {
          stats[pubkey] = await this.getZapStatsForMutual(pubkey, currentUser.pubkey, relays);
        })
      );

      // Rate limiting
      if (i + batchSize < mutualPubkeys.length) {
        await this.delay(500);
      }
    }

    // Save to storage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
    console.log('[ZapTrackingService] Zap stats updated');
  }

  /**
   * Get zap stats for a single mutual
   */
  private async getZapStatsForMutual(
    mutualPubkey: string,
    currentUserPubkey: string,
    relays: string[]
  ): Promise<ZapStats> {
    // Fetch zaps given (current user → mutual)
    const zapsGiven = await this.transport.fetch(relays, [{
      kinds: [9735],
      authors: [currentUserPubkey],
      '#p': [mutualPubkey]
    }], 5000);

    // Fetch zaps received (mutual → current user)
    const zapsReceived = await this.transport.fetch(relays, [{
      kinds: [9735],
      authors: [mutualPubkey],
      '#p': [currentUserPubkey]
    }], 5000);

    // Calculate stats
    const satsGiven = zapsGiven.reduce((sum, zap) => sum + this.extractZapAmount(zap), 0);
    const satsReceived = zapsReceived.reduce((sum, zap) => sum + this.extractZapAmount(zap), 0);

    const timestamps = zapsGiven.map(z => z.created_at).sort((a, b) => a - b);
    const firstZapSent = timestamps.length > 0 ? timestamps[0] : null;
    const lastZapSent = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

    const asymmetryRatio = zapsGiven.length / (zapsReceived.length || 1);

    return {
      pubkey: mutualPubkey,
      zapsGiven: zapsGiven.length,
      zapsReceived: zapsReceived.length,
      satsGiven,
      satsReceived,
      firstZapSent,
      lastZapSent,
      asymmetryRatio
    };
  }

  /**
   * Extract zap amount from Kind 9735 event
   */
  private extractZapAmount(zapEvent: NostrEvent): number {
    const boltTag = zapEvent.tags.find(t => t[0] === 'bolt11');
    if (!boltTag || !boltTag[1]) return 0;

    // Decode bolt11 invoice to get amount (simplified)
    // In production, use proper bolt11 decoder
    try {
      const invoice = boltTag[1];
      // Extract amount from invoice (implementation depends on bolt11 library)
      return 1000; // Placeholder
    } catch {
      return 0;
    }
  }

  /**
   * Get zap stats from storage
   */
  getZapStats(pubkey: string): ZapStats | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;

    const allStats: Record<string, ZapStats> = JSON.parse(stored);
    return allStats[pubkey] || null;
  }

  /**
   * Get all zap stats
   */
  getAllZapStats(): Record<string, ZapStats> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  /**
   * Clear storage
   */
  clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Effort:** 2 hours

---

### Updated MutualCheckScheduler

```typescript
// Add to existing MutualCheckScheduler.ts

import { ZapTrackingService } from './ZapTrackingService';

export class MutualCheckScheduler {
  private zapTrackingService: ZapTrackingService;

  private constructor() {
    // ... existing code ...
    this.zapTrackingService = ZapTrackingService.getInstance();
  }

  private async performCheck(): Promise<void> {
    console.log('[MutualCheckScheduler] Starting background check...');

    try {
      // ... existing mutual check code ...

      // Update zap stats for all current mutuals
      await this.zapTrackingService.updateZapStats(currentMutuals);

      // ... rest of existing code ...
    } catch (error) {
      console.error('[MutualCheckScheduler] Check failed:', error);
    }
  }
}
```

**Effort:** 15 minutes

---

### Updated MutualSidebarManager

```typescript
// Add to existing MutualSidebarManager.ts

import { ZapTrackingService } from '../../../services/ZapTrackingService';

export class MutualSidebarManager {
  private zapTrackingService: ZapTrackingService;
  private showOnlyAsymmetric: boolean = false;

  constructor(containerElement: HTMLElement) {
    // ... existing code ...
    this.zapTrackingService = ZapTrackingService.getInstance();
  }

  private renderList(): void {
    let filteredItems = this.allItems;

    // Apply filters
    if (this.showOnlyNonMutuals) {
      filteredItems = filteredItems.filter(item => !item.isMutual);
    }

    if (this.showOnlyAsymmetric) {
      filteredItems = filteredItems.filter(item => {
        const zapStats = this.zapTrackingService.getZapStats(item.pubkey);
        return zapStats && zapStats.asymmetryRatio > 5;
      });
    }

    // Count asymmetric relations
    const asymmetricCount = this.allItems.filter(item => {
      const zapStats = this.zapTrackingService.getZapStats(item.pubkey);
      return zapStats && zapStats.asymmetryRatio > 5;
    }).length;

    const mutualCount = this.allItems.filter(item => item.isMutual).length;
    const totalCount = this.allItems.length;
    const percentage = totalCount > 0 ? Math.round((mutualCount / totalCount) * 100) : 0;

    this.container.innerHTML = `
      <div class="mutuals-container">
        <div class="mutuals-header">
          <div class="mutuals-stats">
            Following: ${totalCount} | Mutuals: ${mutualCount} (${percentage}%)
            ${asymmetricCount > 0 ? `<span class="asymmetric-count">⚠️ ${asymmetricCount} asymmetric</span>` : ''}
          </div>
          <!-- ... existing actions ... -->
        </div>
        <div class="mutuals-filters">
          <label>
            <input type="checkbox" ${this.showOnlyNonMutuals ? 'checked' : ''} class="filter-non-mutuals">
            Show only non-mutuals
          </label>
          <label>
            <input type="checkbox" ${this.showOnlyAsymmetric ? 'checked' : ''} class="filter-asymmetric">
            Show asymmetric relations
          </label>
        </div>
        <div class="mutuals-list">
          ${filteredItems.map(item => this.renderItem(item)).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderItem(item: MutualItemWithProfile): string {
    const zapStats = this.zapTrackingService.getZapStats(item.pubkey);
    const isAsymmetric = zapStats && zapStats.asymmetryRatio > 5;

    let badgeClass = item.isMutual ? 'mutual-badge--yes' : 'mutual-badge--no';
    let badgeText = item.isMutual ? '✓ Mutual' : 'Not following back';

    // Asymmetry takes precedence over other badges
    if (isAsymmetric && zapStats) {
      badgeClass += ' mutual-badge--asymmetric';
      badgeText = `⚠️ Asymmetric (${zapStats.zapsGiven} → ${zapStats.zapsReceived})`;
    }

    return `
      <div class="mutual-item ${isAsymmetric ? 'mutual-item--asymmetric' : ''}" data-pubkey="${item.pubkey}">
        <div class="mutual-item__info">
          <span class="mutual-item__username">${this.escapeHtml(item.username)}</span>
          <span class="mutual-badge ${badgeClass}" ${isAsymmetric ? `title="${this.getAsymmetryTooltip(zapStats!)}"` : ''}>
            ${badgeText}
          </span>
        </div>
        <button class="mutual-item__unfollow btn btn--small btn--danger">
          Unfollow
        </button>
      </div>
    `;
  }

  private getAsymmetryTooltip(stats: ZapStats): string {
    const firstZap = stats.firstZapSent ? this.formatDate(stats.firstZapSent) : 'N/A';
    const lastZap = stats.lastZapSent ? this.formatDate(stats.lastZapSent) : 'N/A';

    return `Zaps sent: ${stats.zapsGiven} (${stats.satsGiven.toLocaleString()} sats)\n` +
           `Zaps received: ${stats.zapsReceived} (${stats.satsReceived.toLocaleString()} sats)\n` +
           `First zap: ${firstZap}\n` +
           `Last zap: ${lastZap}`;
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  }

  private attachEventListeners(): void {
    // ... existing listeners ...

    // Asymmetric filter
    const filterAsymmetric = this.container.querySelector('.filter-asymmetric') as HTMLInputElement;
    if (filterAsymmetric) {
      filterAsymmetric.addEventListener('change', () => {
        this.showOnlyAsymmetric = filterAsymmetric.checked;
        this.renderList();
      });
    }
  }
}
```

**Effort:** 1 hour

---

### Updated SCSS

```scss
// Add to src/styles/components/_mutuals.scss

.asymmetric-count {
  margin-left: $gap;
  padding: calc($gap / 4) calc($gap / 2);
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.mutual-item--asymmetric {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.08);
}

.mutual-badge--asymmetric {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
  font-weight: 700;
}

.mutuals-filters {
  display: flex;
  flex-direction: column;
  gap: calc($gap / 2);
  padding-bottom: $gap;
  border-bottom: 1px solid $color-2;

  label {
    display: flex;
    align-items: center;
    gap: calc($gap / 2);
    font-size: 13px;
    color: $color-4;
    cursor: pointer;
  }
}
```

**Effort:** 15 minutes

---

## Testing

### Manual Testing Checklist

- [ ] Background job runs → Zap stats updated
- [ ] Verify localStorage contains zap data
- [ ] Manually create asymmetric scenario (zap someone 5+ times)
- [ ] Verify asymmetric badge appears
- [ ] Hover over badge → Tooltip shows correct stats
- [ ] Toggle "Show asymmetric relations" filter
- [ ] Verify only asymmetric relations shown
- [ ] Verify count in header is correct
- [ ] Unfollow asymmetric relation
- [ ] Verify count updates
- [ ] Verify no false positives (ratio < 5 not flagged)

### Edge Cases

- [ ] User has sent 0 zaps → No asymmetric flags
- [ ] User received zaps but never sent → Not flagged (reverse asymmetry)
- [ ] Equal zaps (1:1 ratio) → Not flagged
- [ ] Slightly asymmetric (2:1 ratio) → Not flagged (threshold = 5)

---

## Performance Considerations

**Zap Tracking:**
- 100 mutuals = 200 relay queries (100 × 2 directions)
- Batched: 10 mutuals at a time
- Total time: ~10-20 seconds
- Runs once per 24 hours (same as mutual check)

**Storage:**
- ~50 bytes per mutual
- 100 mutuals = ~5 KB
- Negligible storage impact

---

## Success Criteria

- [ ] Zap tracking works correctly
- [ ] Asymmetry detection accurate (no false positives)
- [ ] Filter works
- [ ] Tooltip displays helpful info
- [ ] Users find insights valuable
- [ ] Users take action (unfollow asymmetric relations)
- [ ] Timeline quality improves (user feedback)

---

## Why This Is "Fire" 🔥

**Unique Insight:** No other Nostr client does this.

**Emotional Impact:** Users experience "aha moment"
- "I've been supporting alice for months with no reciprocation"
- "This explains why my timeline feels one-sided"

**Actionable:** Immediate decision framework
- Keep following (value content regardless)
- Unfollow (free up attention for better connections)

**Social Dynamics:** Changes user behavior
- More intentional following
- Cleaner timelines
- Better signal-to-noise ratio
- Healthier social graph

---

## What's Next

**Phase 6:** Full strength scoring (all interaction types)

**Dependencies for Phase 6:**
- Phase 5 must be complete
- User validation that zap asymmetry is valuable
- Demand for deeper analytics

---

**Last Updated:** 2025-11-21
**Status:** Ready for Future Implementation
