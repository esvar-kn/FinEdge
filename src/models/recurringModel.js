import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const toAmount = (cents) => cents / 100;

function mapRow(row) {
  if (!row) return null;
  const { amountCents, endDate, ...rest } = row;
  return {
    ...rest,
    amount: toAmount(amountCents),
    ...(endDate ? { endDate } : {})
  };
}

class RecurringModel {
  /**
   * All recurring rules for a user.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async findByUserId(userId) {
    return db
      .prepare('SELECT * FROM recurring_rules WHERE userId = ? ORDER BY createdAt')
      .all(userId)
      .map(mapRow);
  }

  /**
   * Finds a rule by id.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    return mapRow(db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(id));
  }

  /**
   * Raw rules (cents) for a user that are due on or before the given ISO time.
   * @param {string} userId
   * @param {string} nowIso
   * @returns {Promise<Array<Object>>}
   */
  static async findDueRaw(userId, nowIso) {
    return db
      .prepare('SELECT * FROM recurring_rules WHERE userId = ? AND nextRunDate <= ?')
      .all(userId, nowIso);
  }

  /**
   * Creates a recurring rule.
   * @param {Object} ruleData {userId, type, category, amount, description, frequency, startDate, endDate}
   * @returns {Promise<Object>}
   */
  static async create(ruleData) {
    const row = {
      id: uuidv4(),
      userId: ruleData.userId,
      type: ruleData.type,
      category: ruleData.category,
      amountCents: toCents(ruleData.amount),
      description: ruleData.description || '',
      frequency: ruleData.frequency,
      anchorDay: new Date(ruleData.startDate).getUTCDate(),
      nextRunDate: ruleData.startDate,
      endDate: ruleData.endDate || null,
      createdAt: new Date().toISOString()
    };
    db.prepare(
      `INSERT INTO recurring_rules (id, userId, type, category, amountCents, description, frequency, anchorDay, nextRunDate, endDate, createdAt)
       VALUES (@id, @userId, @type, @category, @amountCents, @description, @frequency, @anchorDay, @nextRunDate, @endDate, @createdAt)`
    ).run(row);
    return mapRow(row);
  }

  /**
   * Moves a rule's next run forward.
   * @param {string} id
   * @param {string} nextRunDate
   */
  static async setNextRun(id, nextRunDate) {
    db.prepare('UPDATE recurring_rules SET nextRunDate = ? WHERE id = ?').run(nextRunDate, id);
  }

  /**
   * Deletes a rule (already-created transactions are kept).
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const info = db.prepare('DELETE FROM recurring_rules WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

export default RecurringModel;
