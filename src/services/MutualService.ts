/**
 * MutualService
 * Checks mutual follow status for users the current user follows
 *
 * @purpose Determine which follows are mutual (they follow back)
 * @used-by MutualSecondaryManager
 *
 * NDK automatically caches Kind:3 events, so repeated checks are fast.
 * Follows are loaded from browserItems (localStorage).
 */

import { NostrTransport } from './transport/NostrTransport';
import { AuthService } from './AuthService';
import { RelayConfig } from './RelayConfig';
import { FollowStorageAdapter } from './sync/adapters/FollowStorageAdapter';
import type { FollowItem } from './orchestration/FollowListOrchestrator';

export interface MutualStatus {
  pubkey: string;
  isMutual: boolean;
}

export interface MutualItemWithStatus extends FollowItem {
  isMutual: boolean;
}

export interface MutualStats {
  totalFollowing: number;
  mutualCount: number;
  percentage: number;
}

export class MutualService {
  private static instance: MutualService;
  private transport: NostrTransport;
  private authService: AuthService;
  private relayConfig: RelayConfig;
  private followAdapter: FollowStorageAdapter;

  // In-memory cache for mutual status (cleared on logout)
  private mutualStatusCache: Map<string, boolean> = new Map();

  private constructor() {
    this.transport = NostrTransport.getInstance();
    this.authService = AuthService.getInstance();
    this.relayConfig = RelayConfig.getInstance();
    this.followAdapter = new FollowStorageAdapter();
  }

  public static getInstance(): MutualService {
    if (!MutualService.instance) {
      MutualService.instance = new MutualService();
    }
    return MutualService.instance;
  }

  /**
   * Get all follows (newest first) for mutual checking
   * Reads from browserItems (localStorage), falls back to files if empty
   */
  public async getFollowsForMutualCheck(): Promise<FollowItem[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return [];

    // Read from browserItems (localStorage)
    let browserItems = this.followAdapter.getBrowserItems();

    // If browserItems is empty, initialize from files (first load)
    if (browserItems.length === 0) {
      const fileItems = await this.followAdapter.getFileItems();
      if (fileItems.length > 0) {
        this.followAdapter.setBrowserItems(fileItems);
        browserItems = fileItems;
      }
    }

    // Reverse to get newest first (tag order in Kind 3 = chronological, oldest first)
    return [...browserItems].reverse();
  }

  /**
   * Check mutual status for a batch of pubkeys
   * Returns items with mutual status attached
   * Uses in-memory cache + NDK cache for speed
   */
  public async checkMutualStatusBatch(
    items: FollowItem[]
  ): Promise<MutualItemWithStatus[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return items.map(item => ({ ...item, isMutual: false }));

    const relays = this.relayConfig.getAggregatorRelays();

    // Check each item (in parallel, NDK handles caching)
    const results = await Promise.all(
      items.map(async (item) => {
        // Check in-memory cache first
        if (this.mutualStatusCache.has(item.pubkey)) {
          return {
            ...item,
            isMutual: this.mutualStatusCache.get(item.pubkey)!
          };
        }

        // Fetch from relays (NDK caches Kind:3 events)
        const isMutual = await this.checkIfMutual(item.pubkey, currentUser.pubkey, relays);

        // Store in in-memory cache
        this.mutualStatusCache.set(item.pubkey, isMutual);

        return { ...item, isMutual };
      })
    );

    return results;
  }

  /**
   * Get total stats (requires checking ALL follows)
   * Called once when opening the tab
   */
  public async getTotalStats(): Promise<MutualStats> {
    const follows = await this.getFollowsForMutualCheck();
    const totalFollowing = follows.length;

    // Count mutuals from cache (may be incomplete on first load)
    let mutualCount = 0;
    for (const follow of follows) {
      if (this.mutualStatusCache.get(follow.pubkey) === true) {
        mutualCount++;
      }
    }

    const percentage = totalFollowing > 0
      ? Math.round((mutualCount / totalFollowing) * 100)
      : 0;

    return { totalFollowing, mutualCount, percentage };
  }

  /**
   * Update stats after checking a batch
   */
  public calculateStatsFromCache(totalFollowing: number): MutualStats {
    let mutualCount = 0;
    for (const isMutual of this.mutualStatusCache.values()) {
      if (isMutual) mutualCount++;
    }

    const percentage = totalFollowing > 0
      ? Math.round((mutualCount / totalFollowing) * 100)
      : 0;

    return { totalFollowing, mutualCount, percentage };
  }

  /**
   * Check if a specific user follows back
   */
  private async checkIfMutual(
    userPubkey: string,
    currentUserPubkey: string,
    relays: string[]
  ): Promise<boolean> {
    try {
      // Fetch user's follow list (Kind 3) - NDK caches this
      const followList = await this.transport.fetch(relays, [{
        kinds: [3],
        authors: [userPubkey],
        limit: 1
      }], 5000);

      if (followList.length === 0) return false;

      // Check if current user is in their follow list
      const followsTags = followList[0].tags.filter(t => t[0] === 'p');
      return followsTags.some(t => t[1] === currentUserPubkey);
    } catch {
      return false;
    }
  }

  /**
   * Clear cache for a specific pubkey
   */
  public clearCacheForPubkey(pubkey: string): void {
    this.mutualStatusCache.delete(pubkey);
  }

  /**
   * Clear cache (call on logout)
   */
  public clearCache(): void {
    this.mutualStatusCache.clear();
  }
}
