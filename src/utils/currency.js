/**
 * Supported display currencies. Amounts are always stored as integer minor
 * units and returned as decimal numbers; currency is a per-user *display*
 * preference — FinEdge does not convert between currencies.
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' }
];

const CODES = new Set(SUPPORTED_CURRENCIES.map(c => c.code));

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isSupportedCurrency(code) {
  return typeof code === 'string' && CODES.has(code.toUpperCase());
}
