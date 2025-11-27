/**
 * @orchestrator BookmarkOrchestrator
 * @purpose Manages bookmarks (kind:10003) with NIP-51 private bookmark support
 * @used-by NoteMenu, BookmarksTab
 *
 * REFACTORED: Now uses GenericListOrchestrator with config-driven approach
 */

import type { Event as NostrEvent } from '@nostr-dev-kit/ndk';
import type { BookmarkItem } from '../storage/BookmarkFileStorage';
import type { FetchFromRelaysResult } from '../sync/ListStorageAdapter';
import { GenericListOrchestrator } from './GenericListOrchestrator';
import { bookmarkListConfig, createBookmarkFileStorageWrapper } from './configs/BookmarkListConfig';
import { EventBus } from '../EventBus';

// Re-export BookmarkItem for external use
export type { BookmarkItem };

export interface BookmarkStatus {
  public: boolean;
  private: boolean;
}

export interface BookmarkWithMetadata {
  id: string;
  isPrivate: boolean;
}

export class BookmarkOrchestrator extends GenericListOrchestrator<BookmarkItem> {
  private static instance: BookmarkOrchestrator;
  private featureFlagKey = 'noornote_nip51_private_bookmarks_enabled';
  private migrationFlagKey = 'noornote_bookmarks_file_storage_migrated';

  private constructor() {
    super('BookmarkOrchestrator', bookmarkListConfig, createBookmarkFileStorageWrapper());
  }

  public static getInstance(): BookmarkOrchestrator {
    if (!BookmarkOrchestrator.instance) {
      BookmarkOrchestrator.instance = new BookmarkOrchestrator();
    }
    return BookmarkOrchestrator.instance;
  }

  // Required Orchestrator abstract methods
  public onui(data: any): void {}
  public onopen(relay: string): void {}
  public onmessage(relay: string, event: NostrEvent): void {}
  public onerror(relay: string, error: Error): void {}
  public onclose(relay: string): void {}

  /**
   * Check if NIP-51 private bookmarks feature is enabled
   */
  public isPrivateBookmarksEnabled(): boolean {
    try {
      const stored = localStorage.getItem(this.featureFlagKey);
      return stored === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Enable/disable NIP-51 private bookmarks feature
   */
  public setPrivateBookmarksEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(this.featureFlagKey, enabled.toString());
    } catch (error) {
      console.error('Failed to save NIP-51 private bookmarks flag:', error);
    }
  }

  /**
   * Check if migration to file storage is complete
   */
  private isMigrated(): boolean {
    try {
      const stored = localStorage.getItem(this.migrationFlagKey);
      return stored === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Mark migration as complete
   */
  private setMigrated(): void {
    try {
      localStorage.setItem(this.migrationFlagKey, 'true');
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to save migration flag: ${error}`);
    }
  }

  /**
   * Check if a note is bookmarked (public, private, or both)
   * Reads from browserItems (localStorage)
   */
  public async isBookmarked(noteId: string, pubkey: string): Promise<BookmarkStatus> {
    try {
      // Check if we've migrated to file storage
      const migrated = this.isMigrated();

      if (!migrated) {
        // MIGRATION: Fetch from relays one last time
        this.systemLogger.info('BookmarkOrchestrator', 'First run detected - migrating bookmarks from relay to file storage...');
        await this.migrateFromRelaysToFiles(pubkey);
        this.setMigrated();
      }

      // Read from browserItems (localStorage)
      const browserItems = this.getBrowserItems();
      const item = browserItems.find(b => b.id === noteId);

      if (!item) {
        return { public: false, private: false };
      }

      // Check isPrivate flag
      if (item.isPrivate) {
        return { public: false, private: true };
      } else {
        return { public: true, private: false };
      }
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to check bookmark status: ${error}`);
      return { public: false, private: false };
    }
  }

  /**
   * Add a bookmark (public or private)
   * Writes to browserItems (localStorage)
   */
  public async addBookmark(noteId: string, isPrivate: boolean): Promise<boolean> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      // Ensure migration is complete
      if (!this.isMigrated()) {
        await this.migrateFromRelaysToFiles(currentUser.pubkey);
        this.setMigrated();
      }

      // Read current browserItems
      const browserItems = this.getBrowserItems();

      // Check if already bookmarked
      if (browserItems.some(b => b.id === noteId)) {
        return true; // Already bookmarked
      }

      // Create bookmark item with isPrivate flag
      const item: BookmarkItem = {
        id: noteId,
        type: 'e',
        value: noteId,
        addedAt: Math.floor(Date.now() / 1000),
        isPrivate: isPrivate
      };

      // Add via parent class
      await this.addItem(item);

      this.systemLogger.info('BookmarkOrchestrator',
        `Added ${isPrivate ? 'private' : 'public'} bookmark (local): ${noteId}`
      );

      // Emit event
      this.eventBus.emit('bookmark:updated', {});

      return true;
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to add bookmark: ${error}`);
      throw error;
    }
  }

  /**
   * Remove a bookmark (public or private)
   * Writes to browserItems (localStorage)
   */
  public async removeBookmark(noteId: string, isPrivate: boolean): Promise<boolean> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      // Remove via parent class
      await this.removeItem(noteId);

      this.systemLogger.info('BookmarkOrchestrator',
        `Removed bookmark (local): ${noteId}`
      );

      // Emit event
      this.eventBus.emit('bookmark:updated', {});

      return true;
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to remove bookmark: ${error}`);
      throw error;
    }
  }

  /**
   * Get all bookmarks with their status (public/private/both)
   * Wrapper for GenericListOrchestrator.getAllItemsWithStatus()
   */
  public async getAllBookmarksWithStatus(): Promise<Map<string, { public: boolean; private: boolean }>> {
    try {
      const browserItems = this.getBrowserItems();
      const result = new Map<string, { public: boolean; private: boolean }>();

      browserItems.forEach(item => {
        if (item.isPrivate) {
          result.set(item.id, { public: false, private: true });
        } else {
          result.set(item.id, { public: true, private: false });
        }
      });

      return result;
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to get bookmarks with status: ${error}`);
      return new Map();
    }
  }

  /**
   * Get all bookmarks (merged public + private), sorted chronologically
   * Reads from browserItems (localStorage)
   */
  public async getAllBookmarks(pubkey: string): Promise<string[]> {
    try {
      // Check if we've migrated to file storage
      const migrated = this.isMigrated();

      if (!migrated) {
        // MIGRATION: Fetch from relays one last time
        this.systemLogger.info('BookmarkOrchestrator', 'First run detected - migrating bookmarks from relay to file storage...');
        await this.migrateFromRelaysToFiles(pubkey);
        this.setMigrated();
      }

      // Read from browserItems
      const browserItems = this.getBrowserItems();

      // If empty, try to load from files
      if (browserItems.length === 0) {
        const fileItems = await this.fileStorage.getAllItems();
        if (fileItems.length > 0) {
          this.setBrowserItems(fileItems);
          return fileItems.map(item => item.id);
        }
      }

      const bookmarkIds = browserItems.map(item => item.id);

      this.systemLogger.info('BookmarkOrchestrator',
        `Loaded ${bookmarkIds.length} bookmarks from browserItems`
      );

      return bookmarkIds;
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to fetch bookmarks: ${error}`);
      return [];
    }
  }

  /**
   * Get all bookmarks with metadata (public/private indicator)
   * Reads from browserItems (localStorage)
   */
  public async getAllBookmarksWithMetadata(pubkey: string): Promise<BookmarkWithMetadata[]> {
    try {
      // Check if we've migrated to file storage
      const migrated = this.isMigrated();

      if (!migrated) {
        // MIGRATION: Fetch from relays one last time
        this.systemLogger.info('BookmarkOrchestrator', 'First run detected - migrating bookmarks from relay to file storage...');
        await this.migrateFromRelaysToFiles(pubkey);
        this.setMigrated();
      }

      // Read from browserItems
      const browserItems = this.getBrowserItems();

      // If empty, try to load from files
      if (browserItems.length === 0) {
        const fileItems = await this.fileStorage.getAllItems();
        if (fileItems.length > 0) {
          this.setBrowserItems(fileItems);
          return fileItems.map(item => ({
            id: item.id,
            isPrivate: item.isPrivate || false
          }));
        }
      }

      const result = browserItems.map(item => ({
        id: item.id,
        isPrivate: item.isPrivate || false
      }));

      this.systemLogger.info('BookmarkOrchestrator',
        `Loaded ${result.length} bookmarks with metadata from browserItems`
      );

      return result;
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to fetch bookmarks: ${error}`);
      return [];
    }
  }

  /**
   * Fetch bookmarks from relays (read-only, no local changes)
   * Wrapper for GenericListOrchestrator.fetchFromRelays()
   */
  public async fetchBookmarksFromRelays(pubkey: string): Promise<FetchFromRelaysResult<BookmarkItem>> {
    return await this.fetchFromRelays(pubkey);
  }

  /**
   * Sync from relays (manual sync)
   * Wrapper for GenericListOrchestrator.syncFromRelays()
   */
  public async syncFromRelays(pubkey: string): Promise<{ added: number; total: number }> {
    return await super.syncFromRelays(pubkey);
  }

  /**
   * Migrate from relay-based to file-based storage
   * Fetches from relays, extracts all types (e/a/t/r), writes to files
   */
  private async migrateFromRelaysToFiles(pubkey: string): Promise<void> {
    const relays = this.getBootstrapRelays();
    this.systemLogger.info('BookmarkOrchestrator', `Migrating from relays (${relays.length} relays)...`);

    try {
      // Fetch both public and private bookmark events
      const [publicEvent, privateEvent] = await Promise.all([
        this.fetchPublicBookmarks(pubkey, relays),
        this.isPrivateBookmarksEnabled()
          ? this.fetchPrivateBookmarks(pubkey, relays)
          : Promise.resolve(null)
      ]);

      // Extract bookmarks with all types
      const publicItems = this.extractBookmarkItems(publicEvent, false);
      const privateItems = privateEvent
        ? await this.extractPrivateBookmarkItems(privateEvent, pubkey)
        : [];

      // Write to files
      await this.fileStorage.writePublic({
        items: publicItems,
        lastModified: Math.floor(Date.now() / 1000)
      });

      await this.fileStorage.writePrivate({
        items: privateItems,
        lastModified: Math.floor(Date.now() / 1000)
      });

      // Also set browserItems
      this.setBrowserItems([...publicItems, ...privateItems]);

      this.systemLogger.info('BookmarkOrchestrator',
        `Migration complete: ${publicItems.length} public, ${privateItems.length} private bookmarks written to files`
      );
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Migration failed: ${error}`);
      throw error;
    }
  }

  /**
   * Fetch public bookmarks (kind:10003 WITHOUT #d tag)
   */
  private async fetchPublicBookmarks(pubkey: string, relays: string[]): Promise<NostrEvent | null> {
    const events = await this.transport.fetch(relays, [{
      authors: [pubkey],
      kinds: [10003],
      limit: 10
    }], 5000);

    // Filter out events with #d tag (those are private bookmarks)
    const publicEvents = events.filter(event => {
      const hasDTag = event.tags.some(tag => tag[0] === 'd');
      return !hasDTag;
    });

    if (publicEvents.length > 0) {
      const mostRecent = publicEvents.sort((a, b) => b.created_at - a.created_at)[0];
      return mostRecent;
    }

    return null;
  }

  /**
   * Fetch private bookmarks (kind:30003 with #d tag)
   */
  private async fetchPrivateBookmarks(pubkey: string, relays: string[]): Promise<NostrEvent | null> {
    const events = await this.transport.fetch(relays, [{
      authors: [pubkey],
      kinds: [30003],
      '#d': ['private-bookmarks'],
      limit: 1
    }], 5000);

    if (events.length > 0) {
      return events[0];
    }

    return null;
  }

  /**
   * Extract bookmark items from public event tags
   * Supports all NIP-51 types: e (notes), a (articles), t (hashtags), r (URLs)
   */
  private extractBookmarkItems(event: NostrEvent | null, isPrivate: boolean): BookmarkItem[] {
    if (!event) return [];

    const items: BookmarkItem[] = [];

    // Extract 'e' tags (notes)
    event.tags
      .filter(tag => tag[0] === 'e' && tag[1])
      .forEach(tag => {
        items.push({
          id: tag[1],
          type: 'e',
          value: tag[1],
          addedAt: event.created_at,
          isPrivate
        });
      });

    // Extract 'a' tags (articles)
    event.tags
      .filter(tag => tag[0] === 'a' && tag[1])
      .forEach(tag => {
        items.push({
          id: tag[1],
          type: 'a',
          value: tag[1],
          addedAt: event.created_at,
          isPrivate
        });
      });

    // Extract 't' tags (hashtags)
    event.tags
      .filter(tag => tag[0] === 't' && tag[1])
      .forEach(tag => {
        items.push({
          id: tag[1],
          type: 't',
          value: tag[1],
          addedAt: event.created_at,
          isPrivate
        });
      });

    // Extract 'r' tags (URLs)
    event.tags
      .filter(tag => tag[0] === 'r' && tag[1])
      .forEach(tag => {
        items.push({
          id: tag[1],
          type: 'r',
          value: tag[1],
          addedAt: event.created_at,
          isPrivate
        });
      });

    return items;
  }

  /**
   * Extract private bookmark items (decrypt from content)
   */
  private async extractPrivateBookmarkItems(event: NostrEvent, pubkey: string): Promise<BookmarkItem[]> {
    if (!event.content || event.content.trim() === '') {
      return [];
    }

    try {
      // Use parent class decryption
      const decryptedItems = await this.decryptPrivateItems(event, pubkey);
      return decryptedItems;
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to decrypt private bookmarks: ${error}`);
      return [];
    }
  }
}
