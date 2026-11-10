import BudgetModel from '../models/budgetModel.js';
import TransactionModel from '../models/transactionModel.js';
import CategoryService from './categoryService.js';
import { AppError } from '../middleware/errorHandler.js';
import { monthRange } from '../utils/dates.js';

const toAmount = (cents) => cents / 100;

/** Lists the YYYY-MM months in [startMonth, endMonthExclusive). */
function monthsBetween(startMonth, endMonthExclusive) {
  const out = [];
  let [y, m] = startMonth.split('-').map(Number);
  const [ey, em] = endMonthExclusive.split('-').map(Number);
  while (y < ey || (y === ey && m < em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

class BudgetService {
  /**
   * Lists the user's budgets.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async getBudgets(userId) {
    return BudgetModel.findByUserId(userId);
  }

  /**
   * Creates or updates the monthly budget for a category.
   * @param {string} userId
   * @param {string} category
   * @param {number} monthlyLimit
   * @returns {Promise<Object>}
   */
  static async setBudget(userId, category, monthlyLimit, rollover) {
    const resolved = await CategoryService.resolve(userId, category);
    return BudgetModel.upsert(userId, resolved, monthlyLimit, rollover);
  }

  /**
   * Removes a category budget.
   * @param {string} userId
   * @param {string} category
   * @returns {Promise<boolean>}
   */
  static async removeBudget(userId, category) {
    const removed = await BudgetModel.delete(userId, category);
    if (!removed) {
      throw new AppError(`No budget found for category '${category}'.`, 404);
    }
    return true;
  }

  /**
   * Budget-vs-spend status for every budgeted category in a month. Arithmetic
   * is done in integer cents; amounts returned as decimals.
   * @param {string} userId
   * @param {string} month YYYY-MM
   * @returns {Promise<Array<Object>>}
   */
  static async getBudgetStatus(userId, month) {
    const limits = await BudgetModel.limitsByCategory(userId);
    if (limits.size === 0) return [];

    const spent = await TransactionModel.expenseCentsByCategory(userId, monthRange(month));

    // Carry-over for rollover budgets: for each prior month since the budget
    // was created, add (limit - spent) to the available envelope. The current
    // limit is applied to all prior months (we don't store historical limits).
    const carriedByKey = new Map();
    const rolloverEntries = [...limits.entries()].filter(([, v]) => v.rollover);
    if (rolloverEntries.length > 0) {
      const earliestStart = rolloverEntries
        .map(([, v]) => v.startMonth)
        .sort()[0];
      if (earliestStart < month) {
        const fromIso = monthRange(earliestStart).from;
        const toExclusiveIso = monthRange(month).from; // up to, not including, the requested month
        const rows = await TransactionModel.monthlyExpenseCentsByCategory(userId, fromIso, toExclusiveIso);
        const spentByMonthKey = new Map(rows.map(r => [`${r.month}|${r.category}`, r.cents]));

        for (const [key, { limitCents, startMonth }] of rolloverEntries) {
          let carried = 0;
          for (const m of monthsBetween(startMonth, month)) {
            const monthSpent = spentByMonthKey.get(`${m}|${key}`) || 0;
            carried += limitCents - monthSpent;
          }
          carriedByKey.set(key, carried);
        }
      }
    }

    return [...limits.entries()].map(([key, { category, limitCents, rollover }]) => {
      const spentCents = spent.get(key) || 0;
      const carriedCents = rollover ? (carriedByKey.get(key) || 0) : 0;
      const availableCents = limitCents + carriedCents;
      // Percent is relative to the available envelope; guard against a zero/
      // negative envelope so an overspent carry-over still reads as "over".
      const percentUsed = availableCents > 0
        ? Math.round((spentCents / availableCents) * 1000) / 10
        : (spentCents > 0 ? 1000 : 0);
      return {
        category,
        month,
        monthlyLimit: toAmount(limitCents),
        rollover,
        ...(rollover ? { carriedOver: toAmount(carriedCents), available: toAmount(availableCents) } : {}),
        spent: toAmount(spentCents),
        remaining: toAmount(availableCents - spentCents),
        percentUsed,
        status: spentCents > availableCents ? 'over' : percentUsed >= 80 ? 'warning' : 'ok'
      };
    });
  }
}

export default BudgetService;
