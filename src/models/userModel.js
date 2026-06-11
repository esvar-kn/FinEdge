import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { readJSONFile, writeJSONFile } from '../utils/fileHandler.js';

dotenv.config();

// Get absolute path of users.json from env, fallback to default
const DB_PATH = path.resolve(process.env.USERS_DB_PATH || 'src/data/users.json');

class UserModel {
  /**
   * Reads all users from data/users.json.
   * @returns {Promise<Array<Object>>}
   */
  static async findAll() {
    return await readJSONFile(DB_PATH);
  }

  /**
   * Finds user by email.
   * @param {string} email 
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    const users = await this.findAll();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Saves a new user record.
   * @param {Object} userData 
   * @returns {Promise<Object>} The created user record.
   */
  static async create(userData) {
    const users = await this.findAll();
    
    let password = userData.password;
    const isAlreadyHashed = typeof password === 'string' && password.startsWith('$2') && password.length === 60;
    if (!isAlreadyHashed && password) {
      const salt = await bcrypt.genSalt(10);
      password = await bcrypt.hash(password, salt);
    }
    
    const newUser = {
      id: uuidv4(),
      username: userData.username,
      email: userData.email,
      password,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    await writeJSONFile(DB_PATH, users);
    
    // Return the new user without password for safety
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }
}

export default UserModel;
