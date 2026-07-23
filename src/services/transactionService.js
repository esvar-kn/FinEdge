import TransactionModel from '../models/transactionModel.js';
import BudgetService from './budgetService.js';
import RecurringService from './recurringService.js';
import CategoryService from './categoryService.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateInsights } from '../utils/insightHelper.js';
import { normalizeDate, monthRange, currentMonth } from '../utils/dates.js';
import { toCSV, parseCSV } from '../utils/csv.js';

const CSV_HEADERS = ['id', 'type', 'category', 'amount', 'description', 'date'];

class TransactionService {
  /**
   * Computes financial summaries, budget status, and insights. Aggregation
   * happens in SQL over integer cents, so the totals are exact.
   * When `month` (YYYY-MM) is given the summary covers only that month;
   * budget status always refers to a single month (the requested one, or the
   * current one for all-time summaries).
   * @param {string} userId
   * @param {string} [month]
   * @returns {Promise<Object>}
   */
  static async getFinancialSummary(userId, month) {
    await RecurringService.materializeDueRules(userId);

    const range = month ? monthRange(month) : {};
    const summary = await TransactionModel.summarize(userId, range);

    const budgetMonth = month || currentMonth();
    const budgets = await BudgetService.getBudgetStatus(userId, budgetMonth);

    const insights = generateInsights(summary);
    for (const b of budgets) {
      if (b.status === 'over') {
        insights.push(
          `Budget alert: '${b.category}' spending (${b.spent.toFixed(2)}) has exceeded its monthly budget of ${b.monthlyLimit.toFixed(2)} for ${b.month} (${b.percentUsed.toFixed(1)}% used).`
        );
      } else if (b.status === 'warning') {
        insights.push(
          `Budget warning: '${b.category}' is at ${b.percentUsed.toFixed(1)}% of its ${b.monthlyLimit.toFixed(2)} monthly budget for ${b.month}.`
        );
      }
    }

    return {
      ...(month ? { period: month } : {}),
      ...summary,
      budgets,
      insights
    };
  }

  /**
   * Per-month income/expense totals for the last N months (recurring rules
   * materialized first so scheduled entries are included).
   * @param {string} userId
   * @param {number} months
   * @returns {Promise<Array<Object>>}
   */
  static async getMonthlyTrend(userId, months) {
    await RecurringService.materializeDueRules(userId);
    return TransactionModel.monthlyTrend(userId, months);
  }

  /**
   * Adds a transaction linked to a user. The date (already validated) is
   * normalized to a full ISO timestamp before persistence.
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>} The created transaction.
   */
  static async addTransaction(userId, data) {
    const tx = await TransactionModel.create({
      userId,
      type: data.type,
      category: await CategoryService.resolve(userId, data.category),
      amount: data.amount,
      description: data.description,
      date: data.date ? normalizeDate(data.date) : undefined
    });
    return tx;
  }

  /**
   * Retrieves transactions for a user with filters, search, date range,
   * sorting, and pagination pushed down to the database. Due recurring rules
   * are materialized first so the listing is always current.
   * @param {string} userId
   * @param {Object} options {type, category, q, from, toExclusive, sort, order, limit, offset}
   * @returns {Promise<{transactions: Array<Object>, total: number}>}
   */
  static async getUserTransactions(userId, options = {}) {
    await RecurringService.materializeDueRules(userId);
    return TransactionModel.findByUserId(userId, options);
  }

  /**
   * Exports the user's transactions (honoring the same filters as the list
   * endpoint) as CSV text.
   * @param {string} userId
   * @param {Object} options
   * @returns {Promise<string>}
   */
  static async exportCSV(userId, options = {}) {
    const { transactions } = await this.getUserTransactions(userId, options);
    const rows = transactions.map(t => [t.id, t.type, t.category, t.amount, t.description, t.date]);
    return toCSV(CSV_HEADERS, rows);
  }

  /**
   * Imports transactions from CSV text. Expected headers (case-insensitive):
   * type, category, amount — optional: description, date. Invalid rows are
   * skipped and reported; valid rows are inserted.
   * @param {string} userId
   * @param {string} csvText
   * @returns {Promise<{imported: number, skipped: Array<{line: number, reason: string}>}>}
   */
  static async importCSV(userId, csvText) {
    if (typeof csvText !== 'string' || csvText.trim() === '') {
      throw new AppError('CSV body is empty. Send the file content with Content-Type: text/csv.', 400);
    }

    const { headers, records } = parseCSV(csvText);
    for (const required of ['type', 'category', 'amount']) {
      if (!headers.includes(required)) {
        throw new AppError(`CSV is missing the required '${required}' column.`, 400);
      }
    }

    let imported = 0;
    const skipped = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const line = i + 2; // 1-based, after the header row
      const amount = parseFloat(record.amount);
      const type = record.type.toLowerCase();

      if (!['income', 'expense'].includes(type)) {
        skipped.push({ line, reason: `Invalid type '${record.type}'.` });
        continue;
      }
      if (isNaN(amount) || amount <= 0) {
        skipped.push({ line, reason: `Invalid amount '${record.amount}'.` });
        continue;
      }
      if (!record.category) {
        skipped.push({ line, reason: 'Missing category.' });
        continue;
      }
      let date;
      if (record.date) {
        date = normalizeDate(record.date);
        if (!date) {
          skipped.push({ line, reason: `Invalid date '${record.date}'.` });
          continue;
        }
      }

      await TransactionModel.create({
        userId,
        type,
        category: await CategoryService.resolve(userId, record.category),
        amount,
        description: record.description || '',
        date
      });
      imported++;
    }

    return { imported, skipped };
  }

  /**
   * Loads a transaction and verifies the caller owns it.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async #getOwnedTransaction(id, userId) {
    const tx = await TransactionModel.findById(id);
    if (!tx) {
      throw new AppError('Transaction not found.', 404);
    }
    if (tx.userId !== userId) {
      throw new AppError('Forbidden. You do not own this transaction.', 403);
    }
    return tx;
  }

  /**
   * Updates a transaction after checking ownership.
   * @param {string} id
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async modifyTransaction(id, userId, data) {
    const tx = await this.#getOwnedTransaction(id, userId);

    // Prepare update payload (prevent overwriting userId or id)
    const updatePayload = {
      type: data.type || tx.type,
      category: data.category ? await CategoryService.resolve(userId, data.category) : tx.category,
      amount: data.amount !== undefined ? data.amount : tx.amount,
      description: data.description !== undefined ? data.description : tx.description,
      date: data.date ? normalizeDate(data.date) : tx.date
    };

    const updatedTx = await TransactionModel.update(id, updatePayload);
    return updatedTx;
  }

  /**
   * Deletes a transaction after checking ownership.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async removeTransaction(id, userId) {
    await this.#getOwnedTransaction(id, userId);
    await TransactionModel.delete(id);
    return true;
  }
}

export default TransactionService;
