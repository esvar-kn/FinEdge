import BudgetModel from '../models/budgetModel.js';
import TransactionModel from '../models/transactionModel.js';
import CategoryService from './categoryService.js';
import { AppError } from '../middleware/errorHandler.js';
import { monthRange } from '../utils/dates.js';

const toAmount = (cents) => cents / 100;

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
  static async setBudget(userId, category, monthlyLimit) {
    const resolved = await CategoryService.resolve(userId, category);
    return BudgetModel.upsert(userId, resolved, monthlyLimit);
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

    return [...limits.entries()].map(([key, { category, limitCents }]) => {
      const spentCents = spent.get(key) || 0;
      const percentUsed = Math.round((spentCents / limitCents) * 1000) / 10;
      return {
        category,
        month,
        monthlyLimit: toAmount(limitCents),
        spent: toAmount(spentCents),
        remaining: toAmount(limitCents - spentCents),
        percentUsed,
        status: spentCents > limitCents ? 'over' : percentUsed >= 80 ? 'warning' : 'ok'
      };
    });
  }
}

export default BudgetService;
