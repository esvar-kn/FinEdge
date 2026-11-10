import NetWorthModel from '../models/netWorthModel.js';
import UserModel from '../models/userModel.js';
import AccountService from './accountService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today as a YYYY-MM-DD string (UTC), matching the backup stamp format. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

class NetWorthService {
  /**
   * Computes a user's current net worth and records it as today's snapshot.
   * @param {string} userId
   * @returns {Promise<number>} the net worth recorded
   */
  static async recordSnapshot(userId) {
    const { netWorth } = await AccountService.getAccounts(userId);
    await NetWorthModel.upsert(userId, today(), Math.round(netWorth * 100));
    return netWorth;
  }

  /**
   * Records today's snapshot for every user. Used by the daily job so history
   * fills even for users who don't open the app.
   * @returns {Promise<number>} number of users snapshotted
   */
  static async recordAllSnapshots() {
    const users = await UserModel.findAll();
    for (const user of users) {
      await this.recordSnapshot(user.id);
    }
    return users.length;
  }

  /**
   * Returns a user's net-worth history over the last `days` days (inclusive of
   * today). Today's snapshot is refreshed first so the latest point reflects
   * current balances.
   * @param {string} userId
   * @param {number} days
   * @returns {Promise<Array<{date: string, netWorth: number}>>}
   */
  static async getHistory(userId, days) {
    await this.recordSnapshot(userId);

    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const fromDate = from.toISOString().slice(0, 10);

    return NetWorthModel.history(userId, fromDate);
  }

  /**
   * Snapshots all users now, then once a day. The interval is unref'd so it
   * never keeps the process alive on its own (mirrors scheduleBackups).
   */
  static scheduleSnapshots() {
    const safeRun = () =>
      this.recordAllSnapshots()
        .then((n) => {
          if (n > 0) console.log(`Net worth snapshotted for ${n} user(s).`);
        })
        .catch((err) => console.error('Net worth snapshot failed:', err));

    safeRun();
    setInterval(safeRun, DAY_MS).unref();
  }
}

export default NetWorthService;
