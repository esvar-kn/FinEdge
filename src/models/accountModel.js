import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

// Account balances are integer-cents like every other money value, so the
// opening balance and all flows combine without float drift.
const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const toAmount = (cents) => cents / 100;

/**
 * Maps a raw account row to the API shape. `balanceCents`, when supplied by
 * withBalances(), is a derived figure (opening balance + flows) and is exposed
 * as a decimal `balance`.
 */
function mapRow(row, balanceCents) {
  if (!row) return null;
  const { openingBalanceCents, archived, updatedAt, ...rest } = row;
  return {
    ...rest,
    openingBalance: toAmount(openingBalanceCents),
    archived: !!archived,
    ...(balanceCents !== undefined ? { balance: toAmount(balanceCents) } : {}),
    ...(updatedAt ? { updatedAt } : {})
  };
}

class AccountModel {
  /**
   * Accounts for a user, oldest first.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async findByUserId(userId) {
    return db
      .prepare('SELECT * FROM accounts WHERE userId = ? ORDER BY createdAt ASC')
      .all(userId)
      .map((r) => mapRow(r));
  }

  /**
   * Accounts for a user with a derived `balance` folded in: opening balance
   * plus income, minus expenses, plus transfers in, minus transfers out.
   * Aggregates are computed in SQL over integer cents.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async withBalances(userId) {
    const accounts = db
      .prepare('SELECT * FROM accounts WHERE userId = ? ORDER BY createdAt ASC')
      .all(userId);

    const txRows = db
      .prepare(
        `SELECT accountId,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amountCents END), 0) AS inc,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amountCents END), 0) AS exp
         FROM transactions
         WHERE userId = ? AND accountId IS NOT NULL
         GROUP BY accountId`
      )
      .all(userId);
    const txByAccount = new Map(txRows.map((r) => [r.accountId, r]));

    const outRows = db
      .prepare('SELECT fromAccountId AS id, SUM(amountCents) AS cents FROM transfers WHERE userId = ? GROUP BY fromAccountId')
      .all(userId);
    const inRows = db
      .prepare('SELECT toAccountId AS id, SUM(amountCents) AS cents FROM transfers WHERE userId = ? GROUP BY toAccountId')
      .all(userId);
    const outByAccount = new Map(outRows.map((r) => [r.id, r.cents]));
    const inByAccount = new Map(inRows.map((r) => [r.id, r.cents]));

    return accounts.map((a) => {
      const tx = txByAccount.get(a.id) || { inc: 0, exp: 0 };
      const balanceCents =
        a.openingBalanceCents +
        tx.inc -
        tx.exp +
        (inByAccount.get(a.id) || 0) -
        (outByAccount.get(a.id) || 0);
      return mapRow(a, balanceCents);
    });
  }

  /**
   * Finds an account by id (no balance).
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    return mapRow(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id));
  }

  /**
   * Counts rows that reference an account, so a delete can refuse to orphan
   * history. Transactions can be reassigned; transfers cannot.
   * @param {string} id
   * @returns {Promise<{transactions: number, transfers: number}>}
   */
  static async countReferences(id) {
    const { n: transactions } = db
      .prepare('SELECT COUNT(*) AS n FROM transactions WHERE accountId = ?')
      .get(id);
    const { n: transfers } = db
      .prepare('SELECT COUNT(*) AS n FROM transfers WHERE fromAccountId = ? OR toAccountId = ?')
      .get(id, id);
    return { transactions, transfers };
  }

  /**
   * Creates an account.
   * @param {Object} data {userId, name, type, openingBalance?}
   * @returns {Promise<Object>}
   */
  static async create(data) {
    const row = {
      id: uuidv4(),
      userId: data.userId,
      name: data.name,
      type: data.type,
      openingBalanceCents: data.openingBalance !== undefined ? toCents(data.openingBalance) : 0,
      createdAt: new Date().toISOString()
    };
    db.prepare(
      `INSERT INTO accounts (id, userId, name, type, openingBalanceCents, createdAt)
       VALUES (@id, @userId, @name, @type, @openingBalanceCents, @createdAt)`
    ).run(row);
    return this.findById(row.id);
  }

  /**
   * Updates an account's mutable fields (any subset of name/type/openingBalance/archived).
   * @param {string} id
   * @param {Object} fields
   * @returns {Promise<Object|null>}
   */
  static async update(id, fields) {
    const current = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!current) return null;

    const merged = {
      name: fields.name !== undefined ? fields.name : current.name,
      type: fields.type !== undefined ? fields.type : current.type,
      openingBalanceCents:
        fields.openingBalance !== undefined ? toCents(fields.openingBalance) : current.openingBalanceCents,
      archived: fields.archived !== undefined ? (fields.archived ? 1 : 0) : current.archived,
      updatedAt: new Date().toISOString(),
      id
    };
    db.prepare(
      `UPDATE accounts
       SET name = @name, type = @type, openingBalanceCents = @openingBalanceCents,
           archived = @archived, updatedAt = @updatedAt
       WHERE id = @id`
    ).run(merged);
    return this.findById(id);
  }

  /**
   * Reassigns every transaction on one account to another (used when deleting
   * an account whose history should be kept elsewhere).
   * @param {string} fromId
   * @param {string|null} toId
   * @returns {Promise<number>} rows changed
   */
  static async reassignTransactions(fromId, toId) {
    const info = db
      .prepare('UPDATE transactions SET accountId = ? WHERE accountId = ?')
      .run(toId, fromId);
    return info.changes;
  }

  /**
   * Deletes an account.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const info = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

export default AccountModel;
