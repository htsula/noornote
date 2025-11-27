/**
 * ModalService - Centralized Modal Management
 * Single service for all modal windows in the app
 * Handles overlay, ESC key, close button, and cleanup
 */

export interface ModalConfig {
  title: string;
  content: HTMLElement | string;
  width?: string;              // default: '50%'
  height?: string;             // default: '50%'
  maxWidth?: string;           // default: '90%' on mobile
  maxHeight?: string;          // default: '50%' on mobile
  showCloseButton?: boolean;   // default: true
  closeOnOverlay?: boolean;    // default: true
  closeOnEsc?: boolean;        // default: true
  onClose?: () => void;
}

export class ModalService {
  private static instance: ModalService | null = null;
  private container: HTMLElement | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
  private isVisible: boolean = false;
  private currentConfig: ModalConfig | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ModalService {
    if (!ModalService.instance) {
      ModalService.instance = new ModalService();
    }
    return ModalService.instance;
  }

  /**
   * Show modal with config
   */
  public show(config: ModalConfig): void {
    // Hide existing modal if open
    if (this.isVisible) {
      this.hide();
    }

    this.currentConfig = config;
    this.isVisible = true;

    // Create modal container if needed
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'modal';
      document.body.appendChild(this.container);
    }

    // Apply defaults
    const width = config.width || '50%';
    const height = config.height || '50%';
    const maxWidth = config.maxWidth || '90%';
    const maxHeight = config.maxHeight || '50%';
    const showCloseButton = config.showCloseButton !== false;
    const closeOnOverlay = config.closeOnOverlay !== false;
    const closeOnEsc = config.closeOnEsc !== false;

    // Build close button HTML
    const closeButtonHtml = showCloseButton
      ? '<button class="modal__close" title="Close (ESC)">×</button>'
      : '';

    // Render modal structure
    this.container.innerHTML = `
      <div class="modal__overlay"></div>
      <div class="modal__content" style="max-width: ${this.escapeHtml(width)}; max-height: ${this.escapeHtml(height)};">
        <div class="modal__header">
          <h1>${this.escapeHtml(config.title)}</h1>
          ${closeButtonHtml}
        </div>
        <div class="modal__body"></div>
      </div>
    `;

    // Insert content (preserve event listeners if HTMLElement)
    const bodyElement = this.container.querySelector('.modal__body');
    if (bodyElement) {
      if (typeof config.content === 'string') {
        bodyElement.innerHTML = config.content;
      } else {
        // Append actual element to preserve event listeners
        bodyElement.appendChild(config.content);
      }
    }

    // Show modal
    this.container.style.display = 'flex';

    // Setup event handlers
    this.setupEventHandlers(showCloseButton, closeOnOverlay, closeOnEsc);

    // Add responsive styles
    const contentElement = this.container.querySelector('.modal__content') as HTMLElement;
    if (contentElement) {
      // Add media query for mobile and tablet
      contentElement.style.setProperty('--modal-max-width-mobile', maxWidth);
      contentElement.style.setProperty('--modal-max-height-mobile', maxHeight);
      contentElement.style.setProperty('--modal-max-width-tablet', width);
      contentElement.style.setProperty('--modal-max-height-tablet', height);
    }
  }

  /**
   * Hide modal
   */
  public hide(): void {
    if (!this.isVisible || !this.container) return;

    this.isVisible = false;
    this.container.style.display = 'none';
    this.container.innerHTML = '';

    // Remove ESC handler
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }

    // Call onClose callback
    if (this.currentConfig?.onClose) {
      this.currentConfig.onClose();
    }

    this.currentConfig = null;
  }

  /**
   * Check if modal is currently visible
   */
  public isOpen(): boolean {
    return this.isVisible;
  }

  /**
   * Setup event handlers for close actions
   */
  private setupEventHandlers(
    showCloseButton: boolean,
    closeOnOverlay: boolean,
    closeOnEsc: boolean
  ): void {
    if (!this.container) return;

    // Close button handler
    if (showCloseButton) {
      const closeBtn = this.container.querySelector('.modal__close');
      closeBtn?.addEventListener('click', () => this.hide());
    }

    // Overlay click handler
    if (closeOnOverlay) {
      const overlay = this.container.querySelector('.modal__overlay');
      overlay?.addEventListener('click', () => this.hide());
    }

    // ESC key handler
    if (closeOnEsc) {
      this.escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.hide();
        }
      };
      document.addEventListener('keydown', this.escapeHandler);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy modal service (cleanup)
   */
  public destroy(): void {
    this.hide();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    ModalService.instance = null;
  }
}
