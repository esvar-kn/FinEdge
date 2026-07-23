import RecurringService from '../services/recurringService.js';

class RecurringController {
  /**
   * Lists the user's recurring rules.
   */
  static async getRules(req, res, next) {
    try {
      const rules = await RecurringService.getRules(req.userId);
      res.status(200).json({
        status: 'success',
        results: rules.length,
        data: { rules }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates a recurring rule; past-dated startDates backfill immediately.
   */
  static async createRule(req, res, next) {
    try {
      const rule = await RecurringService.addRule(req.userId, req.body);
      res.status(201).json({
        status: 'success',
        data: { rule }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a recurring rule (already-created transactions are kept).
   */
  static async deleteRule(req, res, next) {
    try {
      await RecurringService.removeRule(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default RecurringController;
