import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

/**
 * Brute-force protection for the credential endpoints (register, login,
 * password change). Disabled under NODE_ENV=test so suites can register
 * freely; limits are configurable via AUTH_RATE_LIMIT_MAX / _WINDOW_MS.
 */
export const authLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
  message: {
    status: 'fail',
    message: 'Too many authentication attempts. Please try again later.'
  }
});
