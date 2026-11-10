import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

// Amounts are stored as integer cents so aggregation is exact (no float drift).
// The API boundary stays decimal: callers pass/receive amounts like 250.75.
const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const toAmount = (cents) => cents / 100;

// Whitelist of sortable fields -> actual column, since ORDER BY can't be
// parameterized.
const SORT_COLUMNS = {
  date: 'date',
  amount: 'amountCents',
  category: 'category',
  createdAt: 'createdAt'
};

function mapRow(row) {
  if (!row) return null;
  const { amountCents, updatedAt, recurringRuleId, accountId, receipt, ...rest } = row;
  return {
    ...rest,
    amount: toAmount(amountCents),
    ...(updatedAt ? { updatedAt } : {}),
    ...(recurringRuleId ? { recurringRuleId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(receipt ? { receipt } : {})
  };
}

/**
 * Attaches `tags` (string[]) and `splits` ([{category, amount}]) to already-
 * mapped rows, batched by id. Only non-empty arrays are attached, so a plain
 * transaction keeps its original shape.
 */
function attachTagsSplits(rows) {
  if (rows.length === 0) return rows;
  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const tagRows = db
    .prepare(`SELECT transactionId, tag FROM transaction_tags WHERE transactionId IN (${placeholders}) ORDER BY tag`)
    .all(...ids);
  const splitRows = db
    .prepare(`SELECT transactionId, category, amountCents FROM transaction_splits WHERE transactionId IN (${placeholders})`)
    .all(...ids);

  const tagsBy = new Map();
  for (const t of tagRows) {
    if (!tagsBy.has(t.transactionId)) tagsBy.set(t.transactionId, []);
    tagsBy.get(t.transactionId).push(t.tag);
  }
  const splitsBy = new Map();
  for (const s of splitRows) {
    if (!splitsBy.has(s.transactionId)) splitsBy.set(s.transactionId, []);
    splitsBy.get(s.transactionId).push({ category: s.category, amount: toAmount(s.amountCents) });
  }

  for (const r of rows) {
    const tags = tagsBy.get(r.id);
    const splits = splitsBy.get(r.id);
    if (tags && tags.length) r.tags = tags;
    if (splits && splits.length) r.splits = splits;
  }
  return rows;
}

/** Writes a transaction's tags and splits inside the caller's db transaction. */
function writeTagsSplits(transactionId, tags, splits) {
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      db.prepare('INSERT OR IGNORE INTO transaction_tags (transactionId, tag) VALUES (?, ?)')
        .run(transactionId, String(tag).toLowerCase().trim());
    }
  }
  if (Array.isArray(splits)) {
    for (const s of splits) {
      db.prepare('INSERT INTO transaction_splits (id, transactionId, category, amountCents) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), transactionId, s.category, toCents(s.amount));
    }
  }
}

/**
 * Builds the shared WHERE clause + params for user-scoped queries with
 * optional type / category / description-search filters.
 */
function buildFilters(userId, { type, category, q, from, toExclusive, accountId, tag } = {}) {
  const clauses = ['userId = ?'];
  const params = [userId];

  if (type) {
    clauses.push('LOWER(type) = LOWER(?)');
    params.push(type);
  }
  if (category) {
    clauses.push('LOWER(TRIM(category)) = LOWER(TRIM(?))');
    params.push(category);
  }
  if (accountId) {
    clauses.push('accountId = ?');
    params.push(accountId);
  }
  if (tag) {
    clauses.push('EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transactionId = transactions.id AND tt.tag = ?)');
    params.push(String(tag).toLowerCase().trim());
  }
  if (q) {
    // Escape LIKE wildcards so a literal % or _ in the search term matches itself.
    clauses.push("description LIKE ? ESCAPE '\\'");
    params.push(`%${String(q).replace(/[\\%_]/g, '\\$&')}%`);
  }
  // Dates are normalized ISO strings, so lexicographic comparison is correct.
  if (from) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (toExclusive) {
    clauses.push('date < ?');
    params.push(toExclusive);
  }

  return { where: clauses.join(' AND '), params };
}

class TransactionModel {
  /**
   * Finds a transaction by id.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const row = mapRow(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id));
    return row ? attachTagsSplits([row])[0] : null;
  }

  /**
   * Retrieves a user's transactions with optional filters, sorting, and
   * pagination. Returns { transactions, total } where total counts all rows
   * matching the filters (ignoring limit/offset).
   * @param {string} userId
   * @param {Object} options {type, category, q, sort, order, limit, offset}
   * @returns {Promise<{transactions: Array<Object>, total: number}>}
   */
  static async findByUserId(userId, options = {}) {
    const { where, params } = buildFilters(userId, options);

    const sortColumn = SORT_COLUMNS[options.sort] || 'date';
    const direction = String(options.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM transactions WHERE ${where}`)
      .get(...params);

    let sql = `SELECT * FROM transactions WHERE ${where} ORDER BY ${sortColumn} ${direction}, createdAt ${direction}`;
    const pageParams = [...params];
    if (Number.isInteger(options.limit) && options.limit > 0) {
      sql += ' LIMIT ? OFFSET ?';
      pageParams.push(options.limit, options.offset || 0);
    }

    const transactions = db.prepare(sql).all(...pageParams).map(mapRow);
    attachTagsSplits(transactions);
    return { transactions, total };
  }

  /**
   * Computes exact financial aggregates in SQL (integer-cents arithmetic),
   * optionally restricted to a date range.
   * @param {string} userId
   * @param {Object} [range] {from, toExclusive} ISO strings
   * @returns {Promise<Object>} {totalIncome, totalExpenses, netBalance, categoryBreakdown}
   */
  static async summarize(userId, range = {}) {
    const { where, params } = buildFilters(userId, range);

    const totals = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'income' THEN amountCents END), 0) AS incomeCents,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amountCents END), 0) AS expenseCents
         FROM transactions WHERE ${where}`
      )
      .get(...params);

    const byCategory = TransactionModel.expenseCentsByCategorySync(userId, range);
    const categoryBreakdown = {};
    for (const [category, cents] of byCategory) {
      categoryBreakdown[category] = toAmount(cents);
    }

    return {
      totalIncome: toAmount(totals.incomeCents),
      totalExpenses: toAmount(totals.expenseCents),
      netBalance: toAmount(totals.incomeCents - totals.expenseCents),
      categoryBreakdown
    };
  }

  /**
   * Per-month income/expense totals over the given months (oldest first),
   * with empty months filled in so charts get a continuous series.
   * @param {string} userId
   * @param {number} months
   * @returns {Promise<Array<{month: string, income: number, expenses: number}>>}
   */
  static async monthlyTrend(userId, months) {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCMonth(start.getUTCMonth() - (months - 1));

    const rows = db
      .prepare(
        `SELECT SUBSTR(date, 1, 7) AS month,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amountCents END), 0) AS incomeCents,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amountCents END), 0) AS expenseCents
         FROM transactions
         WHERE userId = ? AND date >= ?
         GROUP BY SUBSTR(date, 1, 7)`
      )
      .all(userId, start.toISOString());

    const byMonth = new Map(rows.map(r => [r.month, r]));
    const trend = [];
    for (let i = 0; i < months; i++) {
      const cursor = new Date(start);
      cursor.setUTCMonth(cursor.getUTCMonth() + i);
      const month = cursor.toISOString().slice(0, 7);
      const row = byMonth.get(month);
      trend.push({
        month,
        income: toAmount(row ? row.incomeCents : 0),
        expenses: toAmount(row ? row.expenseCents : 0)
      });
    }
    return trend;
  }

  /**
   * Per-month income/expense totals for a calendar year (12 rows, empty months
   * zero-filled), plus the year's total income/expense and expense-by-category.
   * @param {string} userId
   * @param {number} year
   * @returns {Promise<Object>}
   */
  static async yearReport(userId, year) {
    const from = `${year}-01-01T00:00:00.000Z`;
    const toExclusive = `${year + 1}-01-01T00:00:00.000Z`;

    const monthRows = db
      .prepare(
        `SELECT SUBSTR(date, 6, 2) AS mm,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amountCents END), 0) AS incomeCents,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amountCents END), 0) AS expenseCents
         FROM transactions
         WHERE userId = ? AND date >= ? AND date < ?
         GROUP BY SUBSTR(date, 6, 2)`
      )
      .all(userId, from, toExclusive);

    const byMonth = new Map(monthRows.map(r => [r.mm, r]));
    const months = [];
    let incomeCents = 0;
    let expenseCents = 0;
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const row = byMonth.get(mm);
      const inc = row ? row.incomeCents : 0;
      const exp = row ? row.expenseCents : 0;
      incomeCents += inc;
      expenseCents += exp;
      months.push({ month: `${year}-${mm}`, income: toAmount(inc), expenses: toAmount(exp) });
    }

    const categoryBreakdown = {};
    for (const [category, cents] of TransactionModel.expenseCentsByCategorySync(userId, { from, toExclusive })) {
      categoryBreakdown[category] = toAmount(cents);
    }

    return {
      year,
      totalIncome: toAmount(incomeCents),
      totalExpenses: toAmount(expenseCents),
      netBalance: toAmount(incomeCents - expenseCents),
      months,
      categoryBreakdown
    };
  }

  /**
   * Sum of expenses per category (lowercased) within a date range, in cents —
   * used for budget tracking without float conversion.
   * @param {string} userId
   * @param {Object} range {from, toExclusive}
   * @returns {Promise<Map<string, number>>} category -> cents spent
   */
  static async expenseCentsByCategory(userId, range) {
    return TransactionModel.expenseCentsByCategorySync(userId, range);
  }

  /**
   * Split-aware expense-cents-by-category for a date range (synchronous).
   * A transaction with splits contributes through its split rows; a transaction
   * without splits contributes its own category/amount. Totals are unaffected —
   * splits only re-slice how an expense is attributed across categories.
   * @param {string} userId
   * @param {Object} [range] {from, toExclusive} ISO strings
   * @returns {Map<string, number>} lowercased category -> cents
   */
  static expenseCentsByCategorySync(userId, range = {}) {
    const dateClauses = [];
    const dateParams = [];
    if (range.from) { dateClauses.push('t.date >= ?'); dateParams.push(range.from); }
    if (range.toExclusive) { dateClauses.push('t.date < ?'); dateParams.push(range.toExclusive); }
    const dateWhere = dateClauses.length ? ' AND ' + dateClauses.join(' AND ') : '';

    const rows = db
      .prepare(
        `SELECT cat AS category, SUM(cents) AS cents FROM (
           SELECT LOWER(TRIM(t.category)) AS cat, t.amountCents AS cents
           FROM transactions t
           WHERE t.userId = ? AND t.type = 'expense'${dateWhere}
             AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transactionId = t.id)
           UNION ALL
           SELECT LOWER(TRIM(s.category)) AS cat, s.amountCents AS cents
           FROM transaction_splits s JOIN transactions t ON t.id = s.transactionId
           WHERE t.userId = ? AND t.type = 'expense'${dateWhere}
         ) GROUP BY cat`
      )
      .all(userId, ...dateParams, userId, ...dateParams);
    return new Map(rows.map(r => [r.category, r.cents]));
  }

  /**
   * Expense cents grouped by month and lowercased category over an ISO range —
   * used to compute envelope-rollover carry-over across prior months.
   * @param {string} userId
   * @param {string} fromIso inclusive
   * @param {string} toExclusiveIso exclusive
   * @returns {Promise<Array<{month: string, category: string, cents: number}>>}
   */
  static async monthlyExpenseCentsByCategory(userId, fromIso, toExclusiveIso) {
    return db
      .prepare(
        `SELECT month, cat AS category, SUM(cents) AS cents FROM (
           SELECT SUBSTR(t.date, 1, 7) AS month, LOWER(TRIM(t.category)) AS cat, t.amountCents AS cents
           FROM transactions t
           WHERE t.userId = ? AND t.type = 'expense' AND t.date >= ? AND t.date < ?
             AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transactionId = t.id)
           UNION ALL
           SELECT SUBSTR(t.date, 1, 7) AS month, LOWER(TRIM(s.category)) AS cat, s.amountCents AS cents
           FROM transaction_splits s JOIN transactions t ON t.id = s.transactionId
           WHERE t.userId = ? AND t.type = 'expense' AND t.date >= ? AND t.date < ?
         ) GROUP BY month, cat`
      )
      .all(userId, fromIso, toExclusiveIso, userId, fromIso, toExclusiveIso);
  }

  /**
   * Creates and persists a transaction record.
   * @param {Object} txData
   * @returns {Promise<Object>}
   */
  static async create(txData) {
    const row = {
      id: uuidv4(),
      userId: txData.userId,
      type: txData.type, // 'income' or 'expense'
      category: txData.category,
      amountCents: toCents(txData.amount),
      description: txData.description || '',
      date: txData.date || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      recurringRuleId: txData.recurringRuleId || null,
      accountId: txData.accountId || null
    };
    // Insert the transaction and its tags/splits atomically.
    db.transaction(() => {
      db.prepare(
        `INSERT INTO transactions (id, userId, type, category, amountCents, description, date, createdAt, recurringRuleId, accountId)
         VALUES (@id, @userId, @type, @category, @amountCents, @description, @date, @createdAt, @recurringRuleId, @accountId)`
      ).run(row);
      writeTagsSplits(row.id, txData.tags, txData.splits);
    })();

    return this.findById(row.id);
  }

  /**
   * Updates a transaction by ID.
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object|null>} The updated record, or null if not found.
   */
  static async update(id, updateData) {
    let changed = 0;
    db.transaction(() => {
      const info = db
        .prepare(
          `UPDATE transactions
           SET type = @type, category = @category, amountCents = @amountCents,
               description = @description, date = @date, accountId = @accountId,
               updatedAt = @updatedAt
           WHERE id = @id`
        )
        .run({
          id,
          type: updateData.type,
          category: updateData.category,
          amountCents: toCents(updateData.amount),
          description: updateData.description,
          date: updateData.date,
          accountId: updateData.accountId || null,
          updatedAt: new Date().toISOString()
        });
      changed = info.changes;
      if (changed === 0) return;

      // Replace tags/splits only when the caller supplied them (undefined = leave as-is).
      if (updateData.tags !== undefined) {
        db.prepare('DELETE FROM transaction_tags WHERE transactionId = ?').run(id);
        writeTagsSplits(id, updateData.tags, undefined);
      }
      if (updateData.splits !== undefined) {
        db.prepare('DELETE FROM transaction_splits WHERE transactionId = ?').run(id);
        writeTagsSplits(id, undefined, updateData.splits);
      }
    })();

    if (changed === 0) return null;
    return this.findById(id);
  }

  /**
   * Sets (or clears, with null) a transaction's receipt filename.
   * @param {string} id
   * @param {string|null} filename
   * @returns {Promise<Object|null>}
   */
  static async setReceipt(id, filename) {
    db.prepare('UPDATE transactions SET receipt = ?, updatedAt = ? WHERE id = ?')
      .run(filename, new Date().toISOString(), id);
    return this.findById(id);
  }

  /**
   * Deletes a transaction by ID.
   * @param {string} id
   * @returns {Promise<boolean>} True if a record was removed.
   */
  static async delete(id) {
    const info = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

export default TransactionModel;
