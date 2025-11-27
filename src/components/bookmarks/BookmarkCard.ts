/**
 * BookmarkCard
 * Renders a single bookmark as a draggable card
 *
 * @purpose Display bookmark with author, content preview, and delete action
 * @used-by BookmarkSecondaryManager
 */

import { UserProfileService } from '../../services/UserProfileService';
import { Router } from '../../services/Router';
import { encodeNevent } from '../../services/NostrToolsAdapter';
import type { NostrEvent } from '@nostr-dev-kit/ndk';

export interface BookmarkCardData {
  id: string;              // Bookmark ID (always available from localStorage)
  event?: NostrEvent;      // Event data (may be undefined if not loaded)
  isPrivate: boolean;
  folderId?: string;
}

export interface BookmarkCardOptions {
  onDelete: (eventId: string) => Promise<void>;
}

export class BookmarkCard {
  private data: BookmarkCardData;
  private options: BookmarkCardOptions;
  private element: HTMLElement | null = null;
  private userProfileService: UserProfileService;
  private router: Router;

  constructor(data: BookmarkCardData, options: BookmarkCardOptions) {
    this.data = data;
    this.options = options;
    this.userProfileService = UserProfileService.getInstance();
    this.router = Router.getInstance();
  }

  public async render(): Promise<HTMLElement> {
    const { id, event, isPrivate } = this.data;

    // Create card element
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.dataset.eventId = id;
    card.dataset.bookmarkId = id;

    if (event) {
      // Normal card with event data
      const profile = await this.userProfileService.getUserProfile(event.pubkey);
      const username = profile?.name || 'Anonymous';
      const profilePic = profile?.picture || '';
      const snippet = this.getTextSnippet(event.content, 100);
      const timeAgo = this.formatTimestamp(event.created_at);

      card.innerHTML = `
        ${isPrivate ? '<span class="bookmark-card__private-badge">🔒</span>' : ''}
        <div class="bookmark-card__author">
          ${profilePic
            ? `<img class="bookmark-card__author-pic" src="${this.escapeHtml(profilePic)}" alt="" loading="lazy" />`
            : '<div class="bookmark-card__author-pic"></div>'
          }
          <span class="bookmark-card__author-name">${this.escapeHtml(username)}</span>
        </div>
        <div class="bookmark-card__content">${this.escapeHtml(snippet)}</div>
        <div class="bookmark-card__footer">
          <span class="bookmark-card__timestamp">${timeAgo}</span>
          <button class="bookmark-card__delete" aria-label="Remove bookmark" title="Remove bookmark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4h10M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v4M10 7v4M4 4l.5 8.5a1 1 0 0 0 1 .95h5a1 1 0 0 0 1-.95L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `;
    } else {
      // Fallback card when event is not loaded
      card.innerHTML = `
        ${isPrivate ? '<span class="bookmark-card__private-badge">🔒</span>' : ''}
        <div class="bookmark-card__author">
          <div class="bookmark-card__author-pic"></div>
          <span class="bookmark-card__author-name">Unknown</span>
        </div>
        <div class="bookmark-card__content bookmark-card__content--not-found">
          Note not found
          <span class="bookmark-card__event-id">${id.slice(0, 8)}...</span>
        </div>
        <div class="bookmark-card__footer">
          <span class="bookmark-card__timestamp">—</span>
          <button class="bookmark-card__delete" aria-label="Remove bookmark" title="Remove bookmark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4h10M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v4M10 7v4M4 4l.5 8.5a1 1 0 0 0 1 .95h5a1 1 0 0 0 1-.95L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `;
    }

    // Bind events
    this.bindEvents(card);

    this.element = card;
    return card;
  }

  private bindEvents(card: HTMLElement): void {
    const { id, event } = this.data;

    // Click on card (except delete button) navigates to note
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.bookmark-card__delete')) return;
      // Don't navigate if we were dragging
      if (card.dataset.wasDragging === 'true') {
        card.dataset.wasDragging = 'false';
        return;
      }

      // Only navigate if event exists
      if (event) {
        const nevent = encodeNevent(event.id);
        this.router.navigate(`/note/${nevent}`);
      }
    });

    // Delete button
    const deleteBtn = card.querySelector('.bookmark-card__delete');
    deleteBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.options.onDelete(id);
      card.remove();
    });
  }

  private getTextSnippet(content: string, maxLength: number): string {
    let text = content
      .replace(/nostr:(note|nevent|npub|nprofile|naddr|nrelay)[a-zA-Z0-9]+/g, '')
      .replace(/^>.*$/gm, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text || '(No text content)';
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `Today ${hours}:${minutes}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public getElement(): HTMLElement | null {
    return this.element;
  }

  public getEventId(): string {
    return this.data.id;
  }
}
