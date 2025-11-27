/**
 * BookmarkListConfig - Configuration for bookmark list management
 * Used by BookmarkOrchestrator via GenericListOrchestrator
 */

import type { ListConfig, FileStorageWrapper } from '../../../types/ListConfig';
import type { BookmarkItem } from '../../storage/BookmarkFileStorage';
import { BookmarkFileStorage } from '../../storage/BookmarkFileStorage';

/**
 * File Storage Wrapper for Bookmarks
 */
class BookmarkFileStorageWrapper implements FileStorageWrapper<BookmarkItem> {
  private storage: BookmarkFileStorage;

  constructor() {
    this.storage = BookmarkFileStorage.getInstance();
  }

  async readPublic(): Promise<{ items: BookmarkItem[]; lastModified: number }> {
    return await this.storage.readPublic();
  }

  async writePublic(data: { items: BookmarkItem[]; lastModified: number }): Promise<void> {
    await this.storage.writePublic(data);
  }

  async readPrivate(): Promise<{ items: BookmarkItem[]; lastModified: number }> {
    return await this.storage.readPrivate();
  }

  async writePrivate(data: { items: BookmarkItem[]; lastModified: number }): Promise<void> {
    await this.storage.writePrivate(data);
  }

  async getAllItems(): Promise<BookmarkItem[]> {
    return await this.storage.getAllBookmarks();
  }
}

/**
 * Bookmark List Configuration
 */
export const bookmarkListConfig: ListConfig<BookmarkItem> = {
  // Identification
  name: 'bookmarks',
  browserStorageKey: 'noornote_bookmarks_browser',

  // Nostr Event (NIP-51: ONE event with public tags + encrypted private content)
  publicEventKind: 10003,       // kind:10003 (bookmarks)

  // Encryption
  encryptPrivateContent: true,  // Private bookmarks are encrypted in content

  // Item Operations
  getItemId: (item: BookmarkItem) => item.id,

  itemToTags: (item: BookmarkItem) => {
    return [[item.type, item.value]];
  },

  tagsToItem: (tags: string[][], timestamp: number): BookmarkItem[] => {
    // Extract all bookmark tags (e, a, t, r)
    const items: BookmarkItem[] = [];

    tags.forEach(tag => {
      if (tag[0] === 'e' && tag[1]) {
        items.push({
          id: tag[1],
          type: 'e',
          value: tag[1],
          addedAt: timestamp
        });
      } else if (tag[0] === 'a' && tag[1]) {
        items.push({
          id: tag[1],
          type: 'a',
          value: tag[1],
          addedAt: timestamp
        });
      } else if (tag[0] === 't' && tag[1]) {
        items.push({
          id: tag[1],
          type: 't',
          value: tag[1],
          addedAt: timestamp
        });
      } else if (tag[0] === 'r' && tag[1]) {
        items.push({
          id: tag[1],
          type: 'r',
          value: tag[1],
          addedAt: timestamp
        });
      }
    });

    return items;
  },

  // Custom decryption (bookmarks use simple ID array in encrypted content)
  decryptPrivateItems: async (content: string, pubkey: string): Promise<BookmarkItem[]> => {
    // Note: Encryption uses default (tags as JSON), but decryption expects ID array
    // This matches current BookmarkOrchestrator behavior
    try {
      const bookmarkIds = JSON.parse(content);
      if (!Array.isArray(bookmarkIds)) {
        return [];
      }
      return bookmarkIds.map(id => ({
        id,
        type: 'e' as const,
        value: id,
        addedAt: Math.floor(Date.now() / 1000)
      }));
    } catch {
      return [];
    }
  }
};

/**
 * Create File Storage Wrapper instance
 */
export function createBookmarkFileStorageWrapper(): FileStorageWrapper<BookmarkItem> {
  return new BookmarkFileStorageWrapper();
}
