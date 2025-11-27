/**
 * KeySignerConnectionManager
 * Manages KeySigner daemon connection, polling, and health monitoring
 *
 * @purpose Handle KeySigner-specific connection logic separate from core auth
 * @used-by AuthService
 */

import { KeySignerClient } from '../KeySignerClient';
import { EventBus } from '../EventBus';
import { PlatformService } from '../PlatformService';

export class KeySignerConnectionManager {
  private keySigner: KeySignerClient | null = null;
  private eventBus: EventBus;
  private daemonPollingInterval: NodeJS.Timeout | null = null;
  private readonly DAEMON_POLL_INTERVAL = 5000; // Poll every 5 seconds
  private daemonFailureCount = 0;
  private readonly MAX_DAEMON_FAILURES = 6; // Allow 6 failures (30s grace period) before logout
  private windowFocused = true;
  private keySignerAbortController: AbortController | null = null;
  private onDaemonLost?: () => void;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.setupWindowFocusListeners();
  }

  /**
   * Set callback for when daemon connection is lost
   */
  public onConnectionLost(callback: () => void): void {
    this.onDaemonLost = callback;
  }

  /**
   * Setup window focus/blur listeners for adaptive daemon polling
   */
  private setupWindowFocusListeners(): void {
    if (!PlatformService.getInstance().isTauri) return;

    window.addEventListener('focus', () => {
      this.windowFocused = true;
      // console.log('[KeySignerConnectionManager] Window focused - resuming daemon polling');

      if (this.keySigner && !this.daemonPollingInterval) {
        this.startDaemonPolling();
      }
    });

    window.addEventListener('blur', () => {
      this.windowFocused = false;
      // console.log('[KeySignerConnectionManager] Window blurred - pausing daemon polling');
      // Note: Don't stop polling, just pause via windowFocused flag (checked in polling loop)
    });
  }

  /**
   * Try auto-login with KeySigner
   */
  public async tryAutoLogin(): Promise<{ success: boolean; npub?: string; pubkey?: string; error?: string }> {
    if (!PlatformService.getInstance().isTauri) {
      return { success: false, error: 'Not running in Tauri' };
    }

    try {
      console.log('[KeySignerConnectionManager] Attempting auto-login with KeySigner...');
      this.keySigner = KeySignerClient.getInstance();

      const isRunning = await this.keySigner.isRunning();
      if (!isRunning) {
        console.log('[KeySignerConnectionManager] Daemon not running, auto-login skipped');
        this.keySigner = null;
        return { success: false, error: 'Daemon not running' };
      }

      const pubkey = await this.keySigner.getPubkey();
      if (pubkey) {
        console.log('[KeySignerConnectionManager] Auto-login successful with KeySigner');
        const { hexToNpub } = await import('../../helpers/nip19');
        const npub = await hexToNpub(pubkey);

        this.startDaemonPolling();

        return { success: true, npub, pubkey };
      }

      this.keySigner = null;
      return { success: false, error: 'No pubkey available' };
    } catch (error) {
      console.error('[KeySignerConnectionManager] Auto-login failed:', error);
      this.keySigner = null;
      return { success: false, error: String(error) };
    }
  }

  /**
   * Authenticate with KeySigner
   */
  public async authenticate(): Promise<{ success: boolean; npub?: string; pubkey?: string; error?: string }> {
    if (!PlatformService.getInstance().isTauri) {
      return { success: false, error: 'KeySigner only available in Tauri' };
    }

    try {
      this.keySigner = KeySignerClient.getInstance();

      console.log('[KeySignerConnectionManager] Checking if daemon is running...');
      const isRunning = await this.keySigner.isRunning();

      if (!isRunning) {
        // Daemon not running - try to launch it
        console.log('[KeySignerConnectionManager] Daemon not running, launching...');
        await this.keySigner.launchDaemon();

        // Wait for daemon to become available
        const maxWaitTime = 60000; // 60 seconds
        const pollInterval = 1000; // 1 second
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));

          const isNowRunning = await this.keySigner.isRunning();
          if (isNowRunning) {
            console.log('[KeySignerConnectionManager] Daemon is now running');
            break;
          }
        }

        // Check if daemon started
        const finalCheck = await this.keySigner.isRunning();
        if (!finalCheck) {
          this.keySigner = null;
          return {
            success: false,
            error: 'Daemon failed to start within 60 seconds. Please try again or check Settings → Key Signer.'
          };
        }
      }

      // Create abort controller for cancellation
      this.keySignerAbortController = new AbortController();

      console.log('[KeySignerConnectionManager] Daemon is running, getting pubkey...');
      const pubkey = await this.keySigner.getPubkey();

      if (!pubkey) {
        throw new Error('Failed to get pubkey from KeySigner');
      }

      console.log('[KeySignerConnectionManager] Got pubkey from KeySigner:', pubkey.slice(0, 8) + '...');

      const { hexToNpub } = await import('../../helpers/nip19');
      const npub = await hexToNpub(pubkey);

      this.startDaemonPolling();

      return { success: true, npub, pubkey };
    } catch (error: any) {
      console.error('[KeySignerConnectionManager] Authentication failed:', error);

      if (error.name === 'AbortError') {
        console.log('[KeySignerConnectionManager] KeySigner login cancelled by user');
        return { success: false, error: 'Login cancelled' };
      }

      this.keySigner = null;
      return { success: false, error: String(error) };
    } finally {
      this.keySignerAbortController = null;
    }
  }

  /**
   * Cancel ongoing KeySigner login
   */
  public async cancelLogin(): Promise<void> {
    if (this.keySignerAbortController) {
      console.log('[KeySignerConnectionManager] Cancelling KeySigner login...');
      this.keySignerAbortController.abort();
      this.keySignerAbortController = null;
    }

    if (this.keySigner) {
      this.keySigner = null;
    }
  }

  /**
   * Start daemon health polling
   */
  public startDaemonPolling(): void {
    if (this.daemonPollingInterval || !this.keySigner) return;

    console.log('[KeySignerConnectionManager] Starting daemon health polling...');
    this.daemonFailureCount = 0;

    this.daemonPollingInterval = setInterval(async () => {
      if (!this.windowFocused) {
        return;
      }

      try {
        const isRunning = await this.keySigner!.isRunning();

        if (!isRunning) {
          this.daemonFailureCount++;
          console.warn(`[KeySignerConnectionManager] Daemon check failed (${this.daemonFailureCount}/${this.MAX_DAEMON_FAILURES})`);

          if (this.daemonFailureCount >= this.MAX_DAEMON_FAILURES) {
            console.error('[KeySignerConnectionManager] Daemon connection lost after grace period - logging out');
            this.stopDaemonPolling();
            this.onDaemonLost?.();

            const { ToastService } = await import('../ToastService');
            ToastService.show('KeySigner daemon connection lost', 'error');
          }
        } else {
          if (this.daemonFailureCount > 0) {
            console.log('[KeySignerConnectionManager] Connection restored');
            this.daemonFailureCount = 0;
          }
        }
      } catch (error: any) {
        const isTransientError = error.message?.includes('Broken pipe') ||
                                  error.message?.includes('os error 32');

        if (isTransientError) {
          this.daemonFailureCount++;
          console.warn(`[KeySignerConnectionManager] Transient connection error (${this.daemonFailureCount}/${this.MAX_DAEMON_FAILURES}):`, error.message);

          if (this.daemonFailureCount >= this.MAX_DAEMON_FAILURES) {
            console.error('[KeySignerConnectionManager] Too many transient errors - logging out');
            this.stopDaemonPolling();
            this.onDaemonLost?.();

            const { ToastService } = await import('../ToastService');
            ToastService.show('KeySigner connection unstable - logged out', 'error');
          }
        } else {
          console.error('[KeySignerConnectionManager] Daemon polling error:', error);
        }
      }
    }, this.DAEMON_POLL_INTERVAL);
  }

  /**
   * Stop daemon health polling
   */
  public stopDaemonPolling(): void {
    if (this.daemonPollingInterval) {
      console.log('[KeySignerConnectionManager] Stopping daemon health polling');
      clearInterval(this.daemonPollingInterval);
      this.daemonPollingInterval = null;
      this.daemonFailureCount = 0;
    }
  }

  /**
   * Ask user if they want to stop the daemon
   */
  public async askStopDaemon(): Promise<boolean> {
    if (!this.keySigner) return false;

    try {
      const isRunning = await this.keySigner.isRunning();
      if (!isRunning) return false;

      const { ModalService } = await import('../ModalService');
      const modalService = ModalService.getInstance();

      return new Promise((resolve) => {
        modalService.confirm({
          title: 'Stop NoorSigner Daemon?',
          message: 'Do you want to stop the NoorSigner daemon process? This will end all active signing sessions.',
          confirmText: 'Stop Daemon',
          cancelText: 'Keep Running',
          confirmButtonClass: 'btn btn--danger',
          onConfirm: async () => {
            try {
              await this.keySigner!.stopDaemon();
              console.log('[KeySignerConnectionManager] Daemon stopped successfully');
              resolve(true);
            } catch (error) {
              console.error('[KeySignerConnectionManager] Failed to stop daemon:', error);
              const { ToastService } = await import('../ToastService');
              ToastService.show('Failed to stop daemon', 'error');
              resolve(false);
            }
          },
          onCancel: () => {
            console.log('[KeySignerConnectionManager] User chose to keep daemon running');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('[KeySignerConnectionManager] Error checking daemon status:', error);
      return false;
    }
  }

  /**
   * Get KeySigner client
   */
  public getClient(): KeySignerClient | null {
    return this.keySigner;
  }

  /**
   * Clear KeySigner client
   */
  public clear(): void {
    this.stopDaemonPolling();
    this.keySigner = null;
    this.daemonFailureCount = 0;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopDaemonPolling();
    this.keySigner = null;
  }
}
