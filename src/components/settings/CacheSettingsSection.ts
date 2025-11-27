/**
 * CacheSettingsSection Component
 * Manages NDK cache configuration and clearing
 *
 * @purpose Configure NDK cache sizes and clear cache tables
 * @used-by SettingsView
 */

import { SettingsSection } from './SettingsSection';
import { ToastService } from '../../services/ToastService';
import { ErrorService } from '../../services/ErrorService';
import { ModalService } from '../../services/ModalService';

interface NDKCacheConfig {
  profileCacheSize: number;
  zapperCacheSize: number;
  nip05CacheSize: number;
  eventCacheSize: number;
  eventTagsCacheSize: number;
  saveSig: boolean;
}

const DEFAULT_CONFIG: NDKCacheConfig = {
  profileCacheSize: 100000,
  zapperCacheSize: 200,
  nip05CacheSize: 1000,
  eventCacheSize: 50000,
  eventTagsCacheSize: 100000,
  saveSig: false
};

const STORAGE_KEY = 'ndk_cache_config';

export class CacheSettingsSection extends SettingsSection {
  private toastService: ToastService;
  private errorService: ErrorService;
  private modalService: ModalService;

  constructor() {
    super('cache-settings');
    this.toastService = ToastService.getInstance();
    this.errorService = ErrorService.getInstance();
    this.modalService = ModalService.getInstance();
  }

  /**
   * Get current cache configuration from localStorage
   */
  private getConfig(): NDKCacheConfig {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CONFIG;

    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save cache configuration to localStorage
   */
  private saveConfig(config: NDKCacheConfig): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  /**
   * Mount section content into the DOM
   */
  public mount(parentContainer: HTMLElement): void {
    const contentContainer = this.getContentContainer(parentContainer);
    if (!contentContainer) return;

    const config = this.getConfig();
    contentContainer.innerHTML = this.renderContent(config);
    this.bindListeners(contentContainer);
  }

  /**
   * Render cache settings content
   */
  private renderContent(config: NDKCacheConfig): string {
    return `
      <div class="cache-settings">
        <h3>NDK Cache Configuration</h3>
        <p class="section-help">Configure NDK cache sizes. Changes require app reload to take effect.</p>

        <div class="setting-item">
          <label for="profile-cache-size" class="setting-item-label">
            <span class="setting-label">Profile Cache Size</span>
            <span class="setting-help">Maximum number of user profiles to keep in memory</span>
          </label>
          <input
            type="number"
            id="profile-cache-size"
            class="setting-input"
            value="${config.profileCacheSize}"
            min="1000"
            max="500000"
            step="1000"
          />
        </div>

        <div class="setting-item">
          <label for="event-cache-size" class="setting-item-label">
            <span class="setting-label">Event Cache Size</span>
            <span class="setting-help">Maximum number of events to keep in memory</span>
          </label>
          <input
            type="number"
            id="event-cache-size"
            class="setting-input"
            value="${config.eventCacheSize}"
            min="1000"
            max="200000"
            step="1000"
          />
        </div>

        <div class="setting-item">
          <label for="event-tags-cache-size" class="setting-item-label">
            <span class="setting-label">Event Tags Cache Size</span>
            <span class="setting-help">Maximum number of event tag indexes to keep in memory</span>
          </label>
          <input
            type="number"
            id="event-tags-cache-size"
            class="setting-input"
            value="${config.eventTagsCacheSize}"
            min="1000"
            max="500000"
            step="1000"
          />
        </div>

        <div class="setting-item">
          <label for="zapper-cache-size" class="setting-item-label">
            <span class="setting-label">Zapper Cache Size</span>
            <span class="setting-help">Maximum number of Lightning addresses to keep cached</span>
          </label>
          <input
            type="number"
            id="zapper-cache-size"
            class="setting-input"
            value="${config.zapperCacheSize}"
            min="50"
            max="5000"
            step="50"
          />
        </div>

        <div class="setting-item">
          <label for="nip05-cache-size" class="setting-item-label">
            <span class="setting-label">NIP-05 Cache Size</span>
            <span class="setting-help">Maximum number of NIP-05 verifications to keep cached</span>
          </label>
          <input
            type="number"
            id="nip05-cache-size"
            class="setting-input"
            value="${config.nip05CacheSize}"
            min="100"
            max="10000"
            step="100"
          />
        </div>

        <div class="setting-item">
          <label class="setting-item-label setting-item-label--checkbox">
            <input
              type="checkbox"
              id="save-sig"
              class="setting-checkbox"
              ${config.saveSig ? 'checked' : ''}
            />
            <span class="setting-label">Save Event Signatures</span>
            <span class="setting-help">Store event signatures in cache (increases storage usage)</span>
          </label>
        </div>

        <button class="btn btn--medium" id="save-cache-config-btn">Save Configuration</button>
        <div id="cache-config-message" class="save-message"></div>

        <hr class="settings-divider" />

        <h3>Clear Cache Data</h3>
        <p class="section-help">Select which cache tables to clear. This action cannot be undone.</p>

        <div class="cache-tables-group">
          <label class="cache-table-item">
            <input type="checkbox" class="cache-table-checkbox" value="events" />
            <span class="cache-table-label">Events</span>
          </label>
          <label class="cache-table-item">
            <input type="checkbox" class="cache-table-checkbox" value="profiles" />
            <span class="cache-table-label">Profiles</span>
          </label>
          <label class="cache-table-item">
            <input type="checkbox" class="cache-table-checkbox" value="eventTags" />
            <span class="cache-table-label">Event Tags</span>
          </label>
          <label class="cache-table-item">
            <input type="checkbox" class="cache-table-checkbox" value="nip05" />
            <span class="cache-table-label">NIP-05</span>
          </label>
          <label class="cache-table-item">
            <input type="checkbox" class="cache-table-checkbox" value="lnurl" />
            <span class="cache-table-label">Lightning Addresses</span>
          </label>
          <label class="cache-table-item">
            <input type="checkbox" class="cache-table-checkbox" value="relayStatus" />
            <span class="cache-table-label">Relay Status</span>
          </label>
        </div>

        <div class="cache-clear-buttons">
          <button class="btn btn--medium btn--danger" id="clear-selected-btn">Clear Selected</button>
          <button class="btn btn--medium btn--danger" id="clear-all-btn">Clear All & Reload</button>
        </div>
      </div>
    `;
  }

  /**
   * Bind event listeners
   */
  private bindListeners(contentContainer: HTMLElement): void {
    // Save configuration button
    const saveBtn = contentContainer.querySelector('#save-cache-config-btn');
    saveBtn?.addEventListener('click', () => this.handleSaveConfig(contentContainer));

    // Clear selected tables button
    const clearSelectedBtn = contentContainer.querySelector('#clear-selected-btn');
    clearSelectedBtn?.addEventListener('click', () => this.handleClearSelected(contentContainer));

    // Clear all button
    const clearAllBtn = contentContainer.querySelector('#clear-all-btn');
    clearAllBtn?.addEventListener('click', () => this.handleClearAll());
  }

  /**
   * Handle save configuration
   */
  private handleSaveConfig(contentContainer: HTMLElement): void {
    const profileCacheSize = parseInt(
      (contentContainer.querySelector('#profile-cache-size') as HTMLInputElement).value,
      10
    );
    const eventCacheSize = parseInt(
      (contentContainer.querySelector('#event-cache-size') as HTMLInputElement).value,
      10
    );
    const eventTagsCacheSize = parseInt(
      (contentContainer.querySelector('#event-tags-cache-size') as HTMLInputElement).value,
      10
    );
    const zapperCacheSize = parseInt(
      (contentContainer.querySelector('#zapper-cache-size') as HTMLInputElement).value,
      10
    );
    const nip05CacheSize = parseInt(
      (contentContainer.querySelector('#nip05-cache-size') as HTMLInputElement).value,
      10
    );
    const saveSig = (contentContainer.querySelector('#save-sig') as HTMLInputElement).checked;

    // Validation
    if (
      isNaN(profileCacheSize) || profileCacheSize < 1000 ||
      isNaN(eventCacheSize) || eventCacheSize < 1000 ||
      isNaN(eventTagsCacheSize) || eventTagsCacheSize < 1000 ||
      isNaN(zapperCacheSize) || zapperCacheSize < 50 ||
      isNaN(nip05CacheSize) || nip05CacheSize < 100
    ) {
      this.showMessage(contentContainer, 'Invalid cache size values', 'error');
      return;
    }

    const config: NDKCacheConfig = {
      profileCacheSize,
      eventCacheSize,
      eventTagsCacheSize,
      zapperCacheSize,
      nip05CacheSize,
      saveSig
    };

    this.saveConfig(config);
    this.showMessage(
      contentContainer,
      'Configuration saved! Reload the app for changes to take effect.',
      'success'
    );
  }

  /**
   * Handle clear selected tables
   */
  private async handleClearSelected(contentContainer: HTMLElement): Promise<void> {
    const checkboxes = contentContainer.querySelectorAll(
      '.cache-table-checkbox:checked'
    ) as NodeListOf<HTMLInputElement>;

    if (checkboxes.length === 0) {
      this.toastService.show('Please select at least one table to clear', 'warning');
      return;
    }

    const tableNames = Array.from(checkboxes).map(cb => cb.value);

    // Show confirmation modal
    this.modalService.show({
      title: 'Clear Selected Cache Tables?',
      content: `
        <div style="padding: 1rem 0;">
          <p style="margin-bottom: 1rem;">This will clear ${tableNames.length} table(s): ${tableNames.join(', ')}.</p>
          <p style="color: rgba(255, 100, 100, 0.8);">This action cannot be undone.</p>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button class="btn" data-action="cancel">Cancel</button>
          <button class="btn btn--danger" data-action="confirm">Clear Tables</button>
        </div>
      `,
      width: '500px',
      closeOnBackdrop: true,
      closeOnEsc: true
    });

    // Setup modal button handlers
    setTimeout(() => {
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      const confirmBtn = document.querySelector('[data-action="confirm"]');

      cancelBtn?.addEventListener('click', () => {
        this.modalService.hide();
      });

      confirmBtn?.addEventListener('click', async () => {
        this.modalService.hide();

        try {
          // Import db from NDK cache adapter
          const { db } = await import('@nostr-dev-kit/ndk-cache-dexie');

          // Clear selected tables
          for (const tableName of tableNames) {
            if ((db as any)[tableName]) {
              await (db as any)[tableName].clear();
            }
          }

          // Uncheck all checkboxes
          checkboxes.forEach(cb => cb.checked = false);

          this.toastService.show(`Successfully cleared ${tableNames.length} cache table(s)`, 'success');
        } catch (error) {
          this.errorService.handleError(error, 'Failed to clear cache tables');
        }
      });
    }, 100);
  }

  /**
   * Handle clear all cache (delete entire database)
   */
  private async handleClearAll(): Promise<void> {
    // Show confirmation modal
    this.modalService.show({
      title: 'Clear All Cache & Reload?',
      content: `
        <div style="padding: 1rem 0;">
          <p style="margin-bottom: 1rem;">This will clear all safe cache tables and reload the app.</p>
          <p style="font-size: 13px; color: rgba(255, 255, 255, 0.6); margin-bottom: 1rem;">
            Excludes: Unpublished events and decrypted messages (protected from accidental deletion).
          </p>
          <p style="color: rgba(255, 100, 100, 0.8);">This action cannot be undone.</p>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button class="btn" data-action="cancel">Cancel</button>
          <button class="btn btn--danger" data-action="confirm">Clear Cache & Reload</button>
        </div>
      `,
      width: '500px',
      closeOnBackdrop: true,
      closeOnEsc: true
    });

    // Setup modal button handlers
    setTimeout(() => {
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      const confirmBtn = document.querySelector('[data-action="confirm"]');

      cancelBtn?.addEventListener('click', () => {
        this.modalService.hide();
      });

      confirmBtn?.addEventListener('click', async () => {
        this.modalService.hide();

        try {
          // Import db from NDK cache adapter
          const { db } = await import('@nostr-dev-kit/ndk-cache-dexie');

          // Clear all safe tables (exclude unpublishedEvents, decryptedEvents, eventRelays)
          await Promise.all([
            db.events.clear(),
            db.profiles.clear(),
            db.eventTags.clear(),
            db.nip05.clear(),
            db.lnurl.clear(),
            db.relayStatus.clear()
          ]);

          this.toastService.show('Cache cleared successfully. Reloading...', 'success');

          // Reload after short delay
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (error) {
          this.errorService.handleError(error, 'Failed to clear cache');
        }
      });
    }, 100);
  }

  /**
   * Show message
   */
  private showMessage(
    contentContainer: HTMLElement,
    message: string,
    type: 'success' | 'error'
  ): void {
    const messageEl = contentContainer.querySelector('#cache-config-message');
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.className = `save-message save-message--${type}`;

    setTimeout(() => {
      messageEl.textContent = '';
      messageEl.className = 'save-message';
    }, 5000);
  }

  /**
   * Unmount section and cleanup
   */
  public unmount(): void {
    // Cleanup if needed
  }
}
