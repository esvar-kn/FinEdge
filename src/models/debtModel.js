import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const toAmount = (cents) => cents / 100;

function mapRow(row) {
  if (!row) return null;
  const { balanceCents, aprBps, minPaymentCents, updatedAt, ...rest } = row;
  return {
    ...rest,
    balance: toAmount(balanceCents),
    apr: aprBps / 100, // basis points -> percent (1999 -> 19.99)
    minPayment: toAmount(minPaymentCents),
    ...(updatedAt ? { updatedAt } : {})
  };
}

class DebtModel {
  /**
   * Debts for a user, newest first.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async findByUserId(userId) {
    return db
      .prepare('SELECT * FROM debts WHERE userId = ? ORDER BY createdAt DESC')
      .all(userId)
      .map(mapRow);
  }

  /**
   * Finds a debt by id.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    return mapRow(db.prepare('SELECT * FROM debts WHERE id = ?').get(id));
  }

  /**
   * Creates a debt.
   * @param {Object} data {userId, name, kind, balance, apr?, minPayment?}
   * @returns {Promise<Object>}
   */
  static async create(data) {
    const row = {
      id: uuidv4(),
      userId: data.userId,
      name: data.name,
      kind: data.kind,
      balanceCents: toCents(data.balance),
      aprBps: data.apr !== undefined ? Math.round(parseFloat(data.apr) * 100) : 0,
      minPaymentCents: data.minPayment !== undefined ? toCents(data.minPayment) : 0,
      createdAt: new Date().toISOString()
    };
    db.prepare(
      `INSERT INTO debts (id, userId, name, kind, balanceCents, aprBps, minPaymentCents, createdAt)
       VALUES (@id, @userId, @name, @kind, @balanceCents, @aprBps, @minPaymentCents, @createdAt)`
    ).run(row);
    return this.findById(row.id);
  }

  /**
   * Updates a debt's mutable fields.
   * @param {string} id
   * @param {Object} fields any subset of {name, kind, balance, apr, minPayment}
   * @returns {Promise<Object|null>}
   */
  static async update(id, fields) {
    const current = db.prepare('SELECT * FROM debts WHERE id = ?').get(id);
    if (!current) return null;

    const merged = {
      name: fields.name !== undefined ? fields.name : current.name,
      kind: fields.kind !== undefined ? fields.kind : current.kind,
      balanceCents: fields.balance !== undefined ? toCents(fields.balance) : current.balanceCents,
      aprBps: fields.apr !== undefined ? Math.round(parseFloat(fields.apr) * 100) : current.aprBps,
      minPaymentCents: fields.minPayment !== undefined ? toCents(fields.minPayment) : current.minPaymentCents,
      updatedAt: new Date().toISOString(),
      id
    };
    db.prepare(
      `UPDATE debts
       SET name = @name, kind = @kind, balanceCents = @balanceCents,
           aprBps = @aprBps, minPaymentCents = @minPaymentCents, updatedAt = @updatedAt
       WHERE id = @id`
    ).run(merged);
    return this.findById(id);
  }

  /**
   * Sets a debt's balance in cents (used when recording a payment). Clamped at 0.
   * @param {string} id
   * @param {number} balanceCents
   * @returns {Promise<Object|null>}
   */
  static async setBalanceCents(id, balanceCents) {
    db.prepare('UPDATE debts SET balanceCents = ?, updatedAt = ? WHERE id = ?')
      .run(Math.max(balanceCents, 0), new Date().toISOString(), id);
    return this.findById(id);
  }

  /**
   * Deletes a debt.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const info = db.prepare('DELETE FROM debts WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

export default DebtModel;
