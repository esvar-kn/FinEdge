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
  const { amountCents, updatedAt, recurringRuleId, ...rest } = row;
  return {
    ...rest,
    amount: toAmount(amountCents),
    ...(updatedAt ? { updatedAt } : {}),
    ...(recurringRuleId ? { recurringRuleId } : {})
  };
}

/**
 * Builds the shared WHERE clause + params for user-scoped queries with
 * optional type / category / description-search filters.
 */
function buildFilters(userId, { type, category, q, from, toExclusive } = {}) {
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
    return mapRow(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id));
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

    const categoryRows = db
      .prepare(
        `SELECT LOWER(TRIM(category)) AS category, SUM(amountCents) AS cents
         FROM transactions
         WHERE ${where} AND type = 'expense'
         GROUP BY LOWER(TRIM(category))`
      )
      .all(...params);

    const categoryBreakdown = {};
    for (const row of categoryRows) {
      categoryBreakdown[row.category] = toAmount(row.cents);
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
   * Sum of expenses per category (lowercased) within a date range, in cents —
   * used for budget tracking without float conversion.
   * @param {string} userId
   * @param {Object} range {from, toExclusive}
   * @returns {Promise<Map<string, number>>} category -> cents spent
   */
  static async expenseCentsByCategory(userId, range) {
    const { where, params } = buildFilters(userId, range);
    const rows = db
      .prepare(
        `SELECT LOWER(TRIM(category)) AS category, SUM(amountCents) AS cents
         FROM transactions WHERE ${where} AND type = 'expense'
         GROUP BY LOWER(TRIM(category))`
      )
      .all(...params);
    return new Map(rows.map(r => [r.category, r.cents]));
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
      recurringRuleId: txData.recurringRuleId || null
    };
    db.prepare(
      `INSERT INTO transactions (id, userId, type, category, amountCents, description, date, createdAt, recurringRuleId)
       VALUES (@id, @userId, @type, @category, @amountCents, @description, @date, @createdAt, @recurringRuleId)`
    ).run(row);

    return mapRow({ ...row, updatedAt: null });
  }

  /**
   * Updates a transaction by ID.
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object|null>} The updated record, or null if not found.
   */
  static async update(id, updateData) {
    const info = db
      .prepare(
        `UPDATE transactions
         SET type = @type, category = @category, amountCents = @amountCents,
             description = @description, date = @date, updatedAt = @updatedAt
         WHERE id = @id`
      )
      .run({
        id,
        type: updateData.type,
        category: updateData.category,
        amountCents: toCents(updateData.amount),
        description: updateData.description,
        date: updateData.date,
        updatedAt: new Date().toISOString()
      });

    if (info.changes === 0) return null;
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
