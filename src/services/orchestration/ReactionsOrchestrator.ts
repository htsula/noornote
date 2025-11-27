/**
 * ReactionsOrchestrator - Interaction Stats Management
 * Handles reactions, reposts, replies, and zaps for notes
 *
 * @orchestrator ReactionsOrchestrator
 * @purpose Fetch and cache interaction stats for notes (ISL)
 * @used-by InteractionStatusLine (SNV live, Timeline cached)
 *
 * Architecture:
 * - Replaces InteractionStatsService
 * - Uses NostrTransport for all subscriptions
 * - Cache: 5min for Timeline, live for SNV
 * - Fetches reactions, reposts, replies, zaps in parallel
 */

import type { Event as NostrEvent, Filter as NostrFilter } from '@nostr-dev-kit/ndk';
import { Orchestrator } from './Orchestrator';
import { NostrTransport } from '../transport/NostrTransport';
import { SystemLogger } from '../../components/system/SystemLogger';
import { UserProfileService } from '../UserProfileService';

export interface InteractionStats {
  replies: number;
  reposts: number;
  quotedReposts: number;
  likes: number;
  zaps: number;
  lastUpdated: number;
}

export interface DetailedStats {
  replyEvents: NostrEvent[];
  repostEvents: NostrEvent[];
  quotedEvents: NostrEvent[];
  reactionEvents: NostrEvent[];
  zapEvents: NostrEvent[];
  lastUpdated: number;
}

export interface LiveReactionsOptions {
  interval?: number;  // Polling interval in ms (default: 30000 = 30s)
}

export class ReactionsOrchestrator extends Orchestrator {
  private static instance: ReactionsOrchestrator;
  private transport: NostrTransport;
  private systemLogger: SystemLogger;

  /** Single source of truth: Detailed stats cache (5min TTL) */
  private detailedStatsCache: Map<string, DetailedStats> = new Map();
  private fetchingDetailedStats: Map<string, Promise<DetailedStats>> = new Map();

  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  /** Fetch counter for logging (first = original note, others = replies) */
  private fetchCounter = 0;

  /** Author pubkey cache for Hollywood-style logging */
  private authorPubkeyCache: Map<string, string> = new Map();

  /** Live reactions polling tracking */
  private reactionIntervals: Map<string, number> = new Map(); // noteId → intervalId
  private lastReactionFetch: Map<string, number> = new Map(); // noteId → timestamp

  private constructor() {
    super('ReactionsOrchestrator');
    this.transport = NostrTransport.getInstance();
    this.systemLogger = SystemLogger.getInstance();
    this.systemLogger.info('ReactionsOrchestrator', 'Reactions Orchestrator at your service');
  }

  public static getInstance(): ReactionsOrchestrator {
    if (!ReactionsOrchestrator.instance) {
      ReactionsOrchestrator.instance = new ReactionsOrchestrator();
    }
    return ReactionsOrchestrator.instance;
  }

  /**
   * Get stats for a note (with caching)
   * @param noteId - The note ID to fetch stats for
   * @param authorPubkey - Optional author pubkey for Hollywood-style logging
   *
   * IMPLEMENTATION: Fetches DetailedStats and extracts counts
   * Single source of truth - no duplicate fetch logic
   */
  public async getStats(noteId: string, authorPubkey?: string): Promise<InteractionStats> {
    // Cache author pubkey for logging
    if (authorPubkey) {
      this.authorPubkeyCache.set(noteId, authorPubkey);
    }

    // Fetch detailed stats (uses cache if available)
    const detailedStats = await this.getDetailedStats(noteId);

    // Extract counts from detailed stats
    return {
      replies: detailedStats.replyEvents.length,
      reposts: detailedStats.repostEvents.length,
      quotedReposts: detailedStats.quotedEvents.length,
      likes: detailedStats.reactionEvents.length,
      zaps: this.calculateTotalZaps(detailedStats.zapEvents),
      lastUpdated: detailedStats.lastUpdated
    };
  }

  /**
   * Get cached stats for a note (without fetching)
   * Returns null if not in cache or expired
   * Used by Timeline to show previously-fetched stats from SNV
   */
  public getCachedStats(noteId: string): InteractionStats | null {
    const cached = this.detailedStatsCache.get(noteId);
    if (cached && Date.now() - cached.lastUpdated < this.cacheDuration) {
      this.systemLogger.info('ReactionsOrch', '💾 ISL stats loaded from Single Note View');
      return {
        replies: cached.replyEvents.length,
        reposts: cached.repostEvents.length,
        quotedReposts: cached.quotedEvents.length,
        likes: cached.reactionEvents.length,
        zaps: this.calculateTotalZaps(cached.zapEvents),
        lastUpdated: cached.lastUpdated
      };
    }
    return null;
  }

  /**
   * Get detailed stats for a note (with full event arrays)
   * Used by Analytics Modal to show detailed breakdowns
   */
  public async getDetailedStats(noteId: string): Promise<DetailedStats> {
    // Check cache first
    const cached = this.detailedStatsCache.get(noteId);
    if (cached && Date.now() - cached.lastUpdated < this.cacheDuration) {
      this.systemLogger.info('ReactionsOrch', '💾 Detailed stats loaded from cache');
      return cached;
    }

    // If already fetching, wait for that request
    if (this.fetchingDetailedStats.has(noteId)) {
      this.systemLogger.info('ReactionsOrch', '⏳ Detailed stats loading...');
      return await this.fetchingDetailedStats.get(noteId)!;
    }

    // Start new fetch
    const fetchPromise = this.fetchDetailedStatsFromRelays(noteId);
    this.fetchingDetailedStats.set(noteId, fetchPromise);

    try {
      const stats = await fetchPromise;
      this.detailedStatsCache.set(noteId, stats);
      return stats;
    } finally {
      this.fetchingDetailedStats.delete(noteId);
    }
  }

  /**
   * Reset fetch counter (called when entering SNV)
   */
  public resetFetchCounter(): void {
    this.fetchCounter = 0;
  }

  /**
   * Calculate total zaps in sats from zap events
   */
  private calculateTotalZaps(zapEvents: NostrEvent[]): number {
    let totalSats = 0;
    zapEvents.forEach(event => {
      const bolt11Tag = event.tags.find(tag => tag[0] === 'bolt11');
      if (bolt11Tag && bolt11Tag[1]) {
        totalSats += this.parseBolt11Amount(bolt11Tag[1]);
      }
    });
    return totalSats;
  }

  /**
   * Fetch detailed stats from relays (all types in parallel, full events)
   * SINGLE SOURCE OF TRUTH - both ISL and Analytics Modal use this
   */
  private async fetchDetailedStatsFromRelays(noteId: string): Promise<DetailedStats> {
    // Increment counter and determine context
    this.fetchCounter++;
    const isOriginalNote = this.fetchCounter === 1;

    // Build context message with username for original note
    let fetchingMessage: string;
    let readyMessage: string;

    if (isOriginalNote) {
      const authorPubkey = this.authorPubkeyCache.get(noteId);
      if (authorPubkey) {
        const profileService = UserProfileService.getInstance();
        const username = profileService.getUsername(authorPubkey);
        if (username) {
          const displayName = username.length > 10 ? username.substring(0, 10) + '..' : username;
          fetchingMessage = `📊 Fetching interaction stats from relays for ${displayName}'s note...`;
          readyMessage = `📊 Interaction stats ready for ${displayName}'s note`;
        } else {
          fetchingMessage = '📊 Fetching interaction stats from relays for this note...';
          readyMessage = '📊 Interaction stats ready for this note';
        }
      } else {
        fetchingMessage = '📊 Fetching interaction stats from relays for this note...';
        readyMessage = '📊 Interaction stats ready for this note';
      }
    } else {
      const replyNum = this.fetchCounter - 1;
      fetchingMessage = `📊 Fetching interaction stats from relays for reply #${replyNum}`;
      readyMessage = `Interaction stats for reply #${replyNum}: Loaded ✅`;
    }

    this.systemLogger.info('ReactionsOrch', fetchingMessage);

    const detailedStats: DetailedStats = {
      replyEvents: [],
      repostEvents: [],
      quotedEvents: [],
      reactionEvents: [],
      zapEvents: [],
      lastUpdated: Date.now()
    };

    // Fetch all interaction types in parallel
    const [reactions, reposts, replies, zaps] = await Promise.all([
      this.fetchReactionEvents(noteId),
      this.fetchRepostEvents(noteId),
      this.fetchReplyEvents(noteId),
      this.fetchZapEvents(noteId)
    ]);

    detailedStats.reactionEvents = reactions;
    detailedStats.repostEvents = reposts.regular;
    detailedStats.quotedEvents = reposts.quoted;
    detailedStats.replyEvents = replies;
    detailedStats.zapEvents = zaps;

    this.systemLogger.info('ReactionsOrch', readyMessage);

    return detailedStats;
  }


  /**
   * Parse amount from bolt11 invoice
   * Returns amount in sats (millisats / 1000)
   */
  private parseBolt11Amount(invoice: string): number {
    try {
      // Bolt11 format: lnbc[amount][multiplier]...
      // Example: lnbc1500n... = 1500 nano-bitcoin = 150 sats
      // Multipliers: m=milli, u=micro, n=nano, p=pico

      const match = invoice.match(/^ln(bc|tb)(\d+)([munp]?)/i);
      if (!match) return 0;

      const amount = parseInt(match[2]);
      const multiplier = match[3]?.toLowerCase();

      // Convert to millisats
      let millisats = 0;
      switch (multiplier) {
        case 'm': millisats = amount * 100_000_000; break; // milli-bitcoin
        case 'u': millisats = amount * 100_000; break;     // micro-bitcoin
        case 'n': millisats = amount * 100; break;         // nano-bitcoin
        case 'p': millisats = amount * 0.1; break;         // pico-bitcoin
        default: millisats = amount * 100_000_000_000; break; // bitcoin
      }

      // Convert to sats (millisats / 1000)
      return Math.floor(millisats / 1000);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Fetch reaction events (kind 7) - returns full events for Analytics Modal
   * Per NIP-25: ALL content values are valid (emojis, +, -, custom emoji)
   * Supports both e-tags (normal notes) and a-tags (addressable events)
   */
  private async fetchReactionEvents(noteId: string): Promise<NostrEvent[]> {
    return new Promise(async (resolve) => {
      const reactions: NostrEvent[] = [];
      const seenAuthors = new Set<string>();
      const relays = this.transport.getReadRelays();

      // Determine if this is an addressable event (a-tag) or regular event (e-tag)
      const isAddressable = noteId.includes(':'); // Format: "kind:pubkey:d-tag"
      const filters: NostrFilter[] = [{
        kinds: [7],
        ...(isAddressable ? { '#a': [noteId] } : { '#e': [noteId] })
      }];

      const sub = await this.transport.subscribe(relays, filters, {
        onEvent: (event: NostrEvent) => {
          // Only store one reaction per author (latest one)
          // Accept ALL reactions per NIP-25 (any emoji or content value)
          if (!seenAuthors.has(event.pubkey)) {
            reactions.push(event);
            seenAuthors.add(event.pubkey);
          }
        }
      });

      setTimeout(() => {
        sub.close();
        resolve(reactions);
      }, 3000);
    });
  }

  /**
   * Fetch repost events - returns separate arrays for regular/quoted
   * Regular reposts: kind:6 with #e or #a tag
   * Quoted reposts: kind:1 with #q tag
   * Supports both e-tags (normal notes) and a-tags (addressable events)
   */
  private async fetchRepostEvents(noteId: string): Promise<{ regular: NostrEvent[]; quoted: NostrEvent[] }> {
    return new Promise(async (resolve) => {
      const regular: NostrEvent[] = [];
      const quoted: NostrEvent[] = [];
      const regularAuthors = new Set<string>();
      const quotedAuthors = new Set<string>();
      const relays = this.transport.getReadRelays();

      // Determine if this is an addressable event (a-tag) or regular event (e-tag)
      const isAddressable = noteId.includes(':'); // Format: "kind:pubkey:d-tag"

      // Filter for regular reposts (kind:6)
      const regularFilter: NostrFilter = {
        kinds: [6],
        ...(isAddressable ? { '#a': [noteId] } : { '#e': [noteId] })
      };

      // Filter for quoted reposts (kind:1 with 'q' tag)
      // Note: Quoted reposts typically use q-tags for event IDs, not a-tags
      const quotedFilter: NostrFilter = {
        kinds: [1],
        '#q': [noteId]
      };

      const sub = await this.transport.subscribe(relays, [regularFilter, quotedFilter], {
        onEvent: (event: NostrEvent) => {
          if (event.kind === 6) {
            // Regular repost
            if (!regularAuthors.has(event.pubkey)) {
              regularAuthors.add(event.pubkey);
              regular.push(event);
            }
          } else if (event.kind === 1) {
            // Quoted repost (kind:1 with 'q' tag)
            if (!quotedAuthors.has(event.pubkey)) {
              quotedAuthors.add(event.pubkey);
              quoted.push(event);
            }
          }
        }
      });

      setTimeout(() => {
        sub.close();
        resolve({ regular, quoted });
      }, 3000);
    });
  }

  /**
   * Fetch reply events (kind 1) - returns full events for Analytics Modal
   * COUNTS ALL REPLIES including nested (replies to replies)
   * A reply references our note with ANY e-tag (root, reply, or mention) or a-tag
   * Supports both e-tags (normal notes) and a-tags (addressable events)
   */
  private async fetchReplyEvents(noteId: string): Promise<NostrEvent[]> {
    return new Promise(async (resolve) => {
      const replies: NostrEvent[] = [];
      const seenReplyIds = new Set<string>(); // Deduplicate by event ID
      const relays = this.transport.getReadRelays();

      // Determine if this is an addressable event (a-tag) or regular event (e-tag)
      const isAddressable = noteId.includes(':'); // Format: "kind:pubkey:d-tag"

      const filters: NostrFilter[] = [{
        kinds: [1],
        ...(isAddressable ? { '#a': [noteId] } : { '#e': [noteId] })
      }];

      const sub = await this.transport.subscribe(relays, filters, {
        onEvent: (event: NostrEvent) => {
          // ANY kind:1 that references our note via tag is a reply (direct or nested)
          if (!seenReplyIds.has(event.id)) {
            const tagType = isAddressable ? 'a' : 'e';
            const referencesNote = event.tags.some(tag => tag[0] === tagType && tag[1] === noteId);

            if (referencesNote) {
              replies.push(event);
              seenReplyIds.add(event.id);
            }
          }
        }
      });

      setTimeout(() => {
        sub.close();
        resolve(replies);
      }, 3000);
    });
  }

  /**
   * Fetch zap events (kind 9735) - returns full events for Analytics Modal
   * Supports both e-tags (normal notes) and a-tags (addressable events)
   */
  private async fetchZapEvents(noteId: string): Promise<NostrEvent[]> {
    return new Promise(async (resolve) => {
      const zaps: NostrEvent[] = [];
      const seenZapIds = new Set<string>(); // Deduplicate by event ID
      const relays = this.transport.getReadRelays();

      // Determine if this is an addressable event (a-tag) or regular event (e-tag)
      const isAddressable = noteId.includes(':'); // Format: "kind:pubkey:d-tag"

      const filters: NostrFilter[] = [{
        kinds: [9735],
        ...(isAddressable ? { '#a': [noteId] } : { '#e': [noteId] })
      }];

      const sub = await this.transport.subscribe(relays, filters, {
        onEvent: (event: NostrEvent) => {
          // Store all zap events with valid bolt11 tags (deduplicate by event ID)
          if (!seenZapIds.has(event.id)) {
            const bolt11Tag = event.tags.find(tag => tag[0] === 'bolt11');
            if (bolt11Tag && bolt11Tag[1]) {
              zaps.push(event);
              seenZapIds.add(event.id);
            }
          }
        }
      });

      setTimeout(() => {
        sub.close();
        resolve(zaps);
      }, 5000); // 5 seconds for zaps
    });
  }

  /**
   * Update cached stats for a note (used by SNV to correct reply count)
   * SNV counts all replies including nested, ReactionsOrchestrator only counts direct replies
   * NOTE: Only updates count-based fields, not the event arrays
   */
  public updateCachedStats(noteId: string, updates: Partial<InteractionStats>): void {
    const cached = this.detailedStatsCache.get(noteId);
    if (cached) {
      // Update lastUpdated timestamp when modifying stats
      cached.lastUpdated = Date.now();
      // NOTE: We don't modify event arrays - only the counts derived from getStats() will reflect updates
      this.detailedStatsCache.set(noteId, cached);
    }
  }

  /**
   * Clear cached stats for a note
   */
  public clearCache(noteId: string): void {
    this.detailedStatsCache.delete(noteId);
  }

  /**
   * Clear all cached stats
   */
  public clearAllCache(): void {
    this.detailedStatsCache.clear();
  }

  /**
   * Start live reactions polling for ISL
   * @param noteId - Note ID to watch for new reactions
   * @param callback - Called when reaction stats update
   * @param options - Polling configuration
   */
  public startLiveReactions(
    noteId: string,
    callback: (stats: InteractionStats) => void,
    options: LiveReactionsOptions = {}
  ): void {
    const interval = options.interval || 30000; // Default: 30s

    // Check if already polling
    if (this.reactionIntervals.has(noteId)) {
      this.systemLogger.warn('ReactionsOrchestrator', `Already polling reactions for ${noteId}`);
      return;
    }

    // Initialize timestamp
    this.lastReactionFetch.set(noteId, Math.floor(Date.now() / 1000));

    this.systemLogger.info(
      'ReactionsOrchestrator',
      `Live reactions started for ${noteId} (${interval}ms interval)`
    );

    // Start polling
    const intervalId = window.setInterval(async () => {
      await this.pollReactions(noteId, callback);
    }, interval);

    this.reactionIntervals.set(noteId, intervalId);
  }

  /**
   * Poll for new reactions since last fetch
   */
  private async pollReactions(noteId: string, callback: (stats: InteractionStats) => void): Promise<void> {
    const lastFetch = this.lastReactionFetch.get(noteId);
    if (!lastFetch) {
      this.systemLogger.warn('ReactionsOrchestrator', `No last fetch timestamp for ${noteId}`);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const relays = this.transport.getReadRelays();

    // Fetch new reactions (kind:7) since last poll
    const filters: NostrFilter[] = [{
      kinds: [7],
      '#e': [noteId],
      since: lastFetch,
      until: now
    }];

    try {
      const newReactions = await this.transport.fetch(relays, filters, 5000);

      if (newReactions.length > 0) {
        this.systemLogger.info(
          'ReactionsOrchestrator',
          `Polled ${newReactions.length} new reactions for ${noteId}`
        );

        // Update cache with new reactions
        const cached = this.detailedStatsCache.get(noteId);
        if (cached) {
          // Deduplicate new reactions by author (one reaction per author)
          const seenAuthors = new Set(cached.reactionEvents.map(e => e.pubkey));
          newReactions.forEach(event => {
            if (!seenAuthors.has(event.pubkey)) {
              cached.reactionEvents.push(event);
              seenAuthors.add(event.pubkey);
            }
          });

          cached.lastUpdated = Date.now();

          // Calculate updated stats and notify callback
          const stats: InteractionStats = {
            replies: cached.replyEvents.length,
            reposts: cached.repostEvents.length,
            quotedReposts: cached.quotedEvents.length,
            likes: cached.reactionEvents.length,
            zaps: this.calculateTotalZaps(cached.zapEvents),
            lastUpdated: cached.lastUpdated
          };

          callback(stats);
        }
      }

      // Update timestamp
      this.lastReactionFetch.set(noteId, now);
    } catch (error) {
      this.systemLogger.error('ReactionsOrchestrator', `Polling failed: ${error}`);
    }
  }

  /**
   * Stop live reactions polling
   * @param noteId - Note ID to stop watching
   */
  public stopLiveReactions(noteId: string): void {
    const intervalId = this.reactionIntervals.get(noteId);
    if (!intervalId) {
      this.systemLogger.warn('ReactionsOrchestrator', `No polling interval found for ${noteId}`);
      return;
    }

    clearInterval(intervalId);
    this.reactionIntervals.delete(noteId);
    this.lastReactionFetch.delete(noteId);

    this.systemLogger.info('ReactionsOrchestrator', `Live reactions stopped for ${noteId}`);
  }

  // Orchestrator interface implementations (unused for now, required by base class)

  public onui(data: any): void {
    // Handle UI actions (future: real-time subscriptions)
  }

  public onopen(relay: string): void {
    // Silent operation
  }

  public onmessage(relay: string, event: NostrEvent): void {
    // Handle incoming events from subscriptions (future: live updates)
  }

  public onerror(relay: string, error: Error): void {
    this.systemLogger.error('ReactionsOrchestrator', `Relay error (${relay}): ${error.message}`);
  }

  public onclose(relay: string): void {
    // Silent operation
  }

  public override destroy(): void {
    // Stop all polling intervals before cleanup
    this.reactionIntervals.forEach((intervalId, noteId) => {
      clearInterval(intervalId);
      this.systemLogger.info('ReactionsOrchestrator', `Stopped polling for ${noteId}`);
    });
    this.reactionIntervals.clear();
    this.lastReactionFetch.clear();

    this.detailedStatsCache.clear();
    this.fetchingDetailedStats.clear();
    super.destroy();
    this.systemLogger.info('ReactionsOrchestrator', 'Destroyed');
  }
}
