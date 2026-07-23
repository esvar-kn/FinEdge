import db from '../src/db/index.js';

/** Empties both tables. Transactions first is not required (CASCADE), but explicit. */
export function resetDatabase() {
  db.exec('DELETE FROM transactions; DELETE FROM users;');
}

/** Empties only the transactions table (keeps registered users). */
export function clearTransactions() {
  db.exec('DELETE FROM transactions;');
}
