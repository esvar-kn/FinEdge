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
   * Upcoming bill reminders within ?days=N (default 30, max 365).
   */
  static async getUpcoming(req, res, next) {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
      const upcoming = await RecurringService.getUpcoming(req.userId, days);
      res.status(200).json({
        status: 'success',
        results: upcoming.length,
        data: { days, upcoming }
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
