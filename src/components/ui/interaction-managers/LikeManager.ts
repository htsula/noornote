/**
 * LikeManager
 * Handles like interactions for InteractionStatusLine:
 * - Emoji picker for reactions
 * - Reaction publishing
 * - Button state updates
 */

import { ReactionService } from '../../../services/ReactionService';
import { RelayConfig } from '../../../services/RelayConfig';
import { ToastService } from '../../../services/ToastService';
import { EmojiPicker } from '../../emoji/EmojiPicker';
import { BaseInteractionManager, BaseInteractionConfig } from './BaseInteractionManager';

export interface LikeManagerConfig extends BaseInteractionConfig {
  onLike?: () => void;
}

export class LikeManager extends BaseInteractionManager<LikeManagerConfig> {
  private reactionService: ReactionService;
  private emojiPicker: EmojiPicker | null = null;

  constructor(config: LikeManagerConfig) {
    super(config);
    this.reactionService = ReactionService.getInstance();
  }

  /**
   * Check if current user has already liked this note
   */
  public async checkInteractionStatus(): Promise<void> {
    try {
      this.hasInteracted = await this.reactionService.hasUserLiked(this.config.noteId);
      if (this.hasInteracted) {
        this.updateButtonState(true);
      }
    } catch (error) {
      console.warn('Failed to check liked status:', error);
    }
  }

  /**
   * Alias for backwards compatibility
   */
  public async checkLikedStatus(): Promise<void> {
    return this.checkInteractionStatus();
  }

  /**
   * Handle like action - Show emoji picker
   */
  protected handleInteraction(): void {
    this.handleLike();
  }

  /**
   * Handle like action - Show emoji picker
   */
  public handleLike(): void {
    console.log('🎯 LikeManager handleLike called');

    if (!this.requireAuth('like this note')) {
      console.log('❌ LikeManager: Auth check failed');
      return;
    }

    console.log('✅ LikeManager: Auth check passed');

    // Don't allow liking if already liked
    if (this.hasInteracted) {
      console.log('ℹ️ User has already liked this note');
      ToastService.show('You already liked this note', 'info');
      return;
    }

    // Call custom handler if provided
    if (this.config.onLike) {
      console.log('🔄 LikeManager: Using custom onLike handler');
      this.config.onLike();
      return;
    }

    if (!this.button) {
      console.error('❌ Like button not found');
      return;
    }

    console.log('✅ Like button found');

    // Close existing picker if open
    if (this.emojiPicker) {
      console.log('🔄 Closing existing emoji picker');
      this.emojiPicker.destroy();
      this.emojiPicker = null;
      return;
    }

    console.log('📱 Creating emoji picker...');

    // Create and show emoji picker
    this.emojiPicker = new EmojiPicker({
      triggerElement: this.button,
      onSelect: (emoji) => {
        console.log('😀 Emoji selected:', emoji);
        this.publishReaction(emoji);
        this.emojiPicker?.hide();
        this.emojiPicker?.destroy();
        this.emojiPicker = null;
      }
    });

    this.emojiPicker.show();
    console.log('✅ Emoji picker shown');
  }

  /**
   * Publish reaction to note with selected emoji
   */
  private async publishReaction(emoji: string): Promise<void> {
    console.log('📤 LikeManager publishReaction called with emoji:', emoji);

    // Disable like button immediately to prevent multiple clicks
    const likeBtn = this.button as HTMLButtonElement;
    if (likeBtn) {
      likeBtn.disabled = true;
    }

    try {
      const writeRelays = await RelayConfig.getInstance().getWriteRelays();

      console.log('📡 Write relays:', writeRelays);

      if (writeRelays.length === 0) {
        console.error('❌ No write relays configured');
        if (likeBtn) likeBtn.disabled = false;
        return;
      }

      console.log('🎯 Publishing reaction to note:', this.config.noteId, 'by author:', this.config.authorPubkey);

      const result = await this.reactionService.publishReaction({
        noteId: this.config.noteId,
        authorPubkey: this.config.authorPubkey,
        emoji,
        relays: writeRelays
      });

      console.log('✅ Reaction published, result:', result);

      if (result.success) {
        // Update stats (cache invalidation + optimistic UI update)
        this.updateStats('like');
        console.log('✅ Stats updated via StatsUpdateService');

        // Update liked state and button appearance
        this.hasInteracted = true;
        this.updateButtonState(true);
        console.log('✅ Like button state updated to active');
      } else {
        // Re-enable button if publishing failed
        if (likeBtn) likeBtn.disabled = false;
      }
    } catch (error) {
      console.error('❌ Failed to publish reaction:', error);
      if (likeBtn) likeBtn.disabled = false;
    }
  }

  /**
   * Update like button visual state
   */
  protected updateButtonState(liked: boolean): void {
    if (!this.button) return;

    const likeBtn = this.button as HTMLButtonElement;
    if (liked) {
      likeBtn.classList.add('active');
      likeBtn.disabled = true;
    } else {
      likeBtn.classList.remove('active');
      likeBtn.disabled = false;
    }
  }

  /**
   * Destroy manager and cleanup resources
   */
  public destroy(): void {
    if (this.emojiPicker) {
      this.emojiPicker.destroy();
      this.emojiPicker = null;
    }
    super.destroy();
  }
}
