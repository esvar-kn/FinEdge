import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';
import UserModel from '../models/userModel.js';
import { AppError } from '../middleware/errorHandler.js';
import { isSupportedCurrency, SUPPORTED_CURRENCIES } from '../utils/currency.js';

/** Strips secret/internal columns before a user record leaves the service. */
function sanitize(rawUser) {
  const { password, resetTokenHash, resetTokenExpires, ...safe } = rawUser;
  return safe;
}

/** SHA-256 of a reset token — high-entropy tokens don't need bcrypt. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class UserService {
  /**
   * Signs a JWT for the given user id.
   * @param {string} userId
   * @param {boolean} [rememberMe] Issue a longer-lived token.
   * @returns {string}
   */
  static signToken(userId, rememberMe = false) {
    const expiresIn = rememberMe ? config.jwtRememberExpiresIn : config.jwtExpiresIn;
    return jwt.sign({ id: userId }, config.jwtSecret, { expiresIn });
  }

  /**
   * Registers a new user. The service is the single owner of password hashing;
   * the model persists whatever it is given.
   * @param {string} username
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} The created user (no password) and a signed token.
   */
  static async registerUser(username, email, password) {
    if (await UserModel.findByEmail(email)) {
      throw new AppError('Email is already registered.', 400);
    }
    if (await UserModel.findByUsername(username)) {
      throw new AppError('Username is already taken.', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let newUser;
    try {
      newUser = await UserModel.create({
        username,
        email,
        password: hashedPassword,
        currency: config.defaultCurrency
      });
    } catch (error) {
      // UNIQUE constraint backstop: two simultaneous registrations can both
      // pass the pre-checks above, but only one insert can win.
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new AppError('Email or username is already registered.', 400);
      }
      throw error;
    }
    const token = this.signToken(newUser.id);
    return { user: newUser, token };
  }

  /**
   * Validates credentials and returns the user (no password) with a token.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>}
   */
  static async authenticateUser(email, password, rememberMe = false) {
    // findByEmail returns the raw record (including the hash), so one read suffices.
    const rawUser = await UserModel.findByEmail(email);
    if (!rawUser) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isMatch = await bcrypt.compare(password, rawUser.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    const token = this.signToken(rawUser.id, rememberMe);
    return { user: sanitize(rawUser), token };
  }

  /**
   * Returns the user's profile (no password hash or reset token).
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async getProfile(userId) {
    const rawUser = await UserModel.findById(userId);
    if (!rawUser) {
      throw new AppError('User not found.', 404);
    }
    return sanitize(rawUser);
  }

  /**
   * Begins a password reset: generates a one-time token, stores its hash with
   * an expiry, and returns the raw token to the caller (to email or, for a
   * self-hosted setup, log). Returns null when no account matches — the caller
   * still responds with a generic 200 so email addresses can't be enumerated.
   * @param {string} email
   * @returns {Promise<{user: Object, token: string}|null>}
   */
  static async requestPasswordReset(email) {
    const rawUser = await UserModel.findByEmail(email);
    if (!rawUser) return null;

    const token = crypto.randomBytes(32).toString('hex');
    const expiresIso = new Date(Date.now() + config.resetTokenTtlMs).toISOString();
    await UserModel.setResetToken(rawUser.id, hashToken(token), expiresIso);
    return { user: sanitize(rawUser), token };
  }

  /**
   * Completes a password reset given a valid, unexpired token.
   * @param {string} token
   * @param {string} newPassword
   * @returns {Promise<boolean>}
   */
  static async resetPassword(token, newPassword) {
    const rawUser = await UserModel.findByResetTokenHash(hashToken(token), new Date().toISOString());
    if (!rawUser) {
      throw new AppError('Invalid or expired reset token.', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await UserModel.updatePassword(rawUser.id, hashedPassword);
    await UserModel.clearResetToken(rawUser.id);
    return true;
  }

  /**
   * Returns the user's settings plus the list of supported currencies (so a
   * client can render a picker without hardcoding the options).
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async getSettings(userId) {
    const user = await this.getProfile(userId);
    return {
      currency: user.currency,
      supportedCurrencies: SUPPORTED_CURRENCIES
    };
  }

  /**
   * Updates the user's settings (currently just currency) and returns the
   * refreshed profile.
   * @param {string} userId
   * @param {Object} updates {currency}
   * @returns {Promise<Object>}
   */
  static async updateSettings(userId, updates) {
    if (updates.currency !== undefined) {
      if (!isSupportedCurrency(updates.currency)) {
        throw new AppError('Unsupported currency code.', 400);
      }
      await UserModel.updateCurrency(userId, updates.currency.toUpperCase());
    }
    return this.getProfile(userId);
  }

  /**
   * Changes the user's password after verifying the current one.
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<boolean>}
   */
  static async changePassword(userId, currentPassword, newPassword) {
    const rawUser = await UserModel.findById(userId);
    if (!rawUser) {
      throw new AppError('User not found.', 404);
    }

    const isMatch = await bcrypt.compare(currentPassword, rawUser.password);
    if (!isMatch) {
      throw new AppError('Current password is incorrect.', 401);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await UserModel.updatePassword(userId, hashedPassword);
    return true;
  }

  /**
   * Deletes the user's account (and, via cascade, all their transactions)
   * after verifying their password.
   * @param {string} userId
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  static async deleteAccount(userId, password) {
    const rawUser = await UserModel.findById(userId);
    if (!rawUser) {
      throw new AppError('User not found.', 404);
    }

    const isMatch = await bcrypt.compare(password, rawUser.password);
    if (!isMatch) {
      throw new AppError('Password is incorrect.', 401);
    }

    await UserModel.delete(userId);
    return true;
  }
}

export default UserService;
