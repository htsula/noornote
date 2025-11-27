/**
 * @abstract BaseListStorageAdapter
 * @purpose Base class for list storage adapters with common browser storage logic
 * @used-by MuteStorageAdapter, FollowStorageAdapter, BookmarkStorageAdapter
 *
 * Provides:
 * - Common browser storage (localStorage) read/write with deduplication
 * - Template methods for file and relay operations
 */

import type { ListStorageAdapter, FetchFromRelaysResult } from '../ListStorageAdapter';

export abstract class BaseListStorageAdapter<T> implements ListStorageAdapter<T> {
  /**
   * Get the localStorage key for this list type
   */
  protected abstract getBrowserStorageKey(): string;

  /**
   * Get the log prefix for error messages
   */
  protected abstract getLogPrefix(): string;

  /**
   * Get unique ID for an item (used for deduplication)
   */
  abstract getItemId(item: T): string;

  /**
   * Read items from file storage (implementation-specific)
   */
  abstract getFileItems(): Promise<T[]>;

  /**
   * Write items to file storage (implementation-specific)
   */
  abstract setFileItems(items: T[]): Promise<void>;

  /**
   * Fetch items from relays (implementation-specific)
   * Returns FetchFromRelaysResult with items AND relayContentWasEmpty flag
   * (used to handle mixed-client private item edge case - see LIST-MANAGEMENT-SPEC.md)
   */
  abstract fetchFromRelays(): Promise<FetchFromRelaysResult<T>>;

  /**
   * Publish items to relays (implementation-specific)
   */
  abstract publishToRelays(items: T[]): Promise<void>;

  /**
   * Browser Storage (Runtime) - Synchronous Read
   * Common implementation for all list types
   */
  getBrowserItems(): T[] {
    try {
      const stored = localStorage.getItem(this.getBrowserStorageKey());
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error(`[${this.getLogPrefix()}] Failed to read from browser storage:`, error);
      return [];
    }
  }

  /**
   * Browser Storage (Runtime) - Synchronous Write
   * Common implementation with deduplication
   */
  setBrowserItems(items: T[]): void {
    try {
      const uniqueItems = this.deduplicateItems(items);
      localStorage.setItem(this.getBrowserStorageKey(), JSON.stringify(uniqueItems));
    } catch (error) {
      console.error(`[${this.getLogPrefix()}] Failed to write to browser storage:`, error);
      throw error;
    }
  }

  /**
   * Deduplicate items by their unique ID
   * Common logic using getItemId() abstraction
   */
  protected deduplicateItems(items: T[]): T[] {
    const map = new Map<string, T>();
    items.forEach(item => map.set(this.getItemId(item), item));
    return Array.from(map.values());
  }

  /**
   * Helper: Get current timestamp for file metadata
   */
  protected getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }
}
