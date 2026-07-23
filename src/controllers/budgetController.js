import BudgetService from '../services/budgetService.js';
import { AppError } from '../middleware/errorHandler.js';
import { isValidMonth, currentMonth } from '../utils/dates.js';

class BudgetController {
  /**
   * Lists all budgets; ?month=YYYY-MM (default: current month) adds
   * spend-vs-limit status for each.
   */
  static async getBudgets(req, res, next) {
    try {
      const { month } = req.query;
      if (month !== undefined && !isValidMonth(month)) {
        throw new AppError("Invalid 'month'. Use the YYYY-MM format, e.g. ?month=2026-07.", 400);
      }
      const budgets = await BudgetService.getBudgetStatus(req.userId, month || currentMonth());
      res.status(200).json({
        status: 'success',
        results: budgets.length,
        data: { budgets }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates or updates the monthly budget for a category.
   */
  static async setBudget(req, res, next) {
    try {
      const budget = await BudgetService.setBudget(req.userId, req.params.category, req.body.limit);
      res.status(200).json({
        status: 'success',
        data: { budget }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Removes the budget for a category.
   */
  static async deleteBudget(req, res, next) {
    try {
      await BudgetService.removeBudget(req.userId, req.params.category);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default BudgetController;
