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

    const newUser = await UserModel.create({ username, email, password: hashedPassword });
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
}

export default UserService;
