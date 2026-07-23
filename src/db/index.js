import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);

// WAL allows concurrent readers alongside a writer; foreign_keys is off by
// default in SQLite and must be enabled per-connection for CASCADE to work.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        TEXT PRIMARY KEY,
    username  TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email     TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password  TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    userId      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category    TEXT NOT NULL,
    amountCents INTEGER NOT NULL CHECK (amountCents > 0),
    description TEXT NOT NULL DEFAULT '',
    date        TEXT NOT NULL,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId);
  CREATE INDEX IF NOT EXISTS idx_transactions_userId_date ON transactions(userId, date);

  CREATE TABLE IF NOT EXISTS budgets (
    id                TEXT PRIMARY KEY,
    userId            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category          TEXT NOT NULL COLLATE NOCASE,
    monthlyLimitCents INTEGER NOT NULL CHECK (monthlyLimitCents > 0),
    createdAt         TEXT NOT NULL,
    updatedAt         TEXT,
    UNIQUE (userId, category)
  );

  CREATE TABLE IF NOT EXISTS recurring_rules (
    id          TEXT PRIMARY KEY,
    userId      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category    TEXT NOT NULL,
    amountCents INTEGER NOT NULL CHECK (amountCents > 0),
    description TEXT NOT NULL DEFAULT '',
    frequency   TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    anchorDay   INTEGER NOT NULL,
    nextRunDate TEXT NOT NULL,
    endDate     TEXT,
    createdAt   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_recurring_userId ON recurring_rules(userId);

  CREATE TABLE IF NOT EXISTS savings_goals (
    id          TEXT PRIMARY KEY,
    userId      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    targetCents INTEGER NOT NULL CHECK (targetCents > 0),
    savedCents  INTEGER NOT NULL DEFAULT 0 CHECK (savedCents >= 0),
    deadline    TEXT,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_goals_userId ON savings_goals(userId);
`);

// Lightweight migrations for databases created before a column existed.
const txColumns = db.prepare("PRAGMA table_info('transactions')").all().map(c => c.name);
if (!txColumns.includes('recurringRuleId')) {
  db.exec('ALTER TABLE transactions ADD COLUMN recurringRuleId TEXT');
}

const userColumns = db.prepare("PRAGMA table_info('users')").all().map(c => c.name);
if (!userColumns.includes('currency')) {
  db.exec("ALTER TABLE users ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
}

export default db;
