import DebtService from '../services/debtService.js';

class DebtController {
  /** Lists debts with payoff projections. */
  static async getDebts(req, res, next) {
    try {
      const debts = await DebtService.getDebts(req.userId);
      res.status(200).json({ status: 'success', results: debts.length, data: { debts } });
    } catch (error) {
      next(error);
    }
  }

  /** Creates a debt. */
  static async createDebt(req, res, next) {
    try {
      const debt = await DebtService.addDebt(req.userId, req.body);
      res.status(201).json({ status: 'success', data: { debt } });
    } catch (error) {
      next(error);
    }
  }

  /** Updates a debt. */
  static async updateDebt(req, res, next) {
    try {
      const debt = await DebtService.modifyDebt(req.params.id, req.userId, req.body);
      res.status(200).json({ status: 'success', data: { debt } });
    } catch (error) {
      next(error);
    }
  }

  /** Records a payment against a debt. */
  static async payDebt(req, res, next) {
    try {
      const debt = await DebtService.recordPayment(req.params.id, req.userId, req.body.amount);
      res.status(200).json({ status: 'success', data: { debt } });
    } catch (error) {
      next(error);
    }
  }

  /** Payoff projection at ?monthlyPayment= (default: the debt's minimum payment). */
  static async getPayoff(req, res, next) {
    try {
      const monthlyPayment = req.query.monthlyPayment !== undefined ? req.query.monthlyPayment : undefined;
      const payoff = await DebtService.getPayoff(req.params.id, req.userId, monthlyPayment);
      res.status(200).json({ status: 'success', data: { payoff } });
    } catch (error) {
      next(error);
    }
  }

  /** Deletes a debt. */
  static async deleteDebt(req, res, next) {
    try {
      await DebtService.removeDebt(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default DebtController;
