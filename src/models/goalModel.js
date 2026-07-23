import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

// Goal amounts are stored as integer minor units, like every other money value.
const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const toAmount = (cents) => cents / 100;

function mapRow(row) {
  if (!row) return null;
  const { targetCents, savedCents, updatedAt, deadline, ...rest } = row;
  const target = toAmount(targetCents);
  const saved = toAmount(savedCents);
  return {
    ...rest,
    target,
    saved,
    remaining: toAmount(Math.max(targetCents - savedCents, 0)),
    percentSaved: Math.round((savedCents / targetCents) * 1000) / 10,
    complete: savedCents >= targetCents,
    ...(deadline ? { deadline } : {}),
    ...(updatedAt ? { updatedAt } : {})
  };
}

class GoalModel {
  /**
   * All savings goals for a user, newest first.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async findByUserId(userId) {
    return db
      .prepare('SELECT * FROM savings_goals WHERE userId = ? ORDER BY createdAt DESC')
      .all(userId)
      .map(mapRow);
  }

  /**
   * Finds a goal by id.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    return mapRow(db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id));
  }

  /**
   * Creates a savings goal.
   * @param {Object} data {userId, name, target, saved?, deadline?}
   * @returns {Promise<Object>}
   */
  static async create(data) {
    const row = {
      id: uuidv4(),
      userId: data.userId,
      name: data.name,
      targetCents: toCents(data.target),
      savedCents: data.saved !== undefined ? toCents(data.saved) : 0,
      deadline: data.deadline || null,
      createdAt: new Date().toISOString()
    };
    db.prepare(
      `INSERT INTO savings_goals (id, userId, name, targetCents, savedCents, deadline, createdAt)
       VALUES (@id, @userId, @name, @targetCents, @savedCents, @deadline, @createdAt)`
    ).run(row);
    return this.findById(row.id);
  }

  /**
   * Updates a goal's mutable fields (any subset of name/target/saved/deadline).
   * @param {string} id
   * @param {Object} fields
   * @returns {Promise<Object|null>}
   */
  static async update(id, fields) {
    const current = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id);
    if (!current) return null;

    const merged = {
      name: fields.name !== undefined ? fields.name : current.name,
      targetCents: fields.target !== undefined ? toCents(fields.target) : current.targetCents,
      savedCents: fields.saved !== undefined ? toCents(fields.saved) : current.savedCents,
      deadline: fields.deadline !== undefined ? (fields.deadline || null) : current.deadline,
      updatedAt: new Date().toISOString(),
      id
    };
    db.prepare(
      `UPDATE savings_goals
       SET name = @name, targetCents = @targetCents, savedCents = @savedCents,
           deadline = @deadline, updatedAt = @updatedAt
       WHERE id = @id`
    ).run(merged);
    return this.findById(id);
  }

  /**
   * Deletes a goal.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const info = db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

export default GoalModel;
