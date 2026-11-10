import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const toAmount = (cents) => cents / 100;

function mapRow(row) {
  if (!row) return null;
  const { amountCents, ...rest } = row;
  return { ...rest, amount: toAmount(amountCents) };
}

class TransferModel {
  /**
   * Transfers for a user, newest first.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async findByUserId(userId) {
    return db
      .prepare('SELECT * FROM transfers WHERE userId = ? ORDER BY date DESC, createdAt DESC')
      .all(userId)
      .map(mapRow);
  }

  /**
   * Finds a transfer by id.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    return mapRow(db.prepare('SELECT * FROM transfers WHERE id = ?').get(id));
  }

  /**
   * Records a transfer between two accounts.
   * @param {Object} data {userId, fromAccountId, toAccountId, amount, description?, date?}
   * @returns {Promise<Object>}
   */
  static async create(data) {
    const row = {
      id: uuidv4(),
      userId: data.userId,
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      amountCents: toCents(data.amount),
      description: data.description || '',
      date: data.date || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    db.prepare(
      `INSERT INTO transfers (id, userId, fromAccountId, toAccountId, amountCents, description, date, createdAt)
       VALUES (@id, @userId, @fromAccountId, @toAccountId, @amountCents, @description, @date, @createdAt)`
    ).run(row);
    return this.findById(row.id);
  }

  /**
   * Deletes a transfer.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const info = db.prepare('DELETE FROM transfers WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

export default TransferModel;
