/**
 * AppearanceSection Component
 * Manages general application settings (Notifications cache)
 *
 * @purpose Configure app-wide preferences like notification cache size
 * @used-by SettingsView
 */

import { SettingsSection } from './SettingsSection';

export class AppearanceSection extends SettingsSection {
  constructor() {
    super('general');
  }

  /**
   * Mount section content into the DOM
   */
  public async mount(parentContainer: HTMLElement): Promise<void> {
    const contentContainer = this.getContentContainer(parentContainer);
    if (!contentContainer) return;

    const { NotificationsCacheService } = await import('../../services/NotificationsCacheService');
    const cacheService = NotificationsCacheService.getInstance();
    const currentLimit = cacheService.getLimit();

    contentContainer.innerHTML = this.renderContent(currentLimit);
    this.bindListeners(contentContainer);
  }

  /**
   * Render general settings content
   */
  private renderContent(currentLimit: number): string {
    return `
      <div class="general-settings">
        <h3>Notifications</h3>

        <div class="setting-item">
          <label for="notifications-cache-size" class="setting-item-label">
            <span class="setting-label">Notifications Cache Size</span>
            <span class="setting-help">Maximum number of notifications to keep cached in localStorage (faster loading on view switches)</span>
          </label>
          <input
            type="number"
            id="notifications-cache-size"
            class="setting-input"
            value="${currentLimit}"
            min="10"
            max="1000"
            step="10"
          />
        </div>

        <button class="btn btn--medium" id="save-general-settings-btn">Save Settings</button>
        <div id="general-settings-message" class="save-message"></div>
      </div>
    `;
  }

  /**
   * Bind event listeners
   */
  private bindListeners(contentContainer: HTMLElement): void {
    const saveBtn = contentContainer.querySelector('#save-general-settings-btn');
    saveBtn?.addEventListener('click', async () => {
      const input = contentContainer.querySelector('#notifications-cache-size') as HTMLInputElement;
      const newLimit = parseInt(input.value, 10);

      if (isNaN(newLimit) || newLimit < 10 || newLimit > 1000) {
        this.showMessage(contentContainer, 'Invalid cache size (must be between 10-1000)', 'error');
        return;
      }

      const { NotificationsCacheService } = await import('../../services/NotificationsCacheService');
      const cacheService = NotificationsCacheService.getInstance();
      cacheService.setLimit(newLimit);

      this.showMessage(contentContainer, 'Settings saved successfully!', 'success');
    });
  }

  /**
   * Show message
   */
  private showMessage(contentContainer: HTMLElement, message: string, type: 'success' | 'error'): void {
    const messageEl = contentContainer.querySelector('#general-settings-message');
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
