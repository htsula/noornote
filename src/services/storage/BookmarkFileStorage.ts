/**
 * BookmarkFileStorage
 * File-based storage for bookmark lists using Tauri FS API
 *
 * Stores bookmark lists in 2 separate local JSON files:
 * - ~/.noornote/bookmarks-public.json
 * - ~/.noornote/bookmarks-private.json
 * - Supports all NIP-51 bookmark types (notes, articles, hashtags, URLs)
 * - Accessible even when app is not running
 * - Can be manually edited/backed up
 * - Single source of truth for bookmarks
 */

import { BaseFileStorage, type BaseFileData } from './BaseFileStorage';

/**
 * Bookmark item with NIP-51 type support
 */
export interface BookmarkItem {
  id: string;                        // Event ID or identifier
  type: 'e' | 'a' | 't' | 'r';      // NIP-51: event, article, hashtag, url
  value: string;                     // Full identifier (for 'a' tags: kind:pubkey:d-tag)
  addedAt?: number;                  // Timestamp when added (chronological order)
  isPrivate?: boolean;               // True if private bookmark (stored in browser, used by "Save to File")
}

/**
 * Folder definition (NoorNote-specific UI feature)
 */
export interface BookmarkFolder {
  id: string;
  name: string;
  createdAt: number;
  order: number;
}

/**
 * Bookmark-to-folder assignment
 */
export interface FolderAssignment {
  bookmarkId: string;
  folderId: string;  // '' = root
  order: number;
}

/**
 * Root order item (mixed folders and bookmarks)
 */
export interface RootOrderItem {
  type: 'folder' | 'bookmark';
  id: string;
}

export interface BookmarkListData extends BaseFileData {
  items: BookmarkItem[];
  // NoorNote-specific folder UI data (not NIP-51, local feature)
  folders?: BookmarkFolder[];
  folderAssignments?: FolderAssignment[];
  rootOrder?: RootOrderItem[];
}

/**
 * Public bookmark list storage
 */
class PublicBookmarkStorage extends BaseFileStorage<BookmarkListData> {
  protected getFileName(): string {
    return 'bookmarks-public.json';
  }

  protected getDefaultData(): BookmarkListData {
    return {
      items: [],
      lastModified: Math.floor(Date.now() / 1000)
    };
  }

  protected getLoggerName(): string {
    return 'PublicBookmarkStorage';
  }
}

/**
 * Private bookmark list storage
 */
class PrivateBookmarkStorage extends BaseFileStorage<BookmarkListData> {
  protected getFileName(): string {
    return 'bookmarks-private.json';
  }

  protected getDefaultData(): BookmarkListData {
    return {
      items: [],
      lastModified: Math.floor(Date.now() / 1000)
    };
  }

  protected getLoggerName(): string {
    return 'PrivateBookmarkStorage';
  }
}

/**
 * BookmarkFileStorage - Facade for managing both public and private bookmark lists
 */
export class BookmarkFileStorage {
  private static instance: BookmarkFileStorage;
  private publicStorage: PublicBookmarkStorage;
  private privateStorage: PrivateBookmarkStorage;

  private constructor() {
    this.publicStorage = new PublicBookmarkStorage();
    this.privateStorage = new PrivateBookmarkStorage();
  }

  public static getInstance(): BookmarkFileStorage {
    if (!BookmarkFileStorage.instance) {
      BookmarkFileStorage.instance = new BookmarkFileStorage();
    }
    return BookmarkFileStorage.instance;
  }

  /**
   * Initialize both file storages (must be called before any file operations)
   */
  public async initialize(): Promise<void> {
    await Promise.all([
      this.publicStorage.initialize(),
      this.privateStorage.initialize()
    ]);
  }

  /**
   * Read public bookmark list
   */
  public async readPublic(): Promise<BookmarkListData> {
    return await this.publicStorage.read();
  }

  /**
   * Read private bookmark list
   */
  public async readPrivate(): Promise<BookmarkListData> {
    return await this.privateStorage.read();
  }

  /**
   * Write public bookmark list
   */
  public async writePublic(data: BookmarkListData): Promise<void> {
    await this.publicStorage.write(data);
  }

  /**
   * Write private bookmark list
   */
  public async writePrivate(data: BookmarkListData): Promise<void> {
    await this.privateStorage.write(data);
  }

  /**
   * Add public bookmark
   */
  public async addPublicBookmark(item: BookmarkItem): Promise<void> {
    const data = await this.readPublic();

    // Check if already bookmarked
    if (!data.items.some(b => b.id === item.id)) {
      item.addedAt = Math.floor(Date.now() / 1000);
      data.items.push(item);
      await this.writePublic(data);
    }
  }

  /**
   * Add private bookmark
   */
  public async addPrivateBookmark(item: BookmarkItem): Promise<void> {
    const data = await this.readPrivate();

    // Check if already bookmarked
    if (!data.items.some(b => b.id === item.id)) {
      item.addedAt = Math.floor(Date.now() / 1000);
      data.items.push(item);
      await this.writePrivate(data);
    }
  }

  /**
   * Remove bookmark from both lists
   */
  public async removeBookmark(id: string): Promise<void> {
    const publicData = await this.readPublic();
    const privateData = await this.readPrivate();

    publicData.items = publicData.items.filter(b => b.id !== id);
    privateData.items = privateData.items.filter(b => b.id !== id);

    await this.writePublic(publicData);
    await this.writePrivate(privateData);
  }

  /**
   * Get all bookmarks (merged public + private, deduplicated)
   * Preserves chronological order (newest first)
   */
  public async getAllBookmarks(): Promise<BookmarkItem[]> {
    const publicData = await this.readPublic();
    const privateData = await this.readPrivate();

    const bookmarkMap = new Map<string, BookmarkItem>();

    // Add public bookmarks
    publicData.items.forEach(item => bookmarkMap.set(item.id, item));

    // Add private bookmarks (deduplicate)
    privateData.items.forEach(item => bookmarkMap.set(item.id, item));

    // Return sorted by addedAt (newest first)
    return Array.from(bookmarkMap.values()).sort((a, b) => {
      const timeA = a.addedAt || 0;
      const timeB = b.addedAt || 0;
      return timeB - timeA; // Descending order
    });
  }

  /**
   * Get all bookmarks with metadata (public/private indicator)
   */
  public async getAllBookmarksWithMetadata(): Promise<Array<BookmarkItem & { isPrivate: boolean }>> {
    const publicData = await this.readPublic();
    const privateData = await this.readPrivate();

    const bookmarkMap = new Map<string, BookmarkItem & { isPrivate: boolean }>();

    // Add public bookmarks
    publicData.items.forEach(item => {
      bookmarkMap.set(item.id, { ...item, isPrivate: false });
    });

    // Add private bookmarks (mark as private, prefer private if exists in both)
    privateData.items.forEach(item => {
      bookmarkMap.set(item.id, { ...item, isPrivate: true });
    });

    // Return sorted by addedAt (newest first)
    return Array.from(bookmarkMap.values()).sort((a, b) => {
      const timeA = a.addedAt || 0;
      const timeB = b.addedAt || 0;
      return timeB - timeA; // Descending order
    });
  }

  /**
   * Check if item is bookmarked
   */
  public async isBookmarked(id: string): Promise<{ public: boolean; private: boolean }> {
    const publicData = await this.readPublic();
    const privateData = await this.readPrivate();

    return {
      public: publicData.items.some(b => b.id === id),
      private: privateData.items.some(b => b.id === id)
    };
  }

  /**
   * Get file paths (for debugging/manual access)
   */
  public getFilePaths(): { public: string | null; private: string | null } {
    return {
      public: this.publicStorage.getFilePath(),
      private: this.privateStorage.getFilePath()
    };
  }
}
