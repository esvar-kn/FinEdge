import GoalModel from '../models/goalModel.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeDate } from '../utils/dates.js';

class GoalService {
  /**
   * Lists the user's savings goals.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async getGoals(userId) {
    return GoalModel.findByUserId(userId);
  }

  /**
   * Creates a savings goal.
   * @param {string} userId
   * @param {Object} data {name, target, saved?, deadline?}
   * @returns {Promise<Object>}
   */
  static async addGoal(userId, data) {
    return GoalModel.create({
      userId,
      name: data.name.trim(),
      target: data.target,
      saved: data.saved,
      deadline: data.deadline ? normalizeDate(data.deadline) : null
    });
  }

  /**
   * Loads a goal and verifies the caller owns it.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async #getOwnedGoal(id, userId) {
    const goal = await GoalModel.findById(id);
    if (!goal) {
      throw new AppError('Savings goal not found.', 404);
    }
    if (goal.userId !== userId) {
      throw new AppError('Forbidden. You do not own this savings goal.', 403);
    }
    return goal;
  }

  /**
   * Updates a goal after checking ownership.
   * @param {string} id
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async modifyGoal(id, userId, data) {
    await this.#getOwnedGoal(id, userId);
    const fields = { ...data };
    if (fields.name !== undefined) fields.name = fields.name.trim();
    if (fields.deadline !== undefined && fields.deadline) {
      fields.deadline = normalizeDate(fields.deadline);
    }
    return GoalModel.update(id, fields);
  }

  /**
   * Adds (or, with a negative amount, subtracts) a contribution to a goal's
   * saved balance. Clamped at zero.
   * @param {string} id
   * @param {string} userId
   * @param {number} amount
   * @returns {Promise<Object>}
   */
  static async contribute(id, userId, amount) {
    const goal = await this.#getOwnedGoal(id, userId);
    const newSaved = Math.max(goal.saved + parseFloat(amount), 0);
    return GoalModel.update(id, { saved: newSaved });
  }

  /**
   * Deletes a goal after checking ownership.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async removeGoal(id, userId) {
    await this.#getOwnedGoal(id, userId);
    await GoalModel.delete(id);
    return true;
  }
}

export default GoalService;
