import TransactionService from '../services/transactionService.js';
import AiInsightsService from '../services/aiInsightsService.js';
import { AppError } from '../middleware/errorHandler.js';
import { queryDateRange, isValidMonth } from '../utils/dates.js';

/**
 * Parses the shared list-endpoint query params (filters, search, date range).
 * Throws AppError(400) on an invalid from/to value.
 */
function parseListOptions(query) {
  const { type, category, q, sort, order, from, to } = query;
  const options = { type, category, q, sort, order };

  if (from !== undefined || to !== undefined) {
    const range = queryDateRange(from, to);
    if (!range) {
      throw new AppError("Invalid 'from' or 'to' date. Use YYYY-MM-DD or an ISO-8601 timestamp.", 400);
    }
    Object.assign(options, range);
  }

  return options;
}

class TransactionController {
  /**
   * Adds a new transaction.
   */
  static async createTransaction(req, res, next) {
    try {
      const tx = await TransactionService.addTransaction(req.userId, req.body);
      res.status(201).json({
        status: 'success',
        data: { transaction: tx }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves summary statistics, budget status, and rule-based insights.
   * ?month=YYYY-MM restricts the summary to that month.
   */
  static async getTransactionSummary(req, res, next) {
    try {
      const { month } = req.query;
      if (month !== undefined && !isValidMonth(month)) {
        throw new AppError("Invalid 'month'. Use the YYYY-MM format, e.g. ?month=2026-07.", 400);
      }
      const summary = await TransactionService.getFinancialSummary(req.userId, month);
      res.status(200).json({
        status: 'success',
        data: { summary }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * AI-generated financial advice via the Claude API (?month=YYYY-MM optional).
   * Falls back to the rule-based insights when no API key is configured.
   */
  static async getAiInsights(req, res, next) {
    try {
      const { month } = req.query;
      if (month !== undefined && !isValidMonth(month)) {
        throw new AppError("Invalid 'month'. Use the YYYY-MM format, e.g. ?month=2026-07.", 400);
      }
      const result = await AiInsightsService.getAdvice(req.userId, month);
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Per-month income/expense totals for charting: ?months=N (default 6, max 24).
   */
  static async getMonthlyTrend(req, res, next) {
    try {
      const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
      const trend = await TransactionService.getMonthlyTrend(req.userId, months);
      res.status(200).json({
        status: 'success',
        data: { trend }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exports transactions as a CSV download. Honors the same filters as the
   * list endpoint (type, category, q, from, to).
   */
  static async exportTransactions(req, res, next) {
    try {
      const options = parseListOptions(req.query);
      const csv = await TransactionService.exportCSV(req.userId, options);
      res
        .status(200)
        .set('Content-Type', 'text/csv; charset=utf-8')
        .set('Content-Disposition', 'attachment; filename="finedge-transactions.csv"')
        .send(csv);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Imports transactions from a CSV request body (Content-Type: text/csv).
   * Required columns: type, category, amount. Optional: description, date.
   */
  static async importTransactions(req, res, next) {
    try {
      const result = await TransactionService.importCSV(req.userId, req.body);
      res.status(201).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves transactions for the authenticated user. Supports filters
   * (?type=&category=), description search (?q=), sorting (?sort=date|amount|
   * category|createdAt&order=asc|desc), and optional pagination (?page=&limit=).
   * Without page/limit all matching rows are returned (backwards compatible).
   */
  static async getTransactions(req, res, next) {
    try {
      const options = parseListOptions(req.query);
      const paginated = req.query.limit !== undefined || req.query.page !== undefined;
      if (paginated) {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        options.limit = limit;
        options.offset = (page - 1) * limit;
      }

      const { transactions, total } = await TransactionService.getUserTransactions(req.userId, options);

      res.status(200).json({
        status: 'success',
        results: transactions.length,
        total,
        ...(paginated && {
          page: options.offset / options.limit + 1,
          limit: options.limit,
          totalPages: Math.max(Math.ceil(total / options.limit), 1)
        }),
        data: { transactions }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates a transaction.
   */
  static async updateTransaction(req, res, next) {
    try {
      const { id } = req.params;
      const tx = await TransactionService.modifyTransaction(id, req.userId, req.body);
      
      res.status(200).json({
        status: 'success',
        data: { transaction: tx }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a transaction.
   */
  static async deleteTransaction(req, res, next) {
    try {
      const { id } = req.params;
      await TransactionService.removeTransaction(id, req.userId);

      // 204 No Content: no response body
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default TransactionController;
