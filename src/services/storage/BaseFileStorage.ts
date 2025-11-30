/**
 * BaseFileStorage
 * Abstract base class for file-based storage using Tauri FS API
 *
 * Provides common functionality for storing data in ~/.noornote/{npub}/ directory:
 * - Per-user file paths (each user has their own directory)
 * - Tauri environment detection
 * - Dynamic Tauri API imports
 * - Directory creation
 * - File initialization
 * - JSON read/write with error handling
 *
 * Usage: Extend this class and implement abstract methods
 */

import { SystemLogger } from '../../components/system/SystemLogger';
import { PlatformService } from '../PlatformService';
import { AuthService } from '../AuthService';

// Tauri APIs (dynamically imported to support browser builds)
let tauriHomeDir: typeof import('@tauri-apps/api/path').homeDir | null = null;
let tauriReadTextFile: typeof import('@tauri-apps/plugin-fs').readTextFile | null = null;
let tauriWriteTextFile: typeof import('@tauri-apps/plugin-fs').writeTextFile | null = null;
let tauriExists: typeof import('@tauri-apps/plugin-fs').exists | null = null;
let tauriMkdir: typeof import('@tauri-apps/plugin-fs').mkdir | null = null;

const platform = PlatformService.getInstance();

/**
 * Load Tauri APIs if available
 */
if (platform.isTauri) {
  import('@tauri-apps/api/path').then(mod => { tauriHomeDir = mod.homeDir; });
  import('@tauri-apps/plugin-fs').then(mod => {
    tauriReadTextFile = mod.readTextFile;
    tauriWriteTextFile = mod.writeTextFile;
    tauriExists = mod.exists;
    tauriMkdir = mod.mkdir;
  });
}

/**
 * Base interface for all file storage data
 */
export interface BaseFileData {
  lastModified: number;
  lastPublishedEventId?: string;
}

/**
 * Abstract base class for file storage
 */
export abstract class BaseFileStorage<T extends BaseFileData> {
  protected systemLogger: SystemLogger;
  protected filePath: string | null = null;
  protected fileInitialized: boolean = false;
  protected currentUserNpub: string | null = null;

  constructor() {
    this.systemLogger = SystemLogger.getInstance();
  }

  /**
   * Get current user's npub for per-user file paths
   */
  protected getCurrentUserNpub(): string | null {
    try {
      const authService = AuthService.getInstance();
      const user = authService.getCurrentUser();
      return user?.npub || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if user context changed and needs reinitialization
   */
  protected userContextChanged(): boolean {
    const currentNpub = this.getCurrentUserNpub();
    return currentNpub !== this.currentUserNpub;
  }

  /**
   * Reset initialization state (called when user changes)
   */
  protected resetInitialization(): void {
    this.filePath = null;
    this.fileInitialized = false;
    this.currentUserNpub = null;
  }

  /**
   * Get the filename for this storage (e.g., 'mutes-public.json')
   * @abstract Must be implemented by subclass
   */
  protected abstract getFileName(): string;

  /**
   * Get default data structure when file doesn't exist
   * @abstract Must be implemented by subclass
   */
  protected abstract getDefaultData(): T;

  /**
   * Get the logger name for this storage (e.g., 'MuteFileStorage')
   * @abstract Must be implemented by subclass
   */
  protected abstract getLoggerName(): string;

  /**
   * Migrate data from old format to new format (optional)
   * Override in subclass to handle schema migrations
   * @param data Raw data read from file
   * @returns Migrated data
   */
  protected migrateData(data: T): T {
    return data; // Default: no migration
  }

  /**
   * Initialize file path (must be called before any file operations)
   * Uses per-user directory: ~/.noornote/{npub}/filename.json
   */
  public async initialize(): Promise<void> {
    // Check if user changed - if so, reinitialize
    if (this.fileInitialized && this.userContextChanged()) {
      this.systemLogger.info(this.getLoggerName(), 'User context changed, reinitializing...');
      this.resetInitialization();
    }

    if (this.fileInitialized) return;

    if (!platform.isTauri) {
      throw new Error(`${this.getLoggerName()} requires Tauri environment`);
    }

    if (!tauriHomeDir || !tauriMkdir) {
      throw new Error('Tauri path API not loaded');
    }

    // Get current user's npub for per-user directory
    const userNpub = this.getCurrentUserNpub();
    if (!userNpub) {
      throw new Error(`${this.getLoggerName()} requires logged-in user`);
    }

    try {
      const homePath = await tauriHomeDir();
      const noornoteBaseDir = `${homePath}/.noornote`;
      const userDir = `${noornoteBaseDir}/${userNpub}`;

      if (!tauriExists) {
        throw new Error('Tauri fs API not loaded');
      }

      // Create ~/.noornote/{npub} directory if it doesn't exist
      const dirExists = await tauriExists(userDir);
      if (!dirExists) {
        await tauriMkdir(userDir, { recursive: true });
        this.systemLogger.info(this.getLoggerName(), `Created user directory: ${userDir}`);
      }

      this.filePath = `${userDir}/${this.getFileName()}`;
      this.currentUserNpub = userNpub;
      this.fileInitialized = true;

      this.systemLogger.info(this.getLoggerName(), `Initialized: ${this.filePath}`);

      // Create file if it doesn't exist
      await this.ensureFileExists();
    } catch (error) {
      this.systemLogger.error(this.getLoggerName(), `Failed to initialize: ${error}`);
      throw error;
    }
  }

  /**
   * Ensure file exists, create with defaults if not
   */
  protected async ensureFileExists(): Promise<void> {
    if (!this.filePath || !tauriExists || !tauriWriteTextFile) {
      throw new Error('File system not initialized');
    }

    try {
      const fileExists = await tauriExists(this.filePath);

      if (!fileExists) {
        this.systemLogger.info(this.getLoggerName(), `Creating ${this.getFileName()} with defaults`);

        const defaultData = this.getDefaultData();
        await tauriWriteTextFile(this.filePath, JSON.stringify(defaultData, null, 2));
      }
    } catch (error) {
      this.systemLogger.error(this.getLoggerName(), `Failed to ensure file exists: ${error}`);
      throw error;
    }
  }

  /**
   * Read data from file
   */
  public async read(): Promise<T> {
    // Reinitialize if user changed or not initialized
    if (!this.fileInitialized || this.userContextChanged()) {
      await this.initialize();
    }

    if (!this.filePath || !tauriReadTextFile) {
      throw new Error('File system not initialized');
    }

    try {
      const content = await tauriReadTextFile(this.filePath);
      const rawData: T = JSON.parse(content);

      // Apply migrations (e.g., add new fields)
      const data = this.migrateData(rawData);

      this.systemLogger.info(this.getLoggerName(), `Read data from ${this.getFileName()}`);
      return data;
    } catch (error) {
      this.systemLogger.error(this.getLoggerName(), `Failed to read data: ${error}`);
      // Return defaults on error (never crash)
      return this.getDefaultData();
    }
  }

  /**
   * Write data to file
   */
  public async write(data: T): Promise<void> {
    // Reinitialize if user changed or not initialized
    if (!this.fileInitialized || this.userContextChanged()) {
      await this.initialize();
    }

    if (!this.filePath || !tauriWriteTextFile) {
      throw new Error('File system not initialized');
    }

    try {
      // Update lastModified timestamp
      data.lastModified = Math.floor(Date.now() / 1000);
      await tauriWriteTextFile(this.filePath, JSON.stringify(data, null, 2));
      this.systemLogger.info(this.getLoggerName(), `Wrote data to ${this.getFileName()}`);
    } catch (error) {
      this.systemLogger.error(this.getLoggerName(), `Failed to write data: ${error}`);
      throw error;
    }
  }

  /**
   * Get file path (for debugging/manual access)
   */
  public getFilePath(): string | null {
    return this.filePath;
  }
}
