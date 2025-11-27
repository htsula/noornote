/**
 * RelaySelector Component
 * Reusable relay selection dropdown for posting
 *
 * Features:
 * - Multi-select checkbox dropdown
 * - TEST mode support (single relay, disabled)
 * - Clean URL display (removes wss:// prefix)
 */

export interface RelaySelectorConfig {
  availableRelays: string[];
  selectedRelays: Set<string>;
  isTestMode: boolean;
  onChange: (selectedRelays: Set<string>) => void;
}

export class RelaySelector {
  private config: RelaySelectorConfig;
  private container: HTMLElement | null = null;
  private documentClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(config: RelaySelectorConfig) {
    this.config = config;
  }

  /**
   * Render relay selector HTML
   */
  public render(): string {
    const relayOptions = this.config.availableRelays.map(relay => {
      const isSelected = this.config.selectedRelays.has(relay);
      const cleanUrl = relay.replace(/^wss?:\/\//, '');

      return `
        <label class="relay-option">
          <input
            type="checkbox"
            value="${relay}"
            ${isSelected ? 'checked' : ''}
            ${this.config.isTestMode ? 'disabled' : ''}
          />
          <span>${cleanUrl}</span>
        </label>
      `;
    }).join('');

    return `
      <div class="post-note-relay-selector">
        <label class="relay-selector-label">Post to:</label>
        <div class="relay-selector-dropdown">
          <button class="relay-selector-trigger" type="button" ${this.config.isTestMode ? 'disabled' : ''}>
            ${this.getSelectionText()}
          </button>
          <div class="relay-selector-options">
            ${relayOptions}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners after rendering
   */
  public setupEventListeners(container: HTMLElement): void {
    this.container = container;

    const trigger = container.querySelector('.relay-selector-trigger');
    const dropdown = container.querySelector('.relay-selector-options') as HTMLElement;

    if (!trigger || !dropdown || this.config.isTestMode) return;

    // Toggle dropdown on trigger click
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('is-open');
    });

    // Handle checkbox changes
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        if (input.checked) {
          this.config.selectedRelays.add(input.value);
        } else {
          this.config.selectedRelays.delete(input.value);
        }
        this.updateDisplay();
        this.config.onChange(this.config.selectedRelays);
      });
    });

    // Close dropdown when clicking outside
    this.documentClickHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && e.target !== trigger) {
        dropdown.classList.remove('is-open');
      }
    };
    document.addEventListener('click', this.documentClickHandler);
  }

  /**
   * Update display text
   */
  public updateDisplay(): void {
    if (!this.container) return;

    const trigger = this.container.querySelector('.relay-selector-trigger');
    if (trigger) {
      trigger.textContent = this.getSelectionText();
    }
  }

  /**
   * Get selection display text
   */
  private getSelectionText(): string {
    if (this.config.isTestMode) {
      return 'Local relay (TEST mode)';
    }

    const count = this.config.selectedRelays.size;
    if (count === 0) return 'Select relays...';
    if (count === 1) return '1 relay selected';
    return `${count} relays selected`;
  }

  /**
   * Cleanup event listeners
   */
  public destroy(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }
    this.container = null;
  }
}
