import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

// Budgets are monthly limits per expense category, stored in integer cents.
const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const toAmount = (cents) => cents / 100;

function mapRow(row) {
  if (!row) return null;
  const { monthlyLimitCents, updatedAt, ...rest } = row;
  return {
    ...rest,
    monthlyLimit: toAmount(monthlyLimitCents),
    ...(updatedAt ? { updatedAt } : {})
  };
}

class BudgetModel {
  /**
   * All budgets for a user, alphabetical by category.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async findByUserId(userId) {
    return db
      .prepare('SELECT * FROM budgets WHERE userId = ? ORDER BY category')
      .all(userId)
      .map(mapRow);
  }

  /**
   * Raw budget rows (cents) keyed by lowercased category — for exact
   * budget-vs-spend arithmetic in the service layer.
   * @param {string} userId
   * @returns {Promise<Map<string, {category: string, limitCents: number}>>}
   */
  static async limitsByCategory(userId) {
    const rows = db.prepare('SELECT category, monthlyLimitCents FROM budgets WHERE userId = ?').all(userId);
    return new Map(
      rows.map(r => [r.category.toLowerCase().trim(), { category: r.category, limitCents: r.monthlyLimitCents }])
    );
  }

  /**
   * Creates or replaces the budget for a category (UNIQUE(userId, category),
   * case-insensitive via COLLATE NOCASE).
   * @param {string} userId
   * @param {string} category
   * @param {number} monthlyLimit decimal amount
   * @returns {Promise<Object>}
   */
  static async upsert(userId, category, monthlyLimit) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO budgets (id, userId, category, monthlyLimitCents, createdAt)
       VALUES (@id, @userId, @category, @monthlyLimitCents, @createdAt)
       ON CONFLICT (userId, category)
       DO UPDATE SET monthlyLimitCents = @monthlyLimitCents, updatedAt = @createdAt`
    ).run({
      id: uuidv4(),
      userId,
      category: category.trim(),
      monthlyLimitCents: toCents(monthlyLimit),
      createdAt: now
    });

    return mapRow(db.prepare('SELECT * FROM budgets WHERE userId = ? AND category = ?').get(userId, category.trim()));
  }

  /**
   * Removes the budget for a category.
   * @param {string} userId
   * @param {string} category
   * @returns {Promise<boolean>} True if a record was removed.
   */
  static async delete(userId, category) {
    const info = db.prepare('DELETE FROM budgets WHERE userId = ? AND category = ?').run(userId, category.trim());
    return info.changes > 0;
  }
}

export default BudgetModel;
