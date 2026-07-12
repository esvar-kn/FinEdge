import TransactionService from '../services/transactionService.js';

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
   * Retrieves summary statistics and rule-based insights.
   */
  static async getTransactionSummary(req, res, next) {
    try {
      const summary = await TransactionService.getFinancialSummary(req.userId);
      res.status(200).json({
        status: 'success',
        data: { summary }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves transactions for the authenticated user (supports category & type filters).
   */
  static async getTransactions(req, res, next) {
    try {
      const { type, category } = req.query;
      const txs = await TransactionService.getUserTransactions(req.userId, { type, category });
      
      res.status(200).json({
        status: 'success',
        results: txs.length,
        data: { transactions: txs }
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
