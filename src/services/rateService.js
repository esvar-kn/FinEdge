import RateModel from '../models/rateModel.js';
import { DEFAULT_RATES_PER_USD, isSupportedCurrency } from '../utils/currency.js';

const DAY_MS = 24 * 60 * 60 * 1000;

class RateService {
  /**
   * Seeds the rate table with static defaults if it is empty, so conversion
   * works offline from first run.
   * @returns {Promise<void>}
   */
  static async ensureSeeded() {
    if ((await RateModel.count()) === 0) {
      await RateModel.upsertMany(DEFAULT_RATES_PER_USD, new Date().toISOString());
    }
  }

  /**
   * Returns stored rates (seeding first if needed) with the latest as-of time.
   * @returns {Promise<{base: string, asOf: string, rates: Object<string, number>}>}
   */
  static async getRates() {
    await this.ensureSeeded();
    return {
      base: 'USD',
      asOf: await RateModel.latestAsOf(),
      rates: await RateModel.map()
    };
  }

  /**
   * Converts integer cents from one currency to another using stored rates
   * (rate = units per USD). Returns integer cents in the target currency.
   * Unknown codes or a missing rate fall back to a 1:1 conversion so balances
   * never vanish.
   * @param {number} cents
   * @param {string} from
   * @param {string} to
   * @param {Object<string, number>} rates { code: perUsd }
   * @returns {number}
   */
  static convertCents(cents, from, to, rates) {
    const f = String(from).toUpperCase();
    const t = String(to).toUpperCase();
    if (f === t) return cents;
    const fromRate = rates[f];
    const toRate = rates[t];
    if (!fromRate || !toRate) return cents;
    const usd = cents / fromRate;
    return Math.round(usd * toRate);
  }

  /**
   * Best-effort refresh from a free public rates API (no key required). On any
   * failure the stored/seed rates are kept. Only the supported currencies are
   * recorded. Skipped under NODE_ENV=test to keep tests offline/deterministic.
   * @returns {Promise<boolean>} true if rates were updated
   */
  static async refreshFromApi() {
    if (process.env.NODE_ENV === 'test') return false;
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) return false;
      const body = await res.json();
      const rates = body && body.rates;
      if (!rates) return false;
      const filtered = {};
      for (const code of Object.keys(DEFAULT_RATES_PER_USD)) {
        if (isSupportedCurrency(code) && typeof rates[code] === 'number') {
          filtered[code] = rates[code];
        }
      }
      if (Object.keys(filtered).length === 0) return false;
      await RateModel.upsertMany(filtered, new Date().toISOString());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Seeds now, attempts a live refresh, then refreshes once a day. Unref'd so
   * it never keeps the process alive on its own.
   */
  static scheduleRefresh() {
    const safeRun = () =>
      this.ensureSeeded()
        .then(() => this.refreshFromApi())
        .then((updated) => { if (updated) console.log('Exchange rates refreshed.'); })
        .catch((err) => console.error('Exchange rate refresh failed:', err));

    safeRun();
    setInterval(safeRun, DAY_MS).unref();
  }
}

export default RateService;
