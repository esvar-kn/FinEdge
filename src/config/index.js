import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// Fail fast: a missing secret would otherwise fall back to a hardcoded value,
// letting anyone forge tokens. Refuse to start without it.
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET is not set. Define it in your .env file before starting FinEdge.'
  );
}

// Nudge if the secret is still one of the well-known placeholder values.
const KNOWN_WEAK_SECRETS = new Set(['super_secret_signing_key', 'your_jwt_signing_key_here']);
if (KNOWN_WEAK_SECRETS.has(JWT_SECRET)) {
  console.warn(
    'WARNING: JWT_SECRET is set to a default/example value. Replace it with a long random string before deploying.'
  );
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  jwtSecret: JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  savingsWarningThreshold: parseFloat(process.env.SAVINGS_WARNING_THRESHOLD || '0.70'),
  usersDbPath: path.resolve(process.env.USERS_DB_PATH || 'src/data/users.json'),
  transactionsDbPath: path.resolve(process.env.TRANSACTIONS_DB_PATH || 'src/data/transactions.json'),
};

export default config;
