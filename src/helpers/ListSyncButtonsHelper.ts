/**
 * ListSyncButtonsHelper
 * Renders sync control buttons for list views (Follows, Bookmarks, Mutes)
 *
 * @purpose Centralized rendering of sync buttons based on sync mode
 * @used-by BaseListSecondaryManager, BookmarkSecondaryManager
 */

import { EventBus } from '../services/EventBus';

export type ListSyncMode = 'manual' | 'easy';

const STORAGE_KEY = 'noornote_list_sync_mode';
const MODE_CHANGED_EVENT = 'list-sync-mode:changed';

/**
 * Get current sync mode from localStorage
 */
export function getListSyncMode(): ListSyncMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'manual') return 'manual';
  return 'easy'; // default for new users
}

/**
 * Set sync mode in localStorage and emit change event
 */
export function setListSyncMode(mode: ListSyncMode): void {
  const previousMode = getListSyncMode();
  localStorage.setItem(STORAGE_KEY, mode);

  if (previousMode !== mode) {
    EventBus.getInstance().emit(MODE_CHANGED_EVENT, { mode });
  }
}

/**
 * Check if Easy Mode is enabled
 */
export function isEasyMode(): boolean {
  return getListSyncMode() === 'easy';
}

/**
 * Render sync control buttons based on current mode
 *
 * Manual Mode: 4 buttons (Sync from Relays, Sync to Relays, Save to File, Restore from File)
 * Easy Mode: 1 button (Save to File - manual backup option)
 */
export function renderListSyncButtons(): string {
  const mode = getListSyncMode();

  if (mode === 'easy') {
    return `
      <div class="list-sync-controls list-sync-controls--easy">
        <button class="btn btn--mini btn--passive save-to-file-btn">
          Save to File
        </button>
      </div>
      <p class="list-sync-info list-sync-info--easy">
        Easy Mode: Changes are automatically synced to your local backup and relays.
      </p>
    `;
  }

  // Manual Mode (default)
  return `
    <div class="list-sync-controls">
      <button class="btn btn--mini btn--passive sync-from-relays-btn">
        Sync from Relays
      </button>
      <button class="btn btn--mini btn--passive sync-to-relays-btn">
        Sync to Relays
      </button>
      <button class="btn btn--mini btn--passive save-to-file-btn">
        Save to File
      </button>
      <button class="btn btn--mini btn--passive restore-from-file-btn">
        Restore from File
      </button>
    </div>
    <p class="list-sync-info">
      This list is stored in 3 places: on your hard drive - in the NoorNote app - on the relays. You can use the buttons up there to control how the list stays synced across those three.
    </p>
  `;
}
