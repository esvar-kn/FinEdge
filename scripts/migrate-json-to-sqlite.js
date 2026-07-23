/**
 * One-time import of the legacy JSON stores (src/data/users.json,
 * src/data/transactions.json) into the SQLite database. Safe to re-run:
 * records whose ids already exist are skipped (INSERT OR IGNORE).
 *
 * Usage: npm run migrate:json
 */
import fs from 'fs/promises';
import db from '../src/db/index.js';
import config from '../src/config/index.js';

async function readJsonArray(filePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

const users = await readJsonArray(config.usersDbPath);
const transactions = await readJsonArray(config.transactionsDbPath);

const insertUser = db.prepare(
  `INSERT OR IGNORE INTO users (id, username, email, password, createdAt)
   VALUES (@id, @username, @email, @password, @createdAt)`
);
const insertTx = db.prepare(
  `INSERT OR IGNORE INTO transactions (id, userId, type, category, amountCents, description, date, createdAt, updatedAt)
   VALUES (@id, @userId, @type, @category, @amountCents, @description, @date, @createdAt, @updatedAt)`
);

const result = db.transaction(() => {
  let usersImported = 0;
  let txImported = 0;

  for (const u of users) {
    const info = insertUser.run({
      id: u.id,
      username: u.username,
      email: u.email,
      password: u.password,
      createdAt: u.createdAt || new Date().toISOString()
    });
    usersImported += info.changes;
  }

  for (const t of transactions) {
    const info = insertTx.run({
      id: t.id,
      userId: t.userId,
      type: t.type,
      category: t.category,
      amountCents: Math.round(parseFloat(t.amount) * 100),
      description: t.description || '',
      date: t.date || t.createdAt || new Date().toISOString(),
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || null
    });
    txImported += info.changes;
  }

  return { usersImported, txImported };
})();

console.log(
  `Imported ${result.usersImported}/${users.length} users and ` +
  `${result.txImported}/${transactions.length} transactions into ${config.dbPath}`
);
