/**
 * ProfileMuteManager
 * Manages mute/unmute functionality for profile views
 * Handles both public and private mutes (NIP-51)
 *
 * @manager ProfileMute
 * @purpose Isolate mute/unmute logic from ProfileView
 * @used-by ProfileView
 */

import { AuthService } from '../../services/AuthService';
import { MuteOrchestrator } from '../../services/orchestration/MuteOrchestrator';
import { UserProfileService } from '../../services/UserProfileService';
import { ToastService } from '../../services/ToastService';

export interface MuteState {
  public: boolean;
  private: boolean;
}

export class ProfileMuteManager {
  private authService: AuthService;
  private muteOrch: MuteOrchestrator;
  private userProfileService: UserProfileService;
  private targetPubkey: string;
  private eventListenersAttached: boolean = false;

  constructor(targetPubkey: string) {
    this.targetPubkey = targetPubkey;
    this.authService = AuthService.getInstance();
    this.muteOrch = MuteOrchestrator.getInstance();
    this.userProfileService = UserProfileService.getInstance();
  }

  /**
   * Check if target user is muted
   */
  public async checkMuteStatus(): Promise<MuteState> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return { public: false, private: false };
    }

    return await this.muteOrch.isMuted(this.targetPubkey, currentUser.pubkey);
  }

  /**
   * Render mute button HTML
   */
  public renderMuteButton(): string {
    const currentUser = this.authService.getCurrentUser();

    // Don't show button if not logged in or viewing own profile
    if (!currentUser || this.targetPubkey === currentUser.pubkey) {
      return '';
    }

    // Check if NIP-51 private mutes are enabled
    const isPrivateMutesEnabled = this.muteOrch.isPrivateMutesEnabled();

    if (isPrivateMutesEnabled) {
      // Show dropdown with public/private options
      return `
        <div class="mute-dropdown-container">
          <button class="btn btn--passive mute-btn-dropdown" id="mute-btn-dropdown">
            Mute
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="mute-dropdown-menu" id="mute-dropdown-menu">
            <button class="mute-dropdown-item" data-action="mute-public">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              Mute publicly
            </button>
            <button class="mute-dropdown-item" data-action="mute-private">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Mute privately
            </button>
          </div>
        </div>
      `;
    } else {
      // Show simple Mute button (no dropdown)
      return `
        <button class="btn btn--passive mute-btn" data-action="mute">
          Mute
        </button>
      `;
    }
  }

  /**
   * Setup mute button event handlers
   */
  public setupMuteButton(container: HTMLElement, onMuted: () => void): void {
    // Prevent duplicate event listeners
    if (this.eventListenersAttached) return;
    this.eventListenersAttached = true;

    // Handle simple mute button (when NIP-51 is disabled)
    const simpleMuteBtn = container.querySelector('.mute-btn[data-action="mute"]');
    if (simpleMuteBtn) {
      simpleMuteBtn.addEventListener('click', async () => {
        await this.handleMute('public', onMuted);
      });
      return;
    }

    // Handle mute dropdown (when NIP-51 is enabled)
    const dropdownBtn = container.querySelector('#mute-btn-dropdown');
    const dropdownMenu = container.querySelector('#mute-dropdown-menu');

    if (!dropdownBtn || !dropdownMenu) return;

    // Toggle dropdown on button click
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('show');
    });

    // Handle dropdown item clicks
    const dropdownItems = container.querySelectorAll('.mute-dropdown-item');
    dropdownItems.forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (item as HTMLElement).dataset.action;

        dropdownMenu.classList.remove('show');

        if (action === 'mute-public') {
          await this.handleMute('public', onMuted);
        } else if (action === 'mute-private') {
          await this.handleMute('private', onMuted);
        }
      });
    });
  }

  /**
   * Handle mute action
   */
  private async handleMute(type: 'public' | 'private', onMuted: () => void): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    try {
      await this.muteOrch.muteUser(this.targetPubkey, type === 'private');
      ToastService.show(`User muted ${type === 'private' ? 'privately' : 'publicly'}`, 'success');

      // Trigger callback to reload profile
      onMuted();
    } catch (error) {
      console.error('Failed to mute user:', error);
      ToastService.show('Failed to mute user', 'error');
    }
  }

  /**
   * Render muted profile placeholder
   */
  public async renderMutedProfile(escapeHtml: (text: string) => string): Promise<string> {
    const profile = await this.userProfileService.getUserProfile(this.targetPubkey);
    const username = profile.display_name || profile.name || profile.username || this.targetPubkey.slice(0, 8);

    return `
      <div class="profile-muted">
        <div class="profile-muted__content">
          <span class="profile-muted__icon">🔇</span>
          <h2>Profile of a user you have muted</h2>
          <p>You've muted ${escapeHtml(username)}.</p>
          <div class="profile-muted__actions">
            <button class="btn profile-muted__unmute" data-pubkey="${this.targetPubkey}">
              Unmute
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup unmute button handler
   */
  public setupUnmuteButton(container: HTMLElement, onUnmuted: () => void): void {
    const unmuteBtn = container.querySelector('.profile-muted__unmute');

    if (unmuteBtn) {
      unmuteBtn.addEventListener('click', async () => {
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) return;

        try {
          // Unmute from both lists atomically
          await this.muteOrch.unmuteUserCompletely(this.targetPubkey);
          ToastService.show('User unmuted', 'success');

          // Trigger callback to reload profile
          onUnmuted();
        } catch (error) {
          console.error('Failed to unmute user:', error);
          ToastService.show('Failed to unmute user', 'error');
        }
      });
    }
  }
}
