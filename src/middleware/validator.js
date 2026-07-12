import { AppError } from './errorHandler.js';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';


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
 * Validates transaction inputs.
 */
export function validateTransaction(req, res, next) {
  const { amount, type, category } = req.body;
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
