import fs from 'fs';
import path from 'path';
import db from '../db/index.js';
import config from '../config/index.js';

const BACKUP_PREFIX = 'finedge-';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Takes an online snapshot of the SQLite database into the backup directory
 * (one file per calendar day; same-day runs overwrite), then prunes the oldest
 * snapshots beyond config.backupKeep.
 * @returns {Promise<string>} The path of the snapshot written.
 */
export async function runBackup() {
  fs.mkdirSync(config.backupDir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const destPath = path.join(config.backupDir, `${BACKUP_PREFIX}${stamp}.db`);

  // better-sqlite3's backup API copies a consistent snapshot without blocking
  // concurrent reads/writes.
  await db.backup(destPath);

  const snapshots = fs
    .readdirSync(config.backupDir)
    .filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith('.db'))
    .sort(); // YYYY-MM-DD stamps sort chronologically

  for (const stale of snapshots.slice(0, Math.max(snapshots.length - config.backupKeep, 0))) {
    fs.unlinkSync(path.join(config.backupDir, stale));
  }

  return destPath;
}

/**
 * Runs a backup now and then once a day. The interval is unref'd so it never
 * keeps the process alive on its own.
 */
export function scheduleBackups() {
  const safeRun = () =>
    runBackup()
      .then(dest => console.log(`Database backed up to ${dest}`))
      .catch(err => console.error('Database backup failed:', err));

  safeRun();
  setInterval(safeRun, DAY_MS).unref();
}
