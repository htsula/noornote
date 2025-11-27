/**
 * AuthGuard Service
 * Central authentication check for all protected actions
 *
 * Usage:
 * if (!AuthGuard.requireAuth('like this note')) return;
 *
 * Shows a modal to non-logged-in users with a login prompt
 */

import { AuthService } from './AuthService';
import { ModalService } from './ModalService';

export class AuthGuard {
  private static authService = AuthService.getInstance();
  private static modalService = ModalService.getInstance();

  /**
   * Check if user is authenticated
   * If not, show login modal with action description
   *
   * @param actionDescription - Human-readable description (e.g., "like this note", "create a post")
   * @returns true if authenticated, false if not
   */
  public static requireAuth(actionDescription: string): boolean {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser) {
      return true; // User is logged in
    }

    // User not logged in - show modal
    this.showLoginRequiredModal(actionDescription);
    return false;
  }

  /**
   * Show modal prompting user to log in
   */
  private static showLoginRequiredModal(actionDescription: string): void {
    const modalContent = `
      <div class="auth-required-modal">
        <div class="auth-required-modal__icon">🔒</div>
        <h3>Login Required</h3>
        <p>Please log in to ${actionDescription}.</p>
        <div class="auth-required-modal__actions">
          <button class="btn" data-action="close">OK</button>
        </div>
      </div>
    `;

    this.modalService.show({
      title: 'Authentication Required',
      content: modalContent,
      width: '400px',
      showCloseButton: true,
      closeOnOverlay: true,
      closeOnEsc: true
    });

    // Setup close button handler
    setTimeout(() => {
      const closeBtn = document.querySelector('[data-action="close"]');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.modalService.hide();
        });
      }
    }, 0);
  }
}
