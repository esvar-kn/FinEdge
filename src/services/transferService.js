import TransferModel from '../models/transferModel.js';
import AccountService from './accountService.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeDate } from '../utils/dates.js';

class TransferService {
  /**
   * Lists the user's transfers.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async getTransfers(userId) {
    return TransferModel.findByUserId(userId);
  }

  /**
   * Records a transfer between two of the user's own accounts. Both accounts
   * are ownership-checked; a transfer to the same account is rejected.
   * @param {string} userId
   * @param {Object} data {fromAccountId, toAccountId, amount, description?, date?}
   * @returns {Promise<Object>}
   */
  static async addTransfer(userId, data) {
    const { fromAccountId, toAccountId } = data;
    if (fromAccountId === toAccountId) {
      throw new AppError('A transfer must be between two different accounts.', 400);
    }
    // Ownership + existence of both accounts (throws 404/403 otherwise).
    await AccountService.getOwnedAccount(fromAccountId, userId);
    await AccountService.getOwnedAccount(toAccountId, userId);

    return TransferModel.create({
      userId,
      fromAccountId,
      toAccountId,
      amount: data.amount,
      description: data.description,
      date: data.date ? normalizeDate(data.date) : undefined
    });
  }

  /**
   * Deletes a transfer after checking ownership.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async removeTransfer(id, userId) {
    const transfer = await TransferModel.findById(id);
    if (!transfer) {
      throw new AppError('Transfer not found.', 404);
    }
    if (transfer.userId !== userId) {
      throw new AppError('Forbidden. You do not own this transfer.', 403);
    }
    await TransferModel.delete(id);
    return true;
  }
}

export default TransferService;
