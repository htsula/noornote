/**
 * RepostManager
 * Handles repost and quote interactions for InteractionStatusLine:
 * - Regular repost
 * - Quoted repost
 * - Button state updates
 */

import { RepostService } from '../../../services/RepostService';
import { RelayConfig } from '../../../services/RelayConfig';
import { ToastService } from '../../../services/ToastService';
import { PostNoteModal } from '../../post/PostNoteModal';
import { getRepostsOriginalEvent } from '../../../helpers/getRepostsOriginalEvent';
import type { Event as NostrEvent } from '@nostr-dev-kit/ndk';
import { BaseInteractionManager, BaseInteractionConfig } from './BaseInteractionManager';

export interface RepostManagerConfig extends BaseInteractionConfig {
  originalEvent?: NostrEvent;
  onRepost?: () => void;
  onQuote?: () => void;
}

export class RepostManager extends BaseInteractionManager<RepostManagerConfig> {
  private repostService: RepostService;

  constructor(config: RepostManagerConfig) {
    super(config);
    this.repostService = RepostService.getInstance();
  }

  /**
   * Check if current user has already reposted this note
   */
  public async checkInteractionStatus(): Promise<void> {
    try {
      this.hasInteracted = await this.repostService.hasUserReposted(this.config.noteId);
      if (this.hasInteracted) {
        this.updateButtonState(true);
      }
    } catch (error) {
      console.warn('Failed to check reposted status:', error);
    }
  }

  /**
   * Alias for backwards compatibility
   */
  public async checkRepostedStatus(): Promise<void> {
    return this.checkInteractionStatus();
  }

  /**
   * Handle repost action
   */
  protected handleInteraction(): void {
    this.handleRepost();
  }

  /**
   * Handle repost action
   */
  public async handleRepost(): Promise<void> {
    console.log('🎯 RepostManager handleRepost called');

    if (!this.requireAuth('repost this note')) {
      console.log('❌ RepostManager: Auth check failed');
      return;
    }

    console.log('✅ RepostManager: Auth check passed');

    // Don't allow reposting if already reposted
    if (this.hasInteracted) {
      console.log('ℹ️ User has already reposted this note');
      ToastService.show('You already reposted this note', 'info');
      return;
    }

    // Call custom handler if provided
    if (this.config.onRepost) {
      console.log('🔄 RepostManager: Using custom onRepost handler');
      this.config.onRepost();
      return;
    }

    // Publish repost
    console.log('📤 RepostManager: Publishing repost...');
    await this.publishRepost();
  }

  /**
   * Handle quote action
   */
  public async handleQuote(): Promise<void> {
    if (!this.requireAuth('quote this note')) {
      return;
    }

    if (this.config.onQuote) {
      this.config.onQuote();
      return;
    }

    await this.openQuotedRepostEditor();
  }

  /**
   * Publish repost to note
   */
  private async publishRepost(): Promise<void> {
    console.log('📤 RepostManager publishRepost called');

    try {
      const originalEvent = this.config.originalEvent;

      if (!originalEvent) {
        console.error('❌ Original event not found');
        ToastService.show('Note not found', 'error');
        return;
      }

      console.log('✅ Original event found:', originalEvent.id.slice(0, 8));

      // If reposting a repost (Kind 6), extract the original event
      // Per NIP-18: A repost MUST reference the original event, not another repost
      const unwrappedEvent = await getRepostsOriginalEvent(originalEvent);
      console.log('✅ Unwrapped event (if repost):', unwrappedEvent.id.slice(0, 8));

      const writeRelays = await RelayConfig.getInstance().getWriteRelays();

      console.log('📡 Write relays:', writeRelays);

      if (writeRelays.length === 0) {
        console.error('❌ No write relays configured');
        return;
      }

      console.log('🎯 Publishing repost for note:', this.config.noteId);

      const result = await this.repostService.publishRepost({
        originalEvent: unwrappedEvent,
        relays: writeRelays
      });

      console.log('✅ Repost published, result:', result);

      if (result.success) {
        // Update stats (cache invalidation + optimistic UI update)
        this.updateStats('repost');
        console.log('✅ Stats updated via StatsUpdateService');

        // Update reposted state and button appearance
        this.hasInteracted = true;
        this.updateButtonState(true);
        console.log('✅ Repost button state updated to active');
      }
    } catch (error) {
      console.error('❌ Failed to publish repost:', error);
    }
  }

  /**
   * Open post editor with pre-filled quoted event reference
   */
  private async openQuotedRepostEditor(): Promise<void> {
    try {
      const originalEvent = this.config.originalEvent;

      if (!originalEvent) {
        console.error('❌ Original event not found for quoted repost');
        ToastService.show('Note not found', 'error');
        return;
      }

      // If this is a repost (Kind 6), extract the original note being reposted
      const unwrappedEvent = await getRepostsOriginalEvent(originalEvent);

      // Generate nevent reference with relay hints
      const { encodeNevent } = await import('../../../helpers/encodeNevent');
      const writeRelays = await RelayConfig.getInstance().getWriteRelays();

      const neventReference = encodeNevent(
        unwrappedEvent.id,
        writeRelays,
        unwrappedEvent.pubkey
      );

      // Open post modal with pre-filled content
      PostNoteModal.getInstance().show(neventReference);
    } catch (error) {
      console.error('❌ Failed to open quoted repost editor:', error);
      ToastService.show('Failed to open editor', 'error');
    }
  }

  /**
   * Update repost button visual state
   */
  protected updateButtonState(reposted: boolean): void {
    if (!this.button) return;

    if (reposted) {
      this.button.classList.add('active');
    } else {
      this.button.classList.remove('active');
    }
  }

  /**
   * Attach event listener to repost button
   */
  public attachRepostListener(repostButton: HTMLElement): void {
    this.setButtonElement(repostButton);

    repostButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleRepost();
    });
  }

  /**
   * Attach event listener to quote button
   */
  public attachQuoteListener(quoteButton: HTMLElement): void {
    quoteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleQuote();
    });
  }
}
