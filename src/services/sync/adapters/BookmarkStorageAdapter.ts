/**
 * @adapter BookmarkStorageAdapter
 * @purpose Storage adapter for bookmark lists (public + private merged)
 * @used-by ListSyncManager
 *
 * Storage Locations:
 * - Browser: localStorage key 'noornote_bookmarks_browser' (BookmarkItem[])
 * - File: ~/.noornote/bookmarks-public.json + bookmarks-private.json
 * - Relays: kind:10003 (public) + kind:30003 (private) events
 */

import { BaseListStorageAdapter } from './BaseListStorageAdapter';
import { BookmarkFileStorage, type BookmarkItem, type BookmarkFolder, type FolderAssignment, type RootOrderItem } from '../../storage/BookmarkFileStorage';
import type { FetchFromRelaysResult } from '../ListStorageAdapter';
import { BookmarkOrchestrator } from '../../orchestration/BookmarkOrchestrator';
import { AuthService } from '../../AuthService';

// localStorage keys for folder data (same as BookmarkFolderService)
const STORAGE_KEY_FOLDERS = 'noornote_bookmark_folders';
const STORAGE_KEY_ASSIGNMENTS = 'noornote_bookmark_folder_assignments';
const STORAGE_KEY_ROOT_ORDER = 'noornote_bookmark_root_order';

export class BookmarkStorageAdapter extends BaseListStorageAdapter<BookmarkItem> {
  private fileStorage: BookmarkFileStorage;
  private bookmarkOrchestrator: BookmarkOrchestrator;
  private authService: AuthService;

  constructor() {
    super();
    this.fileStorage = BookmarkFileStorage.getInstance();
    this.bookmarkOrchestrator = BookmarkOrchestrator.getInstance();
    this.authService = AuthService.getInstance();
  }

  protected getBrowserStorageKey(): string {
    return 'noornote_bookmarks_browser';
  }

  protected getLogPrefix(): string {
    return 'BookmarkStorageAdapter';
  }

  /**
   * Get unique ID for bookmark item (id field)
   */
  getItemId(item: BookmarkItem): string {
    return item.id;
  }

  /**
   * File Storage (Persistent Local) - Asynchronous
   * Reads both public + private, returns merged list
   */
  async getFileItems(): Promise<BookmarkItem[]> {
    try {
      const [publicData, privateData] = await Promise.all([
        this.fileStorage.readPublic(),
        this.fileStorage.readPrivate()
      ]);

      // Merge and deduplicate by id
      const bookmarkMap = new Map<string, BookmarkItem>();
      privateData.items.forEach(item => bookmarkMap.set(item.id, item));
      publicData.items.forEach(item => bookmarkMap.set(item.id, item)); // Public overwrites private

      return Array.from(bookmarkMap.values());
    } catch (error) {
      console.error('[BookmarkStorageAdapter] Failed to read from file storage:', error);
      throw error;
    }
  }

  /**
   * File Storage (Persistent Local) - Asynchronous
   * Writes items to files, overwriting existing data
   * Also saves folder structure from localStorage
   *
   * Strategy: Simply split by isPrivate flag and overwrite files
   * - isPrivate=true → private file
   * - isPrivate=false/undefined → public file (default)
   */
  async setFileItems(items: BookmarkItem[]): Promise<void> {
    try {
      // Split by privacy flag
      const publicItems = items.filter(item => !item.isPrivate);
      const privateItems = items.filter(item => item.isPrivate);

      const timestamp = this.getCurrentTimestamp();

      // Get folder data from localStorage
      const folders = this.getFoldersFromLocalStorage();
      const folderAssignments = this.getAssignmentsFromLocalStorage();
      const rootOrder = this.getRootOrderFromLocalStorage();

      // Overwrite files
      await this.fileStorage.writePublic({
        items: publicItems,
        lastModified: timestamp,
        folders,
        folderAssignments,
        rootOrder
      });

      await this.fileStorage.writePrivate({
        items: privateItems,
        lastModified: timestamp
      });
    } catch (error) {
      console.error('[BookmarkStorageAdapter] Failed to write to file storage:', error);
      throw error;
    }
  }

  /**
   * Restore folder data from file to localStorage
   */
  async restoreFolderDataFromFile(): Promise<void> {
    try {
      const publicData = await this.fileStorage.readPublic();

      if (publicData.folders) {
        localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(publicData.folders));
      }
      if (publicData.folderAssignments) {
        localStorage.setItem(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(publicData.folderAssignments));
      }
      if (publicData.rootOrder) {
        localStorage.setItem(STORAGE_KEY_ROOT_ORDER, JSON.stringify(publicData.rootOrder));
      }
    } catch (error) {
      console.error('[BookmarkStorageAdapter] Failed to restore folder data:', error);
    }
  }

  private getFoldersFromLocalStorage(): BookmarkFolder[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FOLDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private getAssignmentsFromLocalStorage(): FolderAssignment[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ASSIGNMENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private getRootOrderFromLocalStorage(): RootOrderItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ROOT_ORDER);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Relay Storage (Remote) - Asynchronous
   * Fetches kind:10003 event, returns merged bookmarks with metadata
   * Returns FetchFromRelaysResult to support mixed-client private item handling
   */
  async fetchFromRelays(): Promise<FetchFromRelaysResult<BookmarkItem>> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      return await this.bookmarkOrchestrator.fetchBookmarksFromRelays(currentUser.pubkey);
    } catch (error) {
      console.error('[BookmarkStorageAdapter] Failed to fetch from relays:', error);
      throw error;
    }
  }

  /**
   * Relay Storage (Remote) - Asynchronous
   * Publishes kind:10003 + kind:30003 events respecting isPrivate flag
   *
   * Strategy: Same as setFileItems - uses isPrivate flag from browser items,
   * falls back to existing file location for items without explicit flag.
   */
  async publishToRelays(items: BookmarkItem[]): Promise<void> {
    try {
      // First, save to files using the same logic as setFileItems
      await this.setFileItems(items);

      // Then publish via orchestrator (reads from files)
      await this.bookmarkOrchestrator.publishToRelays();
    } catch (error) {
      console.error('[BookmarkStorageAdapter] Failed to publish to relays:', error);
      throw error;
    }
  }
}
