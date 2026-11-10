import DebtModel from '../models/debtModel.js';
import { AppError } from '../middleware/errorHandler.js';
import { projectPayoff } from '../utils/debt.js';

const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const toAmount = (cents) => cents / 100;

/**
 * Attaches a payoff projection to a debt using a monthly payment (defaults to
 * the debt's own minimum payment). Amounts in the projection are decimals.
 */
function withProjection(debt, monthlyPayment) {
  const paymentCents = monthlyPayment !== undefined ? toCents(monthlyPayment) : toCents(debt.minPayment);
  const p = projectPayoff(toCents(debt.balance), Math.round(debt.apr * 100), paymentCents);
  return {
    ...debt,
    payoff: {
      monthlyPayment: toAmount(paymentCents),
      feasible: p.feasible,
      months: p.months,
      totalInterest: p.totalInterestCents !== null ? toAmount(p.totalInterestCents) : null,
      totalPaid: p.totalPaidCents !== null ? toAmount(p.totalPaidCents) : null
    }
  };
}

class DebtService {
  /**
   * Lists the user's debts, each with a payoff projection at its minimum payment.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async getDebts(userId) {
    const debts = await DebtModel.findByUserId(userId);
    return debts.map((d) => withProjection(d));
  }

  /**
   * Creates a debt.
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async addDebt(userId, data) {
    const debt = await DebtModel.create({
      userId,
      name: data.name.trim(),
      kind: data.kind,
      balance: data.balance,
      apr: data.apr,
      minPayment: data.minPayment
    });
    return withProjection(debt);
  }

  /** Loads a debt and verifies ownership. */
  static async #getOwnedDebt(id, userId) {
    const debt = await DebtModel.findById(id);
    if (!debt) throw new AppError('Debt not found.', 404);
    if (debt.userId !== userId) throw new AppError('Forbidden. You do not own this debt.', 403);
    return debt;
  }

  /**
   * Updates a debt after checking ownership.
   */
  static async modifyDebt(id, userId, data) {
    await this.#getOwnedDebt(id, userId);
    const fields = { ...data };
    if (fields.name !== undefined) fields.name = fields.name.trim();
    const updated = await DebtModel.update(id, fields);
    return withProjection(updated);
  }

  /**
   * Records a payment against a debt, reducing its balance (clamped at 0).
   * @param {string} id
   * @param {string} userId
   * @param {number} amount
   * @returns {Promise<Object>}
   */
  static async recordPayment(id, userId, amount) {
    const debt = await this.#getOwnedDebt(id, userId);
    const newBalanceCents = toCents(debt.balance) - toCents(amount);
    const updated = await DebtModel.setBalanceCents(id, newBalanceCents);
    return withProjection(updated);
  }

  /**
   * Returns a payoff projection for a debt at a given monthly payment (or its
   * minimum payment when none is supplied).
   * @param {string} id
   * @param {string} userId
   * @param {number} [monthlyPayment]
   * @returns {Promise<Object>}
   */
  static async getPayoff(id, userId, monthlyPayment) {
    const debt = await this.#getOwnedDebt(id, userId);
    return withProjection(debt, monthlyPayment).payoff;
  }

  /**
   * Deletes a debt after checking ownership.
   */
  static async removeDebt(id, userId) {
    await this.#getOwnedDebt(id, userId);
    await DebtModel.delete(id);
    return true;
  }
}

export default DebtService;
