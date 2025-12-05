# Mutual Check Feature - Roadmap

**Status:** Planned
**Total Effort:** 30-40 hours (all phases)
**Created:** 2025-11-21

---

## Vision

A comprehensive mutual relationship management system that helps users understand, track, and optimize their social connections on Nostr.

**Core Insight:** Following someone is an investment. This feature helps you understand if that investment is reciprocated and valued.

---

## Phases Overview

| Phase | Feature | Effort | Priority | Status |
|-------|---------|--------|----------|--------|
| **1** | Static Mutuals List | 4-6h | HIGH | Planned |
| **2** | Unfollow Detection | 2-3h | HIGH | Planned |
| **3** | New Mutual Detection | 1-2h | MEDIUM | Planned |
| **4** | Background Scheduler + Notifications | 4-5h | MEDIUM | Planned |
| **5** | Reciprocity Check (Zaps) | 3-4h | LOW | Future |
| **6** | Strength Scoring (Full) | 15-20h | LOW | Future |
| | **Total** | **30-40h** | | |

---

## Phase 1: Static Mutuals List (MVP)

**File:** `mutual-check-feature-01.md`

**Goal:** Show a simple list of all people I follow with their mutual status.

**Scope:**
- New tab: Lists → Mutuals
- For each following, check if they follow back
- Display badge: "✓ Mutual" or "Not following back"
- Stats: "Following: 150 | Mutuals: 87 (58%)"
- Unfollow button

**Why start here:**
- Simplest possible implementation
- Immediate value (users can see their mutuals)
- No background jobs, no notifications, no complexity
- Foundation for all future phases

**Dependencies:** None

**Effort:** 4-6 hours

---

## Phase 2: Unfollow Detection (Manual)

**File:** `mutual-check-feature-02.md`

**Goal:** Detect when someone stops following back.

**Scope:**
- Save snapshot of current mutuals (localStorage)
- Manual "Check for Changes" button
- Compare current vs. previous snapshot
- Show list of users who unfollowed since last check
- Highlight in Mutuals list: "⚠️ Recently unfollowed (2 days ago)"

**Why Phase 2:**
- Adds temporal dimension (tracking over time)
- Still manual (no automation complexity)
- Proves the core algorithm works
- Users can test on-demand

**Dependencies:** Phase 1 complete

**Effort:** 2-3 hours

---

## Phase 3: New Mutual Detection (Manual)

**File:** `mutual-check-feature-03.md`

**Goal:** Detect when someone starts following back (positive signal).

**Scope:**
- Extend snapshot comparison to detect new mutuals
- Show list of new mutuals since last check
- Highlight in Mutuals list: "✅ New mutual (1 day ago)"
- Positive messaging: "alice started following you back!"

**Why Phase 3:**
- Adds positive reinforcement (not just negative)
- Balances the feature (gains + losses)
- Still manual trigger
- Small incremental change on Phase 2

**Dependencies:** Phase 2 complete

**Effort:** 1-2 hours

---

## Phase 4: Background Scheduler + Notifications

**File:** `mutual-check-feature-04.md`

**Goal:** Automate checks and notify users of changes.

**Scope:**
- Background job runs once per 24 hours
- Automatic snapshot comparison
- Synthetic notifications (locally generated)
- Dual-indicator system:
  - Notification in NotificationView
  - Green dot in sidebar
- Integration with existing notification system

**Why Phase 4:**
- This is where the "magic" happens
- Users don't have to remember to check
- Notifications integrate seamlessly with Zaps/Replies
- Full automation unlocks real value

**Dependencies:** Phase 2 + 3 complete

**Effort:** 4-5 hours

---

## Phase 5: Reciprocity Check (Zaps Only)

**File:** `mutual-check-feature-05.md`

**Goal:** Identify asymmetric relationships (you zap them, they never zap back).

**Scope:**
- Track zaps given to each mutual
- Track zaps received from each mutual
- Calculate ratio: zapsGiven / zapsReceived
- Flag asymmetric relations (ratio > 5)
- Notification: "⚠️ You've zapped alice 15 times (45k sats) but never received a zap back"
- New filter: "Show asymmetric relations"

**Why Phase 5:**
- **This is the "Fire" feature** 🔥
- Simple to implement (only Zaps, not all interactions)
- Massive insight with minimal effort
- Quick win before full Strength Scoring

**Why Zaps only:**
- Zaps = real money = strongest signal
- Easier to track (Kind 9735 only)
- Clear asymmetry indicator
- Foundation for Phase 6

**Dependencies:** Phase 4 complete (needs background job for tracking)

**Effort:** 3-4 hours

---

## Phase 6: Strength Scoring (Full Analytics)

**File:** `mutual-check-feature-06.md`

**Goal:** Comprehensive relationship strength analysis based on all interactions.

**Scope:**
- Track all interaction types:
  - Zaps (given/received)
  - Replies (given/received)
  - Reactions (given/received)
  - Mentions
- Calculate strength score (0-100)
- Visual score display with bars
- Sort by strength
- Weekly summary: "This week: +3 strong mutuals, 5 weak connections"
- Export to CSV

**Why Phase 6:**
- Ultimate feature (full analytics)
- Complex but powerful
- Requires significant infrastructure
- Best saved for later after core features proven

**Why last:**
- High complexity (15-20h)
- Needs caching layer (IndexedDB)
- Performance challenges (many relay queries)
- Only valuable once base features are used

**Dependencies:** Phase 5 complete

**Effort:** 15-20 hours

---

## Decision Points

### After Phase 1 (MVP)
**Question:** Is the basic list useful? Do users engage with it?
- ✅ Yes → Continue to Phase 2
- ❌ No → Reconsider entire feature

### After Phase 3 (Detection)
**Question:** Do users check manually? Is it valuable?
- ✅ Yes → Automate with Phase 4
- ❌ No → Stop here, feature not sticky

### After Phase 4 (Automation)
**Question:** Are users engaging with notifications? Retention impact?
- ✅ Yes → Enhance with Phase 5 (Reciprocity)
- ❌ No → Iterate on notification UX

### After Phase 5 (Reciprocity)
**Question:** Do users want deeper analytics?
- ✅ Yes → Build Phase 6 (Strength Scoring)
- ❌ No → Stop here, feature is complete

---

## Implementation Order

### Recommended: Linear (1 → 2 → 3 → 4)

**Pros:**
- Each phase builds on previous
- Validate value at each step
- Can stop anytime if not valuable
- Clear progress milestones

**Cons:**
- Slower time-to-automation
- Phase 1 alone might not be sticky enough

### Alternative: Jump to Phase 4

**Pros:**
- Full feature immediately
- Maximum impact
- Users see automation from day 1

**Cons:**
- Higher risk (10-12h investment before validation)
- Harder to debug if something fails
- Miss opportunity to validate core value

**Recommendation:** Linear approach for new feature. Jump approach for proven concept.

---

## Technical Dependencies

### Phase 1-3: Minimal
- `MutualOrchestrator` (check mutual status)
- `MutualCheckStorage` (snapshot persistence)
- `MutualSidebarManager` (UI rendering)

### Phase 4: Moderate
- `MutualCheckScheduler` (background job)
- `SyntheticNotificationService` (notification generation)
- `NotificationsOrchestrator` integration
- `NotificationsView` rendering
- `MainLayout` green dot indicator

### Phase 5: Moderate+
- Zap tracking service
- Background data collection
- Cache layer (localStorage sufficient)

### Phase 6: High
- Full interaction tracking (Zaps, Replies, Reactions)
- IndexedDB cache layer
- Score calculation engine
- Incremental update system
- Export functionality

---

## User Journey

### Phase 1 (MVP)
```
User clicks "Lists → Mutuals"
  → Sees: "Following 150 | Mutuals 87 (58%)"
  → Scrolls list, sees badges
  → Unfollows 5 non-mutuals
  → Experience: Useful but static
```

### Phase 2-3 (Detection)
```
User clicks "Check for Changes" button
  → Sees: "2 users stopped following back"
  → Sees: "1 new mutual since last check"
  → Experience: Interesting, but manual
```

### Phase 4 (Automation)
```
User logs in next day
  → Sees notification: "alice and bob stopped following back"
  → Sees green dot on "Mutuals" tab
  → Clicks notification → Views details
  → Experience: Automated, no effort required
```

### Phase 5 (Reciprocity)
```
User opens Mutuals tab
  → Sees: "⚠️ 3 asymmetric relations detected"
  → Clicks filter: "Show asymmetric"
  → Sees: "alice - You zapped 15x (45k sats), received 0"
  → Decides to unfollow alice
  → Experience: Eye-opening, actionable
```

### Phase 6 (Analytics)
```
User opens Mutuals tab
  → Sees strength scores next to each mutual
  → Sorts by: "Weakest first"
  → Sees: "charlie - Score 12/100 (no interactions in 3 months)"
  → Bulk unfollows 10 weak connections
  → Timeline becomes more relevant
  → Experience: Data-driven curation
```

---

## Success Metrics

### Phase 1 (MVP)
- [ ] 50%+ of users visit Mutuals tab
- [ ] Average 5+ unfollows per session
- [ ] Users return to tab multiple times

### Phase 2-3 (Detection)
- [ ] Users click "Check for Changes" regularly
- [ ] Average 1+ check per week
- [ ] Users react to changes (unfollow non-mutuals)

### Phase 4 (Automation)
- [ ] Notification open rate > 40%
- [ ] Green dot clears within 24h (users engage)
- [ ] Daily active users increase 5%+

### Phase 5 (Reciprocity)
- [ ] 30%+ of users view asymmetric list
- [ ] Average 3+ unfollows from asymmetric relations
- [ ] Users report "valuable insight" in feedback

### Phase 6 (Analytics)
- [ ] 20%+ of users sort by strength score
- [ ] Weekly export usage > 10%
- [ ] Users cite "timeline quality improved"

---

## File Structure

```
docs/todos/
  mutual-check-roadmap.md                    (this file)
  mutual-check-feature-01-static-list.md     (Phase 1)
  mutual-check-feature-02-unfollow-detection.md (Phase 2)
  mutual-check-feature-03-new-mutual-detection.md (Phase 3)
  mutual-check-feature-04-automation.md      (Phase 4)
  mutual-check-feature-05-reciprocity.md     (Phase 5)
  mutual-check-feature-06-strength-scoring.md (Phase 6)
  mutual-check-feature.md                    (ARCHIVE - original monolithic doc)
```

---

## Next Steps

1. **Immediate:** Implement Phase 1 (Static Mutuals List)
2. **After validation:** Phase 2 + 3 (Detection)
3. **After usage proof:** Phase 4 (Automation)
4. **Future:** Phase 5 (Reciprocity) - **The Fire Feature** 🔥
5. **Long-term:** Phase 6 (Full Analytics)

---

**Last Updated:** 2025-11-21
**Maintainer:** Development Team
