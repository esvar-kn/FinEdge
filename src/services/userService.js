import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import UserModel from '../models/userModel.js';
import { AppError } from '../middleware/errorHandler.js';

class UserService {
  /**
   * Helper to sign a JWT token.
   * @param {string} userId 
   * @returns {string}
   */
  static signToken(userId) {
    return jwt.sign(
      { id: userId },
      process.env.JWT_SECRET || 'super_secret_signing_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
  }

  /**
   * Registers a new user with email duplicate verification and password hashing.
   * @param {string} username 
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} The created user record and signed token.
   */
  static async registerUser(username, email, password) {
    // Check if email already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new AppError('Email is already registered.', 400);
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user profile
    const newUser = await UserModel.create({
      username,
      email,
      password: hashedPassword
    });

    const token = this.signToken(newUser.id);
    return { user: newUser, token };
  }

  /**
   * Validates user credentials.
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} Validated user profile and signed token.
   */
  static async authenticateUser(email, password) {
    const user = await UserModel.findByEmail(email);
    
    // Find password field for check (Model layer returns without password by default on create,
    // so we need to fetch the raw list entry here to compare).
    const users = await UserModel.findAll();
    const rawUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!rawUser) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isMatch = await bcrypt.compare(password, rawUser.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = rawUser;
    const token = this.signToken(rawUser.id);
    return { user: userWithoutPassword, token };
  }
}

export default UserService;
