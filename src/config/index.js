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
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // "Remember me" issues a longer-lived token so family members aren't forced
  // to re-login weekly.
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  // Password-reset token lifetime (ms). Default 1 hour.
  resetTokenTtlMs: parseInt(process.env.RESET_TOKEN_TTL_MS || String(60 * 60 * 1000), 10),
  savingsWarningThreshold: parseFloat(process.env.SAVINGS_WARNING_THRESHOLD || '0.70'),
  dbPath: path.resolve(process.env.DB_PATH || 'src/data/finedge.db'),
  // AI insights (optional): without an API key the endpoint falls back to rules
  groqApiKey: process.env.GROQ_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
  // Default currency for new accounts (must be a code in SUPPORTED_CURRENCIES)
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
  // Security hardening
  corsOrigin: process.env.CORS_ORIGIN || '', // empty = no CORS headers (same-origin only)
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10),
  authRateLimitWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  backupDir: path.resolve(process.env.BACKUP_DIR || 'src/data/backups'),
  backupKeep: parseInt(process.env.BACKUP_KEEP || '7', 10),
  // Legacy JSON store paths — only used by scripts/migrate-json-to-sqlite.js
  usersDbPath: path.resolve(process.env.USERS_DB_PATH || 'src/data/users.json'),
  transactionsDbPath: path.resolve(process.env.TRANSACTIONS_DB_PATH || 'src/data/transactions.json'),
};

export default config;
