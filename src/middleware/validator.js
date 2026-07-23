import { AppError } from './errorHandler.js';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { normalizeDate } from '../utils/dates.js';

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];


/**
 * Validates registration payloads.
 */
export function validateRegister(req, res, next) {
  const { username, email, password } = req.body;
  const errors = [];

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    errors.push('Username must be a string and contain at least 3 characters.');
  }

  // Simple email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be a string and contain at least 6 characters.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), 400));
  }

  next();
}

/**
 * Validates login payloads.
 */
export function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), 400));
  }

  next();
}

/**
 * Validates password-change payloads.
 */
export function validatePasswordChange(req, res, next) {
  const { currentPassword, newPassword } = req.body;
  const errors = [];

  if (!currentPassword || typeof currentPassword !== 'string') {
    errors.push('Current password is required.');
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    errors.push('New password must be a string and contain at least 6 characters.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), 400));
  }

  next();
}

/**
 * Validates account-deletion payloads (password confirmation).
 */
export function validateAccountDelete(req, res, next) {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return next(new AppError('Password confirmation is required to delete the account.', 400));
  }

  next();
}

/**
 * Validates transaction inputs.
 */
export function validateTransaction(req, res, next) {
  const { amount, type, category, date } = req.body;
  const errors = [];

  const parsedAmount = parseFloat(amount);
  if (amount === undefined || isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.push('Amount must be a positive number greater than 0.');
  }

  const validTypes = ['income', 'expense'];
  if (!type || !validTypes.includes(type)) {
    errors.push("Type must be either 'income' or 'expense'.");
  }

  if (!category || typeof category !== 'string' || category.trim().length === 0) {
    errors.push('Category must be a non-empty string.');
  }

  if (date !== undefined && !normalizeDate(date)) {
    errors.push('Date must be a valid YYYY-MM-DD or ISO-8601 date string.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), 400));
  }

  next();
}

/**
 * Validates transaction update payloads. Fields are optional (partial update),
 * but any field that IS provided must be valid — closing the gap where a PUT
 * could set a negative/non-numeric amount or an invalid type.
 */
export function validateTransactionUpdate(req, res, next) {
  const { amount, type, category } = req.body;
  const errors = [];

  if (amount !== undefined) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.push('Amount must be a positive number greater than 0.');
    }
  }

  if (type !== undefined && !['income', 'expense'].includes(type)) {
    errors.push("Type must be either 'income' or 'expense'.");
  }

  if (category !== undefined && (typeof category !== 'string' || category.trim().length === 0)) {
    errors.push('Category must be a non-empty string.');
  }

  if (req.body.date !== undefined && !normalizeDate(req.body.date)) {
    errors.push('Date must be a valid YYYY-MM-DD or ISO-8601 date string.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), 400));
  }

  next();
}

/**
 * Validates budget upsert payloads (PUT /api/budgets/:category).
 */
export function validateBudget(req, res, next) {
  const { limit } = req.body;
  const errors = [];

  const parsedLimit = parseFloat(limit);
  if (limit === undefined || isNaN(parsedLimit) || parsedLimit <= 0) {
    errors.push('Limit must be a positive number greater than 0.');
  }

  if (!req.params.category || req.params.category.trim().length === 0) {
    errors.push('Category must be a non-empty string.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), 400));
  }

  next();
}

/**
 * Validates recurring-rule creation payloads.
 */
export function validateRecurringRule(req, res, next) {
  const { amount, type, category, frequency, startDate, endDate } = req.body;
  const errors = [];

  const parsedAmount = parseFloat(amount);
  if (amount === undefined || isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.push('Amount must be a positive number greater than 0.');
  }

  if (!type || !['income', 'expense'].includes(type)) {
    errors.push("Type must be either 'income' or 'expense'.");
  }

  if (!category || typeof category !== 'string' || category.trim().length === 0) {
    errors.push('Category must be a non-empty string.');
  }

  if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
    errors.push(`Frequency must be one of: ${VALID_FREQUENCIES.join(', ')}.`);
  }

  if (startDate !== undefined && !normalizeDate(startDate)) {
    errors.push('startDate must be a valid YYYY-MM-DD or ISO-8601 date string.');
  }

  if (endDate !== undefined && !normalizeDate(endDate)) {
    errors.push('endDate must be a valid YYYY-MM-DD or ISO-8601 date string.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), 400));
  }

  next();
}

/**
 * Authentication middleware: verifies the Bearer JWT and attaches req.userId.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized. Bearer token is missing or malformed.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return next(new AppError('Unauthorized. Invalid or expired token.', 401));
  }
}
