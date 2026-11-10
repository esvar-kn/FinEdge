import db from '../db/index.js';

class RateModel {
  /**
   * All stored rates as { code: perUsd }.
   * @returns {Promise<Object<string, number>>}
   */
  static async map() {
    const rows = db.prepare('SELECT code, perUsd FROM exchange_rates').all();
    const out = {};
    for (const r of rows) out[r.code] = r.perUsd;
    return out;
  }

  /**
   * All stored rates with their as-of timestamp, for the API.
   * @returns {Promise<Array<{code: string, perUsd: number, asOf: string}>>}
   */
  static async all() {
    return db.prepare('SELECT code, perUsd, asOf FROM exchange_rates ORDER BY code').all();
  }

  /** The newest asOf timestamp across all rates, or null when none stored. */
  static async latestAsOf() {
    const row = db.prepare('SELECT MAX(asOf) AS asOf FROM exchange_rates').get();
    return row ? row.asOf : null;
  }

  /**
   * Inserts or updates rates. `rates` is { code: perUsd }.
   * @param {Object<string, number>} rates
   * @param {string} asOf ISO timestamp
   * @returns {Promise<void>}
   */
  static async upsertMany(rates, asOf) {
    const stmt = db.prepare(
      `INSERT INTO exchange_rates (code, perUsd, asOf) VALUES (@code, @perUsd, @asOf)
       ON CONFLICT(code) DO UPDATE SET perUsd = excluded.perUsd, asOf = excluded.asOf`
    );
    db.transaction(() => {
      for (const [code, perUsd] of Object.entries(rates)) {
        stmt.run({ code, perUsd, asOf });
      }
    })();
  }

  /** Number of stored rate rows. */
  static async count() {
    return db.prepare('SELECT COUNT(*) AS n FROM exchange_rates').get().n;
  }
}

export default RateModel;
