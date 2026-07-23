import RecurringModel from '../models/recurringModel.js';
import TransactionModel from '../models/transactionModel.js';
import UserModel from '../models/userModel.js';
import CategoryService from './categoryService.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeDate, advanceDate } from '../utils/dates.js';

class RecurringService {
  /**
   * Lists the user's recurring rules.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async getRules(userId) {
    return RecurringModel.findByUserId(userId);
  }

  /**
   * Upcoming bill reminders: rules whose next run falls within the next
   * `days` days (materializing due ones first so nextRunDate is current).
   * Each entry includes daysUntil for easy "due in N days" display.
   * @param {string} userId
   * @param {number} days
   * @returns {Promise<Array<Object>>}
   */
  static async getUpcoming(userId, days) {
    await this.materializeDueRules(userId);
    const now = new Date();
    const horizon = new Date(now);
    horizon.setUTCDate(horizon.getUTCDate() + days);
    const horizonIso = horizon.toISOString();

    return (await RecurringModel.findByUserId(userId))
      .filter(r => r.nextRunDate <= horizonIso && (!r.endDate || r.nextRunDate <= r.endDate))
      .map(r => ({
        ...r,
        daysUntil: Math.max(0, Math.ceil((new Date(r.nextRunDate) - now) / (24 * 60 * 60 * 1000)))
      }))
      .sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate));
  }

  /**
   * Creates a rule and immediately materializes any runs already due
   * (a startDate in the past backfills its transactions right away).
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async addRule(userId, data) {
    const startDate = data.startDate ? normalizeDate(data.startDate) : new Date().toISOString();

    const rule = await RecurringModel.create({
      userId,
      type: data.type,
      category: await CategoryService.resolve(userId, data.category),
      amount: data.amount,
      description: data.description,
      frequency: data.frequency,
      startDate,
      endDate: data.endDate ? normalizeDate(data.endDate) : null
    });

    await this.materializeDueRules(userId);
    return RecurringModel.findById(rule.id);
  }

  /**
   * Deletes a rule after checking ownership. Transactions it already created
   * are kept.
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async removeRule(id, userId) {
    const rule = await RecurringModel.findById(id);
    if (!rule) {
      throw new AppError('Recurring rule not found.', 404);
    }
    if (rule.userId !== userId) {
      throw new AppError('Forbidden. You do not own this recurring rule.', 403);
    }
    await RecurringModel.delete(id);
    return true;
  }

  /**
   * Creates transactions for every due run of the user's rules, advancing
   * each rule's nextRunDate past now. Catch-up friendly: a rule that hasn't
   * run for three months creates three transactions dated on their due days.
   * @param {string} userId
   * @returns {Promise<number>} Number of transactions created.
   */
  static async materializeDueRules(userId) {
    const nowIso = new Date().toISOString();
    const dueRules = await RecurringModel.findDueRaw(userId, nowIso);
    let created = 0;

    for (const rule of dueRules) {
      let runDate = rule.nextRunDate;
      while (runDate <= nowIso) {
        const pastEnd = rule.endDate && runDate > rule.endDate;
        if (!pastEnd) {
          await TransactionModel.create({
            userId: rule.userId,
            type: rule.type,
            category: rule.category,
            amount: rule.amountCents / 100,
            description: rule.description,
            date: runDate,
            recurringRuleId: rule.id
          });
          created++;
        }
        runDate = advanceDate(runDate, rule.frequency, rule.anchorDay);
        if (pastEnd) break;
      }
      await RecurringModel.setNextRun(rule.id, runDate);
    }

    return created;
  }

  /**
   * Startup sweep: materializes due rules for every user, so long-running
   * servers keep recurring data current even when nobody logs in.
   * @returns {Promise<number>}
   */
  static async materializeAll() {
    const users = await UserModel.findAll();
    let created = 0;
    for (const user of users) {
      created += await this.materializeDueRules(user.id);
    }
    return created;
  }
}

export default RecurringService;
