import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import UserModel from '../models/userModel.js';
import { AppError } from '../middleware/errorHandler.js';

class UserService {
  /**
   * Signs a JWT for the given user id.
   * @param {string} userId
   * @returns {string}
   */
  static signToken(userId) {
    return jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
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
      newUser = await UserModel.create({ username, email, password: hashedPassword });
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
  static async authenticateUser(email, password) {
    // findByEmail returns the raw record (including the hash), so one read suffices.
    const rawUser = await UserModel.findByEmail(email);
    if (!rawUser) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isMatch = await bcrypt.compare(password, rawUser.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    const { password: _pw, ...userWithoutPassword } = rawUser;
    const token = this.signToken(rawUser.id);
    return { user: userWithoutPassword, token };
  }

  /**
   * Returns the user's profile (no password hash).
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async getProfile(userId) {
    const rawUser = await UserModel.findById(userId);
    if (!rawUser) {
      throw new AppError('User not found.', 404);
    }
    const { password: _pw, ...userWithoutPassword } = rawUser;
    return userWithoutPassword;
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
