/**
 * @orchestrator BookmarkOrchestrator
 * @purpose Manages bookmarks (kind:30003 Bookmark Sets) with NIP-51 category support
 * @used-by NoteMenu, BookmarksTab
 *
 * NIP-51 Bookmark Sets Architecture:
 * - Each category (folder) = one kind:30003 event with d-tag = category name
 * - Root bookmarks (no folder) = kind:30003 with d-tag = ""
 * - Private bookmarks = encrypted in content of respective category event
 */

import type { Event as NostrEvent } from '@nostr-dev-kit/ndk';
import type { BookmarkItem } from '../storage/BookmarkFileStorage';
import type { FetchFromRelaysResult } from '../sync/ListStorageAdapter';
import { GenericListOrchestrator } from './GenericListOrchestrator';
import { bookmarkListConfig, createBookmarkFileStorageWrapper } from './configs/BookmarkListConfig';
import { BookmarkFolderService } from '../BookmarkFolderService';

// Re-export BookmarkItem for external use
export type { BookmarkItem };

export interface BookmarkStatus {
  public: boolean;
  private: boolean;
}

export interface BookmarkWithMetadata {
  id: string;
  isPrivate: boolean;
  category?: string;  // d-tag value (folder name)
}

export class BookmarkOrchestrator extends GenericListOrchestrator<BookmarkItem> {
  private static instance: BookmarkOrchestrator;
  private featureFlagKey = 'noornote_nip51_private_bookmarks_enabled';
  private folderService: BookmarkFolderService;

  private constructor() {
    super('BookmarkOrchestrator', bookmarkListConfig, createBookmarkFileStorageWrapper());
    this.folderService = BookmarkFolderService.getInstance();
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
   * Check if a note is bookmarked (public, private, or both)
   * Reads from browserItems (localStorage)
   */
  public async isBookmarked(noteId: string, _pubkey: string): Promise<BookmarkStatus> {
    try {
      const browserItems = this.getBrowserItems();
      const item = browserItems.find(b => b.id === noteId);

      if (!item) {
        return { public: false, private: false };
      }

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
      const browserItems = this.getBrowserItems();

      if (browserItems.some(b => b.id === noteId)) {
        return true; // Already bookmarked
      }

      const item: BookmarkItem = {
        id: noteId,
        type: 'e',
        value: noteId,
        addedAt: Math.floor(Date.now() / 1000),
        isPrivate: isPrivate
      };

      await this.addItem(item);

      // Ensure folder assignment exists (root by default)
      this.folderService.ensureBookmarkAssignment(noteId);

      this.systemLogger.info('BookmarkOrchestrator',
        `Added ${isPrivate ? 'private' : 'public'} bookmark (local): ${noteId}`
      );

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
  public async removeBookmark(noteId: string, _isPrivate: boolean): Promise<boolean> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      await this.removeItem(noteId);

      // Remove folder assignment
      this.folderService.removeBookmarkAssignment(noteId);

      this.systemLogger.info('BookmarkOrchestrator', `Removed bookmark (local): ${noteId}`);

      this.eventBus.emit('bookmark:updated', {});
      return true;
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to remove bookmark: ${error}`);
      throw error;
    }
  }

  /**
   * Get all bookmarks with their status (public/private/both)
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
   */
  public async getAllBookmarksWithMetadata(pubkey: string): Promise<BookmarkWithMetadata[]> {
    try {
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

  // ===== NIP-51 Bookmark Sets: Multi-Category Publish/Fetch =====

  /**
   * Publish to relays (manual sync via UI button)
   * Creates one kind:30003 event per category (folder)
   *
   * NIP-51 Bookmark Sets:
   * - Root bookmarks → d: ""
   * - Category "Work" → d: "Work"
   * - Private bookmarks → encrypted in content
   */
  public async publishToRelays(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const writeRelays = this.transport.getWriteRelays();
    if (writeRelays.length === 0) {
      throw new Error('No write relays available');
    }

    // Read folder structure from file (authoritative source after "Save to file")
    const { BookmarkFileStorage } = await import('../storage/BookmarkFileStorage');
    const fileStorage = BookmarkFileStorage.getInstance();
    const publicData = await fileStorage.readPublic();
    const privateData = await fileStorage.readPrivate();

    // Merge all items
    const allItems = [...publicData.items, ...privateData.items];

    // Get folders and assignments from file
    const folders = publicData.folders || [];
    const folderAssignments = publicData.folderAssignments || [];

    this.systemLogger.info('BookmarkOrchestrator',
      `Publishing: ${allItems.length} items, ${folders.length} folders, ${folderAssignments.length} assignments`
    );

    // Group bookmarks by folder
    const bookmarksByFolder = new Map<string, BookmarkItem[]>();

    // Initialize with root and all folders
    bookmarksByFolder.set('', []); // Root
    folders.forEach(folder => bookmarksByFolder.set(folder.name, []));

    // Assign bookmarks to their folders using file-based assignments
    allItems.forEach(item => {
      const assignment = folderAssignments.find(a => a.bookmarkId === item.id);
      const folderId = assignment?.folderId || '';
      const folder = folders.find(f => f.id === folderId);
      const categoryName = folder?.name || ''; // Root if no folder

      const categoryItems = bookmarksByFolder.get(categoryName) || [];
      categoryItems.push(item);
      bookmarksByFolder.set(categoryName, categoryItems);
    });

    // Publish one event per category
    let totalPublished = 0;

    for (const [categoryName, items] of bookmarksByFolder) {
      // Skip empty categories (except root if it has items or we want to clear it)
      if (items.length === 0 && categoryName !== '') {
        continue;
      }

      const publicItems = items.filter(item => !item.isPrivate);
      const privateItems = items.filter(item => item.isPrivate);

      // Build tags
      const tags: string[][] = [['d', categoryName]];

      // Add public bookmark tags
      publicItems.forEach(item => {
        const itemTags = this.config.itemToTags(item);
        tags.push(...itemTags);
      });

      // Encrypt private items
      let encryptedContent = '';
      if (privateItems.length > 0) {
        encryptedContent = await this.encryptPrivateItems(privateItems, currentUser.pubkey);
      }

      const event = {
        kind: 30003,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: encryptedContent,
        pubkey: currentUser.pubkey
      };

      const signed = await this.authService.signEvent(event);
      if (!signed) {
        this.systemLogger.error('BookmarkOrchestrator', `Failed to sign event for category: ${categoryName}`);
        continue;
      }

      await this.transport.publish(writeRelays, signed);
      totalPublished++;

      this.systemLogger.info('BookmarkOrchestrator',
        `Published category "${categoryName || 'root'}": ${publicItems.length} public + ${privateItems.length} private`
      );
    }

    this.systemLogger.info('BookmarkOrchestrator',
      `Published ${totalPublished} bookmark set events to relays`
    );
  }

  /**
   * Fetch bookmarks from relays (read-only, no local changes)
   * Fetches ALL kind:30003 events for the user and extracts categories
   */
  public async fetchFromRelays(pubkey: string): Promise<FetchFromRelaysResult<BookmarkItem>> {
    const relays = this.getBootstrapRelays();

    try {
      // Fetch ALL kind:30003 events (all categories)
      const events = await this.transport.fetch(relays, [{
        authors: [pubkey],
        kinds: [30003],
        limit: 100  // Support up to 100 categories
      }], 10000);

      if (events.length === 0) {
        this.systemLogger.info('BookmarkOrchestrator', 'No bookmark sets found on relays');
        return { items: [], relayContentWasEmpty: true };
      }

      // Deduplicate by d-tag (keep newest per category)
      const eventsByDTag = new Map<string, NostrEvent>();
      events.forEach(event => {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1] || '';
        const existing = eventsByDTag.get(dTag);
        if (!existing || event.created_at > existing.created_at) {
          eventsByDTag.set(dTag, event);
        }
      });

      const allItems: BookmarkItem[] = [];
      let anyContentWasEmpty = true;

      for (const [categoryName, event] of eventsByDTag) {
        const hasContent = event.content && event.content.trim() !== '';
        if (hasContent) anyContentWasEmpty = false;

        // Extract public items from tags
        const publicItems = this.config.tagsToItem(
          event.tags.filter(t => t[0] !== 'd'), // Exclude d-tag
          event.created_at
        );
        publicItems.forEach(item => { item.isPrivate = false; });

        // Extract private items from encrypted content
        let privateItems: BookmarkItem[] = [];
        if (hasContent) {
          try {
            privateItems = await this.decryptPrivateItems(event, pubkey);
            privateItems.forEach(item => { item.isPrivate = true; });
          } catch (error) {
            this.systemLogger.error('BookmarkOrchestrator',
              `Failed to decrypt private items for category "${categoryName}": ${error}`
            );
          }
        }

        allItems.push(...publicItems, ...privateItems);

        this.systemLogger.info('BookmarkOrchestrator',
          `Fetched category "${categoryName || 'root'}": ${publicItems.length} public + ${privateItems.length} private`
        );
      }

      // Deduplicate by ID
      const itemMap = new Map<string, BookmarkItem>();
      allItems.forEach(item => itemMap.set(this.config.getItemId(item), item));

      return {
        items: Array.from(itemMap.values()),
        relayContentWasEmpty: anyContentWasEmpty
      };
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Failed to fetch from relays: ${error}`);
      return { items: [], relayContentWasEmpty: true };
    }
  }

  /**
   * Sync from relays (manual sync)
   * Fetches all categories and merges with local
   */
  public async syncFromRelays(pubkey: string): Promise<{ added: number; total: number }> {
    const relays = this.getBootstrapRelays();
    this.systemLogger.info('BookmarkOrchestrator', `Syncing from relays (${relays.length} relays)...`);

    try {
      const fetchResult = await this.fetchFromRelays(pubkey);
      const localItems = this.getBrowserItems();

      // Merge (union)
      const merged = this.mergeItems(localItems, fetchResult.items);
      const added = merged.length - localItems.length;

      this.setBrowserItems(merged);

      // Ensure folder assignments for all items
      merged.forEach(item => {
        this.folderService.ensureBookmarkAssignment(item.id);
      });

      this.systemLogger.info('BookmarkOrchestrator',
        `Sync complete: ${added} new items added (${merged.length} total)`
      );

      return { added, total: merged.length };
    } catch (error) {
      this.systemLogger.error('BookmarkOrchestrator', `Sync from relays failed: ${error}`);
      throw error;
    }
  }

  /**
   * Fetch bookmarks from relays (read-only wrapper)
   */
  public async fetchBookmarksFromRelays(pubkey: string): Promise<FetchFromRelaysResult<BookmarkItem>> {
    return await this.fetchFromRelays(pubkey);
  }
}
