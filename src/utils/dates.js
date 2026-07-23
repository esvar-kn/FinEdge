const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_ONLY = /^\d{4}-\d{2}$/;

/**
 * Normalizes a user-supplied date (YYYY-MM-DD or any ISO-8601 timestamp) to a
 * full ISO string. Returns null when the value is not a parseable date.
 * @param {*} value
 * @returns {string|null}
 */
export function normalizeDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  // Date-only strings are parsed as UTC midnight by the Date constructor.
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * True when the value is a YYYY-MM month string.
 * @param {*} value
 */
export function isValidMonth(value) {
  return typeof value === 'string' && MONTH_ONLY.test(value) && !isNaN(new Date(`${value}-01`).getTime());
}

/**
 * Converts a YYYY-MM month to an ISO range [from, toExclusive).
 * @param {string} month
 * @returns {{from: string, toExclusive: string}}
 */
export function monthRange(month) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { from: start.toISOString(), toExclusive: end.toISOString() };
}

/**
 * Converts ?from= / ?to= query values into an ISO range. `to` is inclusive of
 * the whole day when given as YYYY-MM-DD. Returns null for an invalid value.
 * @param {string|undefined} from
 * @param {string|undefined} to
 * @returns {{from?: string, toExclusive?: string}|null}
 */
export function queryDateRange(from, to) {
  const range = {};
  if (from !== undefined) {
    const normalized = normalizeDate(from);
    if (!normalized) return null;
    range.from = normalized;
  }
  if (to !== undefined) {
    if (typeof to !== 'string') return null;
    const parsed = new Date(to);
    if (isNaN(parsed.getTime())) return null;
    if (DATE_ONLY.test(to)) {
      parsed.setUTCDate(parsed.getUTCDate() + 1); // whole-day inclusive
    } else {
      parsed.setUTCMilliseconds(parsed.getUTCMilliseconds() + 1);
    }
    range.toExclusive = parsed.toISOString();
  }
  return range;
}

/**
 * The current month as YYYY-MM (UTC).
 */
export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Advances a recurring-rule run date by one period. For monthly/yearly,
 * anchorDay preserves the intended day-of-month across short months
 * (a rule anchored on the 31st fires on Feb 28, then back on Mar 31).
 * @param {string} isoDate
 * @param {'daily'|'weekly'|'monthly'|'yearly'} frequency
 * @param {number} anchorDay
 * @returns {string}
 */
export function advanceDate(isoDate, frequency, anchorDay) {
  const d = new Date(isoDate);
  switch (frequency) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'monthly':
    case 'yearly': {
      const monthsToAdd = frequency === 'monthly' ? 1 : 12;
      // Set day to 1 first so month arithmetic can't skip short months.
      const target = new Date(d);
      target.setUTCDate(1);
      target.setUTCMonth(target.getUTCMonth() + monthsToAdd);
      const daysInTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(anchorDay, daysInTarget));
      return target.toISOString();
    }
  }
  return d.toISOString();
}
