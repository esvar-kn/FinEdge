import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const toAmount = (cents) => cents / 100;

class NetWorthModel {
  /**
   * Records (or overwrites) a day's net-worth snapshot for a user. One row per
   * calendar day per user; a same-day re-run updates the stored value so the
   * latest point always reflects current balances.
   * @param {string} userId
   * @param {string} date YYYY-MM-DD
   * @param {number} netWorthCents
   * @returns {Promise<void>}
   */
  static async upsert(userId, date, netWorthCents) {
    db.prepare(
      `INSERT INTO net_worth_snapshots (id, userId, date, netWorthCents, createdAt)
       VALUES (@id, @userId, @date, @netWorthCents, @createdAt)
       ON CONFLICT(userId, date)
       DO UPDATE SET netWorthCents = excluded.netWorthCents, createdAt = excluded.createdAt`
    ).run({
      id: uuidv4(),
      userId,
      date,
      netWorthCents,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Returns a user's net-worth snapshots on or after a date, oldest first.
   * @param {string} userId
   * @param {string} fromDate YYYY-MM-DD
   * @returns {Promise<Array<{date: string, netWorth: number}>>}
   */
  static async history(userId, fromDate) {
    return db
      .prepare(
        'SELECT date, netWorthCents FROM net_worth_snapshots WHERE userId = ? AND date >= ? ORDER BY date ASC'
      )
      .all(userId, fromDate)
      .map((r) => ({ date: r.date, netWorth: toAmount(r.netWorthCents) }));
  }
}

export default NetWorthModel;
