import AccountService from '../services/accountService.js';
import NetWorthService from '../services/netWorthService.js';

class AccountController {
  /**
   * Net-worth history for charting: ?days=N (default 30, max 365). Today's
   * point is refreshed to the current net worth before the series is returned.
   */
  static async getNetWorthHistory(req, res, next) {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
      const history = await NetWorthService.getHistory(req.userId, days);
      res.status(200).json({
        status: 'success',
        results: history.length,
        data: { history }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists the user's accounts with balances and total net worth.
   */
  static async getAccounts(req, res, next) {
    try {
      const { accounts, netWorth, displayCurrency } = await AccountService.getAccounts(req.userId);
      res.status(200).json({
        status: 'success',
        results: accounts.length,
        netWorth,
        displayCurrency,
        data: { accounts }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates an account.
   */
  static async createAccount(req, res, next) {
    try {
      const account = await AccountService.addAccount(req.userId, req.body);
      res.status(201).json({
        status: 'success',
        data: { account }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an account's fields.
   */
  static async updateAccount(req, res, next) {
    try {
      const account = await AccountService.modifyAccount(req.params.id, req.userId, req.body);
      res.status(200).json({
        status: 'success',
        data: { account }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes an account (optionally reassigning its transactions via ?reassignTo).
   */
  static async deleteAccount(req, res, next) {
    try {
      await AccountService.removeAccount(req.params.id, req.userId, req.query.reassignTo);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default AccountController;
