/**
 * @interface ListStorageAdapter
 * @purpose Generic adapter for list storage operations across Browser/File/Relays
 * @used-by ListSyncManager
 */

export interface SyncDiff<T> {
  added: T[];
  removed: T[];
  unchanged: T[];
}

/**
 * Result from fetchFromRelays including metadata about the relay event
 * Used to detect if another client (without private support) overwrote the event
 */
export interface FetchFromRelaysResult<T> {
  items: T[];
  /**
   * True if relay event's content field was empty/whitespace
   * Indicates another client without private item support may have overwritten
   * In this case, local private items should be preserved during sync
   */
  relayContentWasEmpty: boolean;
}

export interface ListStorageAdapter<T> {
  /**
   * Get unique identifier for an item (used for comparison)
   */
  getItemId(item: T): string;

  /**
   * Browser Storage Operations (Runtime)
   */
  getBrowserItems(): T[];
  setBrowserItems(items: T[]): void;

  /**
   * File Storage Operations (Persistent Local: ~/.noornote/*.json)
   */
  getFileItems(): Promise<T[]>;
  setFileItems(items: T[]): Promise<void>;

  /**
   * Relay Storage Operations (Remote: User's Write-Relays)
   *
   * fetchFromRelays returns items AND metadata about whether content was empty
   * (to handle mixed-client private item edge case - see LIST-MANAGEMENT-SPEC.md)
   */
  fetchFromRelays(): Promise<FetchFromRelaysResult<T>>;
  publishToRelays(items: T[]): Promise<void>;
}
