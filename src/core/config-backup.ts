/**
 * FamilyDashBoard — Config Auto-Backup to IndexedDB (S60)
 *
 * Periodically snapshots the current config into IndexedDB for disaster recovery.
 * Keeps the last 3 backups (rotating). Provides restore capability when
 * localStorage is cleared or corrupted.
 */

import { idbSet, idbGet } from "./idb-cache";
import { loadConfig } from "./config";
import { diagLog } from "./diag";
import type { DashboardConfig } from "../types/config";

const IDB_BACKUP_KEY = "config-backup";
const MAX_BACKUPS = 3;

export interface ConfigBackupEntry {
  config: DashboardConfig;
  ts: number;
}

/**
 * Save the current config as a backup in IDB.
 * Maintains a rotating list of up to MAX_BACKUPS entries.
 */
export async function backupConfigToIdb(): Promise<void> {
  try {
    const config = loadConfig();
    const existing = (await idbGet<ConfigBackupEntry[]>(IDB_BACKUP_KEY)) ?? [];
    const entry: ConfigBackupEntry = { config, ts: Date.now() };
    const updated = [entry, ...existing].slice(0, MAX_BACKUPS);
    await idbSet(IDB_BACKUP_KEY, updated);
    diagLog("[config-backup] Snapshot saved to IDB");
  } catch {
    diagLog("[config-backup] Failed to backup config");
  }
}

/**
 * Retrieve all stored config backups from IDB, newest first.
 * Returns empty array if none exist or IDB is unavailable.
 */
export async function getConfigBackups(): Promise<ConfigBackupEntry[]> {
  try {
    return (await idbGet<ConfigBackupEntry[]>(IDB_BACKUP_KEY)) ?? [];
  } catch {
    return [];
  }
}

/**
 * Restore config from the most recent IDB backup.
 * Returns the restored config or null if no backup exists.
 */
export async function restoreConfigFromIdb(): Promise<DashboardConfig | null> {
  const backups = await getConfigBackups();
  if (backups.length === 0) return null;
  const latest = backups[0];
  if (!latest) return null;
  diagLog(`[config-backup] Restoring from backup ts=${latest.ts}`);
  return latest.config;
}

let _backupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic config backups (every 5 minutes).
 * Safe to call multiple times — only one interval runs.
 */
export function startConfigAutoBackup(intervalMs = 5 * 60 * 1000): void {
  if (_backupInterval !== null) return;
  // Initial backup on next idle
  void backupConfigToIdb();
  _backupInterval = setInterval(() => void backupConfigToIdb(), intervalMs);
  diagLog("[config-backup] Auto-backup started");
}

/**
 * Stop the periodic backup interval (for cleanup/testing).
 */
export function stopConfigAutoBackup(): void {
  if (_backupInterval !== null) {
    clearInterval(_backupInterval);
    _backupInterval = null;
  }
}
