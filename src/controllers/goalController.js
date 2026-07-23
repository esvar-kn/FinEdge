import GoalService from '../services/goalService.js';

class GoalController {
  /**
   * Lists the user's savings goals.
   */
  static async getGoals(req, res, next) {
    try {
      const goals = await GoalService.getGoals(req.userId);
      res.status(200).json({
        status: 'success',
        results: goals.length,
        data: { goals }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates a savings goal.
   */
  static async createGoal(req, res, next) {
    try {
      const goal = await GoalService.addGoal(req.userId, req.body);
      res.status(201).json({
        status: 'success',
        data: { goal }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates a savings goal's fields.
   */
  static async updateGoal(req, res, next) {
    try {
      const goal = await GoalService.modifyGoal(req.params.id, req.userId, req.body);
      res.status(200).json({
        status: 'success',
        data: { goal }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adds a contribution to a goal (body: { amount }). Negative amounts withdraw.
   */
  static async contribute(req, res, next) {
    try {
      const goal = await GoalService.contribute(req.params.id, req.userId, req.body.amount);
      res.status(200).json({
        status: 'success',
        data: { goal }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a savings goal.
   */
  static async deleteGoal(req, res, next) {
    try {
      await GoalService.removeGoal(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default GoalController;
