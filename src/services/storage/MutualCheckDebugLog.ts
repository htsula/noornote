/**
 * MutualCheckDebugLog
 * Persistent debug logging for mutual change detection
 *
 * Stores detailed logs in ~/.noornote/{npub}/mutual-check-debug.log
 * Useful for debugging edge cases like the "Mike scenario"
 *
 * @purpose Debug-Analyse für Mutual-Check Edge Cases
 * @used-by MutualChangeDetector
 */

import { SystemLogger } from '../../components/system/SystemLogger';
import { PlatformService } from '../PlatformService';
import { AuthService } from '../AuthService';

// Tauri APIs
let tauriHomeDir: typeof import('@tauri-apps/api/path').homeDir | null = null;
let tauriReadTextFile: typeof import('@tauri-apps/plugin-fs').readTextFile | null = null;
let tauriWriteTextFile: typeof import('@tauri-apps/plugin-fs').writeTextFile | null = null;
let tauriExists: typeof import('@tauri-apps/plugin-fs').exists | null = null;
let tauriMkdir: typeof import('@tauri-apps/plugin-fs').mkdir | null = null;

const platform = PlatformService.getInstance();

if (platform.isTauri) {
  import('@tauri-apps/api/path').then(mod => { tauriHomeDir = mod.homeDir; });
  import('@tauri-apps/plugin-fs').then(mod => {
    tauriReadTextFile = mod.readTextFile;
    tauriWriteTextFile = mod.writeTextFile;
    tauriExists = mod.exists;
    tauriMkdir = mod.mkdir;
  });
}

export interface DebugLogEntry {
  timestamp: string;
  checkId: string;
  event: string;
  data: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 200; // More entries for thorough debugging
const LOG_FILE_NAME = 'mutual-check-debug.log';

export class MutualCheckDebugLog {
  private static instance: MutualCheckDebugLog;
  private systemLogger: SystemLogger;
  private filePath: string | null = null;
  private initialized: boolean = false;
  private currentCheckId: string | null = null;

  private constructor() {
    this.systemLogger = SystemLogger.getInstance();
  }

  public static getInstance(): MutualCheckDebugLog {
    if (!MutualCheckDebugLog.instance) {
      MutualCheckDebugLog.instance = new MutualCheckDebugLog();
    }
    return MutualCheckDebugLog.instance;
  }

  /**
   * Initialize file path
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!platform.isTauri || !tauriHomeDir || !tauriMkdir || !tauriExists) {
      return; // Silently skip in browser
    }

    try {
      const authService = AuthService.getInstance();
      const user = authService.getCurrentUser();
      if (!user?.npub) return;

      const homePath = await tauriHomeDir();
      const userDir = `${homePath}/.noornote/${user.npub}`;

      const dirExists = await tauriExists(userDir);
      if (!dirExists) {
        await tauriMkdir(userDir, { recursive: true });
      }

      this.filePath = `${userDir}/${LOG_FILE_NAME}`;
      this.initialized = true;
    } catch (error) {
      this.systemLogger.error('MutualCheckDebugLog', `Init failed: ${error}`);
    }
  }

  /**
   * Start a new check session (generates unique checkId)
   */
  public startCheck(): string {
    this.currentCheckId = `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.currentCheckId;
  }

  /**
   * Log an event
   */
  public async log(
    event: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.initialize();

    if (!this.filePath || !tauriReadTextFile || !tauriWriteTextFile) {
      return; // Silently skip if not available
    }

    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      checkId: this.currentCheckId || 'unknown',
      event,
      data
    };

    try {
      // Read existing logs
      let logs: DebugLogEntry[] = [];
      try {
        const content = await tauriReadTextFile(this.filePath);
        logs = JSON.parse(content);
      } catch {
        // File doesn't exist or is invalid - start fresh
        logs = [];
      }

      // Append new entry
      logs.push(entry);

      // Keep only last MAX_LOG_ENTRIES
      if (logs.length > MAX_LOG_ENTRIES) {
        logs = logs.slice(-MAX_LOG_ENTRIES);
      }

      // Write back
      await tauriWriteTextFile(this.filePath, JSON.stringify(logs, null, 2));
    } catch (error) {
      this.systemLogger.error('MutualCheckDebugLog', `Write failed: ${error}`);
    }
  }

  /**
   * Log check start with full details
   */
  public async logCheckStart(
    snapshotCount: number,
    followsCount: number,
    snapshotPubkeys?: string[],
    snapshotTimestamp?: number
  ): Promise<void> {
    await this.log('CHECK_START', {
      previousSnapshotMutualCount: snapshotCount,
      previousSnapshotTimestamp: snapshotTimestamp ? new Date(snapshotTimestamp).toISOString() : null,
      previousSnapshotPubkeys: snapshotPubkeys || [],
      currentFollowsCount: followsCount,
      localTime: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
    });
  }

  /**
   * Log relay fetch results
   */
  public async logRelayFetch(
    followsChecked: number,
    mutualsFound: number,
    nonMutualsFound: number,
    fetchDurationMs: number,
    currentMutualPubkeys: string[]
  ): Promise<void> {
    await this.log('RELAY_FETCH_COMPLETE', {
      followsChecked,
      mutualsFound,
      nonMutualsFound,
      fetchDurationMs,
      currentMutualPubkeys
    });
  }

  /**
   * Log comparison details
   */
  public async logComparison(
    previousPubkeys: string[],
    currentPubkeys: string[],
    unfollowPubkeys: string[],
    newMutualPubkeys: string[]
  ): Promise<void> {
    await this.log('COMPARISON_RESULT', {
      previousMutualCount: previousPubkeys.length,
      currentMutualCount: currentPubkeys.length,
      unfollowCount: unfollowPubkeys.length,
      newMutualCount: newMutualPubkeys.length,
      unfollowPubkeys,
      newMutualPubkeys,
      // Show what changed in detail
      removedFromMutuals: unfollowPubkeys,
      addedToMutuals: newMutualPubkeys
    });
  }

  /**
   * Log check complete with full details
   */
  public async logCheckComplete(
    unfollows: string[],
    newMutuals: string[],
    durationMs: number,
    currentMutualCount: number
  ): Promise<void> {
    await this.log('CHECK_COMPLETE', {
      unfollowPubkeys: unfollows,
      newMutualPubkeys: newMutuals,
      unfollowCount: unfollows.length,
      newMutualCount: newMutuals.length,
      totalChanges: unfollows.length + newMutuals.length,
      durationMs,
      currentMutualCount,
      localTime: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
    });
  }

  /**
   * Log unfollow detection with context
   */
  public async logUnfollowDetected(pubkey: string, wasInSnapshot: boolean): Promise<void> {
    await this.log('UNFOLLOW_DETECTED', {
      pubkey,
      wasInPreviousSnapshot: wasInSnapshot,
      detectionTime: new Date().toISOString(),
      localTime: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
    });
  }

  /**
   * Log new mutual detection
   */
  public async logNewMutualDetected(pubkey: string): Promise<void> {
    await this.log('NEW_MUTUAL_DETECTED', {
      pubkey,
      detectionTime: new Date().toISOString(),
      localTime: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
    });
  }

  /**
   * Log notification injection with full event details
   */
  public async logNotificationInjected(
    pubkey: string,
    type: 'mutual_unfollow' | 'mutual_new',
    syntheticEventId: string
  ): Promise<void> {
    await this.log('NOTIFICATION_INJECTED', {
      pubkey,
      notificationType: type,
      syntheticEventId,
      injectionTime: new Date().toISOString(),
      localTime: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
    });
  }

  /**
   * Log snapshot update with before/after comparison
   */
  public async logSnapshotUpdate(
    previousCount: number,
    newCount: number,
    addedPubkeys: string[],
    removedPubkeys: string[]
  ): Promise<void> {
    await this.log('SNAPSHOT_UPDATE', {
      previousMutualCount: previousCount,
      newMutualCount: newCount,
      delta: newCount - previousCount,
      addedPubkeys,
      removedPubkeys,
      updateTime: new Date().toISOString()
    });
  }

  /**
   * Log individual mutual status check result
   */
  public async logMutualStatusCheck(
    pubkey: string,
    isMutual: boolean,
    followsBack: boolean
  ): Promise<void> {
    await this.log('MUTUAL_STATUS_CHECK', {
      pubkey,
      isMutual,
      followsBack
    });
  }

  /**
   * Log error with full context
   */
  public async logError(message: string, details?: Record<string, unknown>): Promise<void> {
    await this.log('ERROR', {
      message,
      errorTime: new Date().toISOString(),
      localTime: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
      ...details
    });
  }

  /**
   * Log scheduler event
   */
  public async logSchedulerEvent(
    event: 'SCHEDULER_START' | 'SCHEDULER_STOP' | 'CHECK_DUE' | 'CHECK_NOT_DUE',
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log(event, {
      schedulerTime: new Date().toISOString(),
      localTime: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
      ...details
    });
  }

  /**
   * Read all logs (for debugging via console)
   */
  public async readLogs(): Promise<DebugLogEntry[]> {
    await this.initialize();

    if (!this.filePath || !tauriReadTextFile) {
      return [];
    }

    try {
      const content = await tauriReadTextFile(this.filePath);
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /**
   * Get file path for manual inspection
   */
  public getFilePath(): string | null {
    return this.filePath;
  }

  /**
   * Clear all logs (for debugging)
   */
  public async clearLogs(): Promise<void> {
    await this.initialize();

    if (!this.filePath || !tauriWriteTextFile) {
      return;
    }

    try {
      await tauriWriteTextFile(this.filePath, JSON.stringify([], null, 2));
      this.systemLogger.info('MutualCheckDebugLog', 'Logs cleared');
    } catch (error) {
      this.systemLogger.error('MutualCheckDebugLog', `Clear failed: ${error}`);
    }
  }
}

// Debug helper for DevTools console
if (typeof window !== 'undefined') {
  (window as any).__MUTUAL_CHECK_DEBUG_LOG__ = {
    readLogs: async () => {
      const log = MutualCheckDebugLog.getInstance();
      const logs = await log.readLogs();
      console.log('=== Mutual Check Debug Logs ===');
      console.log(`File: ${log.getFilePath()}`);
      console.log(`Entries: ${logs.length}`);
      console.log('');

      // Group by checkId for easier reading
      const byCheckId = new Map<string, DebugLogEntry[]>();
      logs.forEach(entry => {
        const existing = byCheckId.get(entry.checkId) || [];
        existing.push(entry);
        byCheckId.set(entry.checkId, existing);
      });

      byCheckId.forEach((entries, checkId) => {
        console.log(`\n========== ${checkId} ==========`);
        entries.forEach(entry => {
          console.log(`[${entry.timestamp}] ${entry.event}`);
          console.log('   Data:', JSON.stringify(entry.data, null, 2));
        });
      });

      return logs;
    },
    getFilePath: () => MutualCheckDebugLog.getInstance().getFilePath(),
    clearLogs: async () => {
      await MutualCheckDebugLog.getInstance().clearLogs();
      console.log('Logs cleared');
    },
    getLastCheck: async () => {
      const log = MutualCheckDebugLog.getInstance();
      const logs = await log.readLogs();
      if (logs.length === 0) {
        console.log('No logs found');
        return null;
      }

      // Find the last CHECK_COMPLETE
      const lastComplete = [...logs].reverse().find(l => l.event === 'CHECK_COMPLETE');
      if (lastComplete) {
        console.log('=== Last Check ===');
        console.log('CheckID:', lastComplete.checkId);
        console.log('Time:', lastComplete.timestamp);
        console.log('Data:', lastComplete.data);

        // Find all entries for this checkId
        const checkLogs = logs.filter(l => l.checkId === lastComplete.checkId);
        console.log('\n=== Full Check Log ===');
        checkLogs.forEach(entry => {
          console.log(`[${entry.event}]`, entry.data);
        });

        return checkLogs;
      }

      return null;
    }
  };
}
