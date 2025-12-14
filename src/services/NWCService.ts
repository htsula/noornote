/**
 * NWCService - Nostr Wallet Connect Service
 * Handles NWC connection and Lightning invoice payments (NIP-47)
 *
 * Architecture: Per-user state via Maps (no clearing/overwriting on account switch)
 * - connections: Map<pubkey, NWCConnection>
 * - states: Map<pubkey, NWCConnectionState>
 *
 * NIP-47: https://github.com/nostr-protocol/nips/blob/master/47.md
 */

import type { NostrEvent } from '@nostr-dev-kit/ndk';
import { decodeNip19, nip04, finalizeEvent, getPublicKeyFromPrivate } from './NostrToolsAdapter';
import { NostrTransport } from './transport/NostrTransport';
import { SystemLogger } from '../components/system/SystemLogger';
import { ErrorService } from './ErrorService';
import { ToastService } from './ToastService';
import { KeychainStorage } from './KeychainStorage';
import { AuthService } from './AuthService';

export type NWCConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface NWCConnection {
  walletPubkey: string;
  relay: string;
  secret: string;
  lud16?: string; // Optional Lightning Address (e.g., user@getalby.com)
}

export interface PayInvoiceResult {
  success: boolean;
  preimage?: string;
  error?: string;
}

export class NWCService {
  private static instance: NWCService;
  private systemLogger: SystemLogger;
  private transport: NostrTransport;

  // Per-user state - NO clearing needed on account switch
  private connections: Map<string, NWCConnection> = new Map();
  private states: Map<string, NWCConnectionState> = new Map();

  private constructor() {
    this.systemLogger = SystemLogger.getInstance();
    this.transport = NostrTransport.getInstance();

    // Restore connection for current user (if any)
    this.restoreConnectionForCurrentUser();
  }

  public static getInstance(): NWCService {
    if (!NWCService.instance) {
      NWCService.instance = new NWCService();
    }
    return NWCService.instance;
  }

  /**
   * Get current user's pubkey
   */
  private getCurrentUserPubkey(): string | null {
    const user = AuthService.getInstance().getCurrentUser();
    return user?.pubkey || null;
  }

  /**
   * Get connection for current user
   */
  private getConnectionForCurrentUser(): NWCConnection | null {
    const pubkey = this.getCurrentUserPubkey();
    if (!pubkey) return null;
    return this.connections.get(pubkey) || null;
  }

  /**
   * Get state for current user
   */
  private getStateForCurrentUser(): NWCConnectionState {
    const pubkey = this.getCurrentUserPubkey();
    if (!pubkey) return 'disconnected';
    return this.states.get(pubkey) || 'disconnected';
  }

  /**
   * Set connection for current user
   */
  private setConnectionForCurrentUser(connection: NWCConnection | null): void {
    const pubkey = this.getCurrentUserPubkey();
    if (!pubkey) return;

    if (connection) {
      this.connections.set(pubkey, connection);
    } else {
      this.connections.delete(pubkey);
    }
  }

  /**
   * Set state for current user
   */
  private setStateForCurrentUser(state: NWCConnectionState): void {
    const pubkey = this.getCurrentUserPubkey();
    if (!pubkey) return;
    this.states.set(pubkey, state);
  }

  /**
   * Parse NWC connection string
   * Format: nostr+walletconnect://<wallet-pubkey>?relay=<relay-url>&secret=<secret-hex>&lud16=<lightning-address>
   */
  private parseConnectionString(connectionString: string): NWCConnection {
    try {
      const url = new URL(connectionString);

      // Extract pubkey from pathname or host (some formats use host, some use pathname)
      let walletPubkey = url.pathname || url.host;

      // Remove leading slash if present
      if (walletPubkey.startsWith('/')) {
        walletPubkey = walletPubkey.substring(1);
      }

      // Decode npub to hex if needed
      if (walletPubkey.startsWith('npub')) {
        const decoded = decodeNip19(walletPubkey);
        if (decoded.type === 'npub') {
          walletPubkey = decoded.data as string;
        }
      }

      const relay = url.searchParams.get('relay');
      const secret = url.searchParams.get('secret');
      const lud16 = url.searchParams.get('lud16'); // Optional Lightning Address

      if (!walletPubkey || !relay || !secret) {
        throw new Error('Missing required parameters (pubkey, relay, or secret)');
      }

      return {
        walletPubkey,
        relay,
        secret,
        lud16: lud16 || undefined // URL.searchParams.get() auto-decodes %40 to @
      };
    } catch (_error) {
      this.systemLogger.error('NWCService', 'Failed to parse connection string:', _error);
      throw new Error('Invalid NWC connection string format');
    }
  }

  /**
   * Connect to NWC wallet
   */
  public async connect(connectionString: string): Promise<boolean> {
    this.setStateForCurrentUser('connecting');

    try {
      // Parse connection string
      const connection = this.parseConnectionString(connectionString);

      // Test connection by sending info request
      const isValid = await this.testConnection(connection);

      if (!isValid) {
        this.setStateForCurrentUser('error');
        ToastService.show('Verbindung zum Wallet fehlgeschlagen', 'error');
        return false;
      }

      // Store connection in memory
      this.setConnectionForCurrentUser(connection);
      this.setStateForCurrentUser('connected');

      // Persist to KeychainStorage (secure, per-user)
      await this.saveConnection(connectionString);

      this.systemLogger.info('NWCService', 'Connected to NWC wallet:', connection.walletPubkey.slice(0, 8));
      ToastService.show('Lightning Wallet verbunden', 'success');

      return true;
    } catch (_error) {
      this.setStateForCurrentUser('error');
      ErrorService.handle(
        _error,
        'NWCService.connect',
        true,
        'NWC-Verbindung fehlgeschlagen. Bitte prüfe den Connection String.'
      );
      return false;
    }
  }

  /**
   * Test NWC connection by sending get_info request
   */
  private async testConnection(connection: NWCConnection): Promise<boolean> {
    try {
      // Create get_info request
      const content = JSON.stringify({
        method: 'get_info'
      });

      // Encrypt content with NIP-04
      const appSecretKey = this.hexToBytes(connection.secret);
      const appPubkey = getPublicKeyFromPrivate(appSecretKey);
      const encryptedContent = await nip04.encrypt(connection.secret, connection.walletPubkey, content);

      // Create NWC request event (kind 23194)
      const event = finalizeEvent({
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', connection.walletPubkey]],
        content: encryptedContent
      }, appSecretKey);

      // Ensure NWC relay is connected before publishing
      const connected = await this.transport.connectToRelay(connection.relay);
      if (!connected) {
        this.systemLogger.warn('NWCService', `Failed to connect to NWC relay: ${connection.relay}`);
        return false;
      }

      // Publish to relay and wait for response
      await this.transport.publish([connection.relay], event);

      // Listen for response (kind 23195) - timeout after 5 seconds
      return new Promise(async (resolve) => {
        const sub = await this.transport.subscribe([connection.relay], [
          {
            kinds: [23195],
            authors: [connection.walletPubkey],
            '#p': [appPubkey],
            since: Math.floor(Date.now() / 1000)
          }
        ], {
          onEvent: async (event: NostrEvent) => {
            // NostrTransport already verified signature
            clearTimeout(timeout);
            sub.close();

            // Decrypt response
            try {
              const decrypted = await nip04.decrypt(connection.secret, connection.walletPubkey, event.content);
              const response = JSON.parse(decrypted);

              // Check if response has result (successful get_info)
              resolve(!!response.result);
            } catch (_error) {
              this.systemLogger.error('NWCService', 'Failed to decrypt response:', _error);
              resolve(false);
            }
          }
        });

        const timeout = setTimeout(() => {
          sub.close();
          resolve(false);
        }, 5000);
      });
    } catch (_error) {
      this.systemLogger.error('NWCService', 'Test connection failed:', _error);
      return false;
    }
  }

  /**
   * Disconnect from NWC wallet
   * CRITICAL: This is the ONLY method that may delete the stored connection
   */
  public async disconnect(): Promise<void> {
    this.systemLogger.warn('NWCService', '⚠️ DISCONNECT called - removing stored NWC connection');

    this.setConnectionForCurrentUser(null);
    this.setStateForCurrentUser('disconnected');

    // ONLY place where NWC connection may be deleted from KeychainStorage
    try {
      await KeychainStorage.deleteNWC();
      this.systemLogger.info('NWCService', '✓ Stored NWC connection removed from secure storage');
    } catch (_error) {
      this.systemLogger.error('NWCService', 'Failed to remove stored connection:', _error);
    }

    this.systemLogger.info('NWCService', 'Disconnected from NWC wallet');
    ToastService.show('Lightning Wallet getrennt', 'info');
  }

  /**
   * Check if connected to NWC wallet
   * Returns true if connection exists for current user
   */
  public isConnected(): boolean {
    return this.getConnectionForCurrentUser() !== null;
  }

  /**
   * Get current connection state
   */
  public getState(): NWCConnectionState {
    return this.getStateForCurrentUser();
  }

  /**
   * Get wallet pubkey (if connected)
   */
  public getWalletPubkey(): string | null {
    return this.getConnectionForCurrentUser()?.walletPubkey || null;
  }

  /**
   * Get Lightning Address (lud16) from NWC connection (if available)
   */
  public getLightningAddress(): string | null {
    return this.getConnectionForCurrentUser()?.lud16 || null;
  }

  /**
   * Get wallet balance via NWC
   */
  public async getBalance(): Promise<number | null> {
    const connection = this.getConnectionForCurrentUser();
    if (!connection) {
      return null;
    }

    try {
      // Create get_balance request
      const content = JSON.stringify({
        method: 'get_balance',
        params: {}
      });

      // Encrypt content with NIP-04
      const appSecretKey = this.hexToBytes(connection.secret);
      const appPubkey = getPublicKeyFromPrivate(appSecretKey);
      const encryptedContent = await nip04.encrypt(connection.secret, connection.walletPubkey, content);

      // Create NWC request event (kind 23194)
      const event = finalizeEvent({
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', connection.walletPubkey]],
        content: encryptedContent
      }, appSecretKey);

      // Publish to relay
      await this.transport.publish([connection.relay], event);

      // Wait for response (kind 23195) - timeout after 10 seconds
      return new Promise(async (resolve) => {
        const sub = await this.transport.subscribe([connection.relay], [
          {
            kinds: [23195],
            authors: [connection.walletPubkey],
            '#p': [appPubkey],
            since: Math.floor(Date.now() / 1000)
          }
        ], {
          onEvent: async (event: NostrEvent) => {
            // NostrTransport already verified signature
            clearTimeout(timeout);
            sub.close();

            try {
              // Decrypt response
              const decrypted = await nip04.decrypt(connection.secret, connection.walletPubkey, event.content);
              const response = JSON.parse(decrypted);

              if (response.error) {
                this.systemLogger.error('NWCService', 'Get balance failed:', response.error.message);
                resolve(null);
              } else if (response.result && typeof response.result.balance === 'number') {
                // Balance is returned in millisatoshis
                resolve(response.result.balance);
              } else {
                resolve(null);
              }
            } catch (_error) {
              this.systemLogger.error('NWCService', 'Failed to decrypt balance response:', _error);
              resolve(null);
            }
          }
        });

        const timeout = setTimeout(() => {
          sub.close();
          resolve(null);
        }, 10000);
      });
    } catch (_error) {
      this.systemLogger.error('NWCService', 'Get balance failed:', _error);
      return null;
    }
  }

  /**
   * Pay Lightning invoice via NWC
   */
  public async payInvoice(invoice: string): Promise<PayInvoiceResult> {
    const connection = this.getConnectionForCurrentUser();
    if (!connection) {
      return {
        success: false,
        error: 'Not connected to NWC wallet'
      };
    }

    try {
      // Create pay_invoice request
      const content = JSON.stringify({
        method: 'pay_invoice',
        params: {
          invoice
        }
      });

      // Encrypt content with NIP-04
      const appSecretKey = this.hexToBytes(connection.secret);
      const appPubkey = getPublicKeyFromPrivate(appSecretKey);
      const encryptedContent = await nip04.encrypt(connection.secret, connection.walletPubkey, content);

      // Create NWC request event (kind 23194)
      const event = finalizeEvent({
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', connection.walletPubkey]],
        content: encryptedContent
      }, appSecretKey);

      this.systemLogger.info('NWCService', 'Sending pay_invoice request...');

      // Publish to relay
      await this.transport.publish([connection.relay], event);

      // Wait for response (kind 23195) - timeout after 30 seconds
      return new Promise(async (resolve) => {
        const sub = await this.transport.subscribe([connection.relay], [
          {
            kinds: [23195],
            authors: [connection.walletPubkey],
            '#p': [appPubkey],
            since: Math.floor(Date.now() / 1000)
          }
        ], {
          onEvent: async (event: NostrEvent) => {
            // NostrTransport already verified signature
            clearTimeout(timeout);
            sub.close();

            try {
              // Decrypt response
              const decrypted = await nip04.decrypt(connection.secret, connection.walletPubkey, event.content);
              const response = JSON.parse(decrypted);

              if (response.error) {
                this.systemLogger.error('NWCService', 'Payment failed:', response.error.message);
                resolve({
                  success: false,
                  error: response.error.message || 'Payment failed'
                });
              } else if (response.result) {
                // Format payment info for readable log
                const amount = response.result.amount ? Math.floor(response.result.amount / 1000) : 0;
                const fees = response.result.fees_paid ? Math.floor(response.result.fees_paid / 1000) : 0;
                this.systemLogger.info('NWCService', `${amount} Sats sent, ${fees} Sats fees paid`);

                resolve({
                  success: true,
                  preimage: response.result.preimage
                });
              } else {
                resolve({
                  success: false,
                  error: 'Invalid response'
                });
              }
            } catch (_error) {
              this.systemLogger.error('NWCService', 'Failed to decrypt payment response:', _error);
              resolve({
                success: false,
                error: 'Failed to decrypt response'
              });
            }
          }
        });

        const timeout = setTimeout(() => {
          sub.close();
          resolve({
            success: false,
            error: 'Payment timeout'
          });
        }, 30000);
      });
    } catch (_error) {
      this.systemLogger.error('NWCService', 'Payment failed:', _error);
      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save connection to KeychainStorage (per-user)
   */
  private async saveConnection(connectionString: string): Promise<void> {
    try {
      await KeychainStorage.saveNWC(connectionString);
      this.systemLogger.info('NWCService', 'NWC connection saved to secure storage');
    } catch (_error) {
      this.systemLogger.error('NWCService', 'Failed to save connection:', _error);
      throw _error;
    }
  }

  /**
   * Restore connection for current user from KeychainStorage
   * Called on init and can be called when user changes
   */
  public async restoreConnectionForCurrentUser(): Promise<void> {
    const pubkey = this.getCurrentUserPubkey();
    if (!pubkey) return;

    // Already loaded for this user?
    if (this.connections.has(pubkey)) {
      return;
    }

    try {
      const stored = await KeychainStorage.loadNWC(pubkey);

      if (stored) {
        this.systemLogger.info('NWCService', 'Found stored connection, attempting to reconnect...');

        // Parse and store connection
        const connection = this.parseConnectionString(stored);
        this.connections.set(pubkey, connection);

        // Test connection
        const isValid = await this.testConnection(connection);

        if (isValid) {
          this.states.set(pubkey, 'connected');
          this.systemLogger.info('NWCService', 'Auto-reconnected to NWC wallet');
          window.dispatchEvent(new CustomEvent('nwc-connection-restored'));
        } else {
          // Keep connection but mark as error
          this.states.set(pubkey, 'error');
          this.systemLogger.warn('NWCService', 'Failed to auto-reconnect (relay offline?), but connection kept.');
        }
      }
    } catch (_error) {
      this.systemLogger.error('NWCService', 'Failed to restore connection:', _error);
    }
  }

  /**
   * Convert hex string to Uint8Array
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}
