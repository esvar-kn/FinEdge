import TransactionModel from '../models/transactionModel.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculateSummary } from '../utils/analytics.js';
import { generateInsights } from '../utils/aiHelper.js';

class TransactionService {
  /**
   * Computes financial summaries and alerts using the Analytics utility.
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  static async getFinancialSummary(userId) {
    const txs = await TransactionModel.findByUserId(userId);
    const summary = calculateSummary(txs);
    const insights = generateInsights(summary);
    return {
      ...summary,
      insights
    };
  }
  /**
   * Adds a transaction linked to a user.
   * @param {string} userId 
   * @param {Object} data 
   * @returns {Promise<Object>} The created transaction.
   */
  static async addTransaction(userId, data) {
    const tx = await TransactionModel.create({
      userId,
      type: data.type,
      category: data.category,
      amount: data.amount,
      description: data.description,
      date: data.date
    });
    return tx;
  }

  /**
   * Retrieves transactions for a user, applying type and category filters.
   * @param {string} userId 
   * @param {Object} filters 
   * @returns {Promise<Array<Object>>}
   */
  static async getUserTransactions(userId, filters = {}) {
    let txs = await TransactionModel.findByUserId(userId);

    // Apply filtering
    if (filters.type) {
      txs = txs.filter(t => t.type.toLowerCase() === filters.type.toLowerCase());
    }
    if (filters.category) {
      txs = txs.filter(t => t.category.toLowerCase() === filters.category.toLowerCase());
    }

    return txs;
  }

  /**
   * Updates a transaction after checking ownership.
   * @param {string} id 
   * @param {string} userId 
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  static async modifyTransaction(id, userId, data) {
    const allTxs = await TransactionModel.findAll();
    const tx = allTxs.find(t => t.id === id);

    if (!tx) {
      throw new AppError('Transaction not found.', 404);
    }

    // Verify ownership
    if (tx.userId !== userId) {
      throw new AppError('Forbidden. You do not own this transaction.', 403);
    }

    // Prepare update payload (prevent overwriting userId or id)
    const updatePayload = {
      type: data.type || tx.type,
      category: data.category || tx.category,
      amount: data.amount !== undefined ? data.amount : tx.amount,
      description: data.description !== undefined ? data.description : tx.description,
      date: data.date || tx.date
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
    const allTxs = await TransactionModel.findAll();
    const tx = allTxs.find(t => t.id === id);

    if (!tx) {
      throw new AppError('Transaction not found.', 404);
    }

    // Verify ownership
    if (tx.userId !== userId) {
      throw new AppError('Forbidden. You do not own this transaction.', 403);
    }

    await TransactionModel.delete(id);
    return true;
  }
}

export default TransactionService;
