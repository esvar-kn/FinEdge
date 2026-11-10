import AccountModel from '../models/accountModel.js';
import UserModel from '../models/userModel.js';
import RateService from './rateService.js';
import { AppError } from '../middleware/errorHandler.js';
import { isSupportedCurrency } from '../utils/currency.js';

const VALID_TYPES = ['checking', 'savings', 'credit', 'cash', 'other'];

class AccountService {
  /**
   * Lists the user's accounts with derived balances, plus the total net worth
   * (sum of non-archived account balances).
   * @param {string} userId
   * @returns {Promise<{accounts: Array<Object>, netWorth: number}>}
   */
  static async getAccounts(userId) {
    const accounts = await AccountModel.withBalances(userId);

    // Convert each account's balance into the user's display currency so net
    // worth sums correctly across mixed-currency accounts.
    const user = await UserModel.findById(userId);
    const displayCurrency = (user && user.currency) || 'USD';
    const { rates } = await RateService.getRates();

    const enriched = accounts.map((a) => {
      const balanceCents = Math.round(a.balance * 100);
      const convertedCents = RateService.convertCents(balanceCents, a.currency || 'USD', displayCurrency, rates);
      return { ...a, balanceInDisplayCurrency: convertedCents / 100 };
    });

    const netWorth = enriched
      .filter((a) => !a.archived)
      .reduce((sum, a) => sum + a.balanceInDisplayCurrency, 0);

    return {
      accounts: enriched,
      displayCurrency,
      netWorth: Math.round(netWorth * 100) / 100
    };
  }

  /**
   * Creates an account for the user.
   * @param {string} userId
   * @param {Object} data {name, type, openingBalance?}
   * @returns {Promise<Object>}
   */
  static async addAccount(userId, data) {
    let currency = data.currency;
    if (currency !== undefined) {
      if (!isSupportedCurrency(currency)) {
        throw new AppError(`Unsupported currency '${currency}'.`, 400);
      }
      currency = currency.toUpperCase();
    } else {
      const user = await UserModel.findById(userId);
      currency = (user && user.currency) || 'USD';
    }
    try {
      return await AccountModel.create({
        userId,
        name: data.name.trim(),
        type: data.type,
        openingBalance: data.openingBalance,
        currency
      });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        throw new AppError('You already have an account with that name.', 409);
      }
      throw error;
    }
  }

  /**
   * Loads an account and verifies the caller owns it.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async getOwnedAccount(id, userId) {
    const account = await AccountModel.findById(id);
    if (!account) {
      throw new AppError('Account not found.', 404);
    }
    if (account.userId !== userId) {
      throw new AppError('Forbidden. You do not own this account.', 403);
    }
    return account;
  }

  /**
   * Updates an account after checking ownership.
   * @param {string} id
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async modifyAccount(id, userId, data) {
    await this.getOwnedAccount(id, userId);
    const fields = { ...data };
    if (fields.name !== undefined) fields.name = fields.name.trim();
    if (fields.currency !== undefined) {
      if (!isSupportedCurrency(fields.currency)) {
        throw new AppError(`Unsupported currency '${fields.currency}'.`, 400);
      }
      fields.currency = fields.currency.toUpperCase();
    }
    try {
      return await AccountModel.update(id, fields);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        throw new AppError('You already have an account with that name.', 409);
      }
      throw error;
    }
  }

  /**
   * Deletes an account after checking ownership. Refuses (409) if transactions
   * still reference it unless `reassignTo` names another owned account to move
   * them to. Always refuses if transfers reference it — delete those first.
   * @param {string} id
   * @param {string} userId
   * @param {string} [reassignTo]
   * @returns {Promise<boolean>}
   */
  static async removeAccount(id, userId, reassignTo) {
    await this.getOwnedAccount(id, userId);
    const refs = await AccountModel.countReferences(id);

    if (refs.transfers > 0) {
      throw new AppError(
        'This account is referenced by transfers. Delete those transfers before deleting the account.',
        409
      );
    }

    if (refs.transactions > 0) {
      if (!reassignTo) {
        throw new AppError(
          `This account has ${refs.transactions} transaction(s). Pass ?reassignTo=<accountId> to move them, or delete them first.`,
          409
        );
      }
      if (reassignTo === id) {
        throw new AppError('reassignTo must be a different account.', 400);
      }
      await this.getOwnedAccount(reassignTo, userId);
      await AccountModel.reassignTransactions(id, reassignTo);
    }

    await AccountModel.delete(id);
    return true;
  }
}

export { VALID_TYPES };
export default AccountService;
