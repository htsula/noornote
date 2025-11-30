/**
 * Account Switcher Component
 * Shows current user with dropdown for switching between stored accounts.
 * Replaces UserStatus component for multi-account support.
 */

import { UserProfileService, UserProfile } from '../../services/UserProfileService';
import { AuthService } from '../../services/AuthService';
import { AccountStorageService, type StoredAccount } from '../../services/AccountStorageService';
import { EventBus } from '../../services/EventBus';

export interface AccountSwitcherOptions {
  npub: string;
  pubkey: string;
  onLogout?: () => void;
  onAddAccount?: () => void;
}

export class AccountSwitcher {
  private element: HTMLElement;
  private dropdown: HTMLElement | null = null;
  private isOpen: boolean = false;
  private userProfileService: UserProfileService;
  private authService: AuthService;
  private accountStorage: AccountStorageService;
  private eventBus: EventBus;
  private options: AccountSwitcherOptions;
  private profile: UserProfile | null = null;
  private unsubscribeProfile?: () => void;
  private clickOutsideHandler: (e: MouseEvent) => void;

  constructor(options: AccountSwitcherOptions) {
    this.userProfileService = UserProfileService.getInstance();
    this.authService = AuthService.getInstance();
    this.accountStorage = AccountStorageService.getInstance();
    this.eventBus = EventBus.getInstance();
    this.options = options;
    this.element = this.createElement();
    this.loadProfile();

    // Click outside handler
    this.clickOutsideHandler = (e: MouseEvent) => {
      if (this.isOpen && !this.element.contains(e.target as Node)) {
        this.closeDropdown();
      }
    };
    document.addEventListener('click', this.clickOutsideHandler);
  }

  /**
   * Create account switcher element
   */
  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'account-switcher';
    container.innerHTML = `
      <button class="account-switcher__trigger" type="button">
        <div class="account-switcher__current">
          <span class="account-switcher__indicator"></span>
          <span class="account-switcher__name">Loading...</span>
        </div>
        <span class="account-switcher__arrow">&#9662;</span>
      </button>
    `;

    // Setup trigger click
    const trigger = container.querySelector('.account-switcher__trigger');
    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    return container;
  }

  /**
   * Load user profile and update display
   */
  private async loadProfile(): Promise<void> {
    // Subscribe to profile updates
    this.unsubscribeProfile = this.userProfileService.subscribeToProfile(
      this.options.pubkey,
      (profile: UserProfile) => {
        this.profile = profile;
        this.updateDisplay();

        // Also update account storage with profile info
        this.accountStorage.updateAccount(this.options.pubkey, {
          displayName: profile.name || profile.display_name,
          avatarUrl: profile.picture
        });
      }
    );

    // Trigger initial load
    try {
      await this.userProfileService.getUserProfile(this.options.pubkey);
    } catch (error) {
      console.warn(`[AccountSwitcher] Failed to load profile: ${this.options.pubkey}`, error);
      this.showFallback();
    }
  }

  /**
   * Update display with loaded profile
   */
  private updateDisplay(): void {
    const nameEl = this.element.querySelector('.account-switcher__name');
    if (nameEl) {
      const displayName = this.profile?.name || this.profile?.display_name || `${this.options.npub.slice(0, 12)}...`;
      nameEl.textContent = displayName;
    }
  }

  /**
   * Show fallback when profile loading fails
   */
  private showFallback(): void {
    const nameEl = this.element.querySelector('.account-switcher__name');
    if (nameEl) {
      nameEl.textContent = `${this.options.npub.slice(0, 12)}...`;
    }
  }

  /**
   * Toggle dropdown visibility
   */
  private toggleDropdown(): void {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  /**
   * Open dropdown
   */
  private openDropdown(): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.dropdown = this.createDropdown();
    this.element.appendChild(this.dropdown);
    this.element.classList.add('account-switcher--open');
  }

  /**
   * Close dropdown
   */
  private closeDropdown(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
    }
    this.element.classList.remove('account-switcher--open');
  }

  /**
   * Create dropdown element
   */
  private createDropdown(): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'account-switcher__dropdown';

    const accounts = this.accountStorage.getAccounts();
    const currentPubkey = this.options.pubkey;

    // Account list section
    if (accounts.length > 1) {
      const accountsSection = document.createElement('div');
      accountsSection.className = 'account-switcher__section';
      accountsSection.innerHTML = `<div class="account-switcher__section-title">Switch Account</div>`;

      const accountsList = document.createElement('div');
      accountsList.className = 'account-switcher__accounts';

      for (const account of accounts) {
        const isActive = account.pubkey === currentPubkey;
        const item = this.createAccountItem(account, isActive);
        accountsList.appendChild(item);
      }

      accountsSection.appendChild(accountsList);
      dropdown.appendChild(accountsSection);
    }

    // Actions section
    const actionsSection = document.createElement('div');
    actionsSection.className = 'account-switcher__section account-switcher__actions';

    // Add account button
    const addBtn = document.createElement('button');
    addBtn.className = 'account-switcher__action';
    addBtn.innerHTML = `<span class="account-switcher__action-icon">+</span> Add account`;
    addBtn.addEventListener('click', () => this.handleAddAccount());
    actionsSection.appendChild(addBtn);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'account-switcher__divider';
    actionsSection.appendChild(divider);

    // Logout current
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'account-switcher__action account-switcher__action--danger';
    logoutBtn.innerHTML = `<span class="account-switcher__action-icon">&larr;</span> Sign out`;
    logoutBtn.addEventListener('click', () => this.handleLogout());
    actionsSection.appendChild(logoutBtn);

    // Logout all (only if multiple accounts)
    if (accounts.length > 1) {
      const logoutAllBtn = document.createElement('button');
      logoutAllBtn.className = 'account-switcher__action account-switcher__action--danger';
      logoutAllBtn.innerHTML = `<span class="account-switcher__action-icon">&larr;</span> Sign out all accounts`;
      logoutAllBtn.addEventListener('click', () => this.handleLogoutAll());
      actionsSection.appendChild(logoutAllBtn);
    }

    dropdown.appendChild(actionsSection);

    return dropdown;
  }

  /**
   * Create account item element
   */
  private createAccountItem(account: StoredAccount, isActive: boolean): HTMLElement {
    const item = document.createElement('button');
    item.className = `account-switcher__account${isActive ? ' account-switcher__account--active' : ''}`;

    const badge = AccountStorageService.getAuthMethodBadge(account.authMethod);
    const displayName = account.displayName || `${account.npub.slice(0, 12)}...`;

    item.innerHTML = `
      <span class="account-switcher__account-name">${displayName}</span>
      ${badge ? `<span class="account-switcher__badge">${badge}</span>` : ''}
      ${isActive ? '<span class="account-switcher__active-dot"></span>' : ''}
    `;

    if (!isActive) {
      item.addEventListener('click', () => this.handleSwitch(account.pubkey));
    }

    return item;
  }

  /**
   * Handle account switch
   */
  private async handleSwitch(pubkey: string): Promise<void> {
    this.closeDropdown();

    const result = await this.authService.switchAccount(pubkey);
    if (!result.success) {
      console.error('[AccountSwitcher] Switch failed:', result.error);
      // Could show a toast here
    }
  }

  /**
   * Handle add account
   */
  private handleAddAccount(): void {
    console.log('[AccountSwitcher] handleAddAccount called');
    this.closeDropdown();

    if (this.options.onAddAccount) {
      console.log('[AccountSwitcher] calling onAddAccount callback');
      this.options.onAddAccount();
    } else {
      console.log('[AccountSwitcher] onAddAccount callback not defined!');
    }
  }

  /**
   * Handle logout current account
   */
  private handleLogout(): void {
    this.closeDropdown();

    if (this.options.onLogout) {
      this.options.onLogout();
    }
  }

  /**
   * Handle logout all accounts
   */
  private async handleLogoutAll(): Promise<void> {
    this.closeDropdown();

    await this.authService.signOutAll();
  }

  /**
   * Update user options (when switching accounts)
   */
  public updateUser(options: AccountSwitcherOptions): void {
    if (this.unsubscribeProfile) {
      this.unsubscribeProfile();
    }

    this.options = options;
    this.profile = null;
    this.loadProfile();
    this.closeDropdown();
  }

  /**
   * Get DOM element
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.unsubscribeProfile) {
      this.unsubscribeProfile();
    }
    document.removeEventListener('click', this.clickOutsideHandler);
    this.closeDropdown();
    this.element.remove();
  }
}
