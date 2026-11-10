import TransactionModel from '../models/transactionModel.js';
import RecurringModel from '../models/recurringModel.js';
import BudgetService from './budgetService.js';
import RecurringService from './recurringService.js';
import CategoryService from './categoryService.js';
import AccountService from './accountService.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateInsights } from '../utils/insightHelper.js';
import { normalizeDate, monthRange, currentMonth, advanceDate } from '../utils/dates.js';
import { toCSV, parseCSV } from '../utils/csv.js';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

// Supported receipt image types <-> file extension.
const RECEIPT_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
const EXT_TO_TYPE = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

const CSV_HEADERS = ['id', 'type', 'category', 'amount', 'description', 'date'];

/** Cleans a tags array to lowercased, trimmed, de-duplicated non-empty strings. */
function normalizeTags(tags) {
  if (tags === undefined) return undefined;
  if (!Array.isArray(tags)) {
    throw new AppError('tags must be an array of strings.', 400);
  }
  return [...new Set(tags.map(t => String(t).toLowerCase().trim()).filter(Boolean))];
}

/**
 * Validates and resolves split line items, requiring the split amounts to sum
 * to the transaction amount (compared in integer cents). Returns splits with
 * each category resolved to the user's canonical spelling.
 */
async function normalizeSplits(userId, splits, amount) {
  if (splits === undefined) return undefined;
  if (!Array.isArray(splits) || splits.length === 0) {
    throw new AppError('splits must be a non-empty array of { category, amount }.', 400);
  }
  const resolved = [];
  let sumCents = 0;
  for (const s of splits) {
    const amt = parseFloat(s && s.amount);
    if (!s || !s.category || typeof s.category !== 'string' || isNaN(amt) || amt <= 0) {
      throw new AppError('Each split needs a non-empty category and a positive amount.', 400);
    }
    sumCents += Math.round(amt * 100);
    resolved.push({ category: await CategoryService.resolve(userId, s.category), amount: amt });
  }
  if (sumCents !== Math.round(parseFloat(amount) * 100)) {
    throw new AppError('Split amounts must sum to the transaction amount.', 400);
  }
  return resolved;
}

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
   * Year report: per-month income/expense, yearly totals, and category
   * breakdown (recurring materialized first so scheduled entries count).
   * @param {string} userId
   * @param {number} year
   * @returns {Promise<Object>}
   */
  static async getYearReport(userId, year) {
    await RecurringService.materializeDueRules(userId);
    return TransactionModel.yearReport(userId, year);
  }

  /**
   * Projects the current month's end-of-month position: actuals recorded so
   * far this month plus recurring rules still scheduled to fire before month
   * end. Returns actual, scheduled, and projected income/expense/net.
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async getForecast(userId) {
    await RecurringService.materializeDueRules(userId);

    const month = currentMonth();
    const { from, toExclusive } = monthRange(month);
    const actual = await TransactionModel.summarize(userId, { from, toExclusive });

    // Sum recurring runs that will still fire between now and month end.
    const nowIso = new Date().toISOString();
    let scheduledIncome = 0;
    let scheduledExpenses = 0;
    for (const rule of await RecurringModel.findByUserId(userId)) {
      let runDate = rule.nextRunDate;
      while (runDate < toExclusive) {
        const pastEnd = rule.endDate && runDate > rule.endDate;
        if (runDate >= nowIso && !pastEnd) {
          if (rule.type === 'income') scheduledIncome += rule.amount;
          else scheduledExpenses += rule.amount;
        }
        if (pastEnd) break;
        runDate = advanceDate(runDate, rule.frequency, rule.anchorDay);
      }
    }

    const round = (n) => Math.round(n * 100) / 100;
    const projectedIncome = round(actual.totalIncome + scheduledIncome);
    const projectedExpenses = round(actual.totalExpenses + scheduledExpenses);

    return {
      month,
      actual: {
        income: actual.totalIncome,
        expenses: actual.totalExpenses,
        net: actual.netBalance
      },
      scheduled: {
        income: round(scheduledIncome),
        expenses: round(scheduledExpenses)
      },
      projected: {
        income: projectedIncome,
        expenses: projectedExpenses,
        net: round(projectedIncome - projectedExpenses)
      }
    };
  }

  /**
   * Adds a transaction linked to a user. The date (already validated) is
   * normalized to a full ISO timestamp before persistence.
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>} The created transaction.
   */
  static async addTransaction(userId, data) {
    if (data.accountId !== undefined && data.accountId !== null) {
      // Verifies the account exists and is owned by the caller (throws 404/403).
      await AccountService.getOwnedAccount(data.accountId, userId);
    }
    const tx = await TransactionModel.create({
      userId,
      type: data.type,
      category: await CategoryService.resolve(userId, data.category),
      amount: data.amount,
      description: data.description,
      date: data.date ? normalizeDate(data.date) : undefined,
      accountId: data.accountId || null,
      tags: normalizeTags(data.tags),
      splits: await normalizeSplits(userId, data.splits, data.amount)
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

    let accountId = tx.accountId || null;
    if (data.accountId !== undefined) {
      if (data.accountId === null || data.accountId === '') {
        accountId = null; // explicit unassign
      } else {
        await AccountService.getOwnedAccount(data.accountId, userId);
        accountId = data.accountId;
      }
    }

    const effectiveAmount = data.amount !== undefined ? data.amount : tx.amount;

    // Prepare update payload (prevent overwriting userId or id)
    const updatePayload = {
      type: data.type || tx.type,
      category: data.category ? await CategoryService.resolve(userId, data.category) : tx.category,
      amount: effectiveAmount,
      description: data.description !== undefined ? data.description : tx.description,
      date: data.date ? normalizeDate(data.date) : tx.date,
      accountId,
      tags: normalizeTags(data.tags),
      splits: await normalizeSplits(userId, data.splits, effectiveAmount)
    };

    const updatedTx = await TransactionModel.update(id, updatePayload);
    return updatedTx;
  }

  /**
   * Deletes a transaction after checking ownership. Also removes any attached
   * receipt file so uploads don't leak after the row is gone.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async removeTransaction(id, userId) {
    const tx = await this.#getOwnedTransaction(id, userId);
    if (tx.receipt) {
      try { fs.unlinkSync(path.join(config.uploadDir, tx.receipt)); } catch { /* already gone */ }
    }
    await TransactionModel.delete(id);
    return true;
  }

  /**
   * Stores a receipt image for a transaction (ownership-checked). Replaces any
   * existing receipt. Returns the updated transaction.
   * @param {string} id
   * @param {string} userId
   * @param {Buffer} buffer raw image bytes
   * @param {string} contentType request Content-Type
   * @returns {Promise<Object>}
   */
  static async uploadReceipt(id, userId, buffer, contentType) {
    const tx = await this.#getOwnedTransaction(id, userId);

    const ext = RECEIPT_TYPES[String(contentType).split(';')[0].trim().toLowerCase()];
    if (!ext) {
      throw new AppError('Receipt must be a PNG, JPEG, WebP, or GIF image (set Content-Type).', 400);
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new AppError('Receipt image body is empty.', 400);
    }

    fs.mkdirSync(config.uploadDir, { recursive: true });
    // Remove a prior receipt of a different extension so it doesn't orphan.
    if (tx.receipt && tx.receipt !== `${id}.${ext}`) {
      try { fs.unlinkSync(path.join(config.uploadDir, tx.receipt)); } catch { /* ignore */ }
    }
    const filename = `${id}.${ext}`;
    fs.writeFileSync(path.join(config.uploadDir, filename), buffer);

    return TransactionModel.setReceipt(id, filename);
  }

  /**
   * Resolves the on-disk path and content type of a transaction's receipt
   * (ownership-checked). Throws 404 if there is none or the file is missing.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<{path: string, contentType: string, filename: string}>}
   */
  static async getReceiptInfo(id, userId) {
    const tx = await this.#getOwnedTransaction(id, userId);
    if (!tx.receipt) {
      throw new AppError('This transaction has no receipt.', 404);
    }
    const filePath = path.join(config.uploadDir, tx.receipt);
    if (!fs.existsSync(filePath)) {
      throw new AppError('Receipt file is missing.', 404);
    }
    const ext = tx.receipt.split('.').pop();
    return { path: filePath, contentType: EXT_TO_TYPE[ext] || 'application/octet-stream', filename: tx.receipt };
  }

  /**
   * Removes a transaction's receipt (ownership-checked).
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async removeReceipt(id, userId) {
    const tx = await this.#getOwnedTransaction(id, userId);
    if (tx.receipt) {
      try { fs.unlinkSync(path.join(config.uploadDir, tx.receipt)); } catch { /* ignore */ }
      await TransactionModel.setReceipt(id, null);
    }
    return true;
  }
}

export default TransactionService;
