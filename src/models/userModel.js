import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { readJSONFile, updateJSONFile } from '../utils/fileHandler.js';

const DB_PATH = config.usersDbPath;

class UserModel {
  /**
   * Reads all users from the data store.
   * @returns {Promise<Array<Object>>}
   */
  static async findAll() {
    return await readJSONFile(DB_PATH);
  }

  /**
   * Finds a user by email (case-insensitive). Returns the raw record incl. hash.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    const users = await this.findAll();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Finds a user by username (case-insensitive).
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  static async findByUsername(username) {
    const users = await this.findAll();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  /**
   * Persists a new user record. The password must already be hashed by the
   * service layer — the model does not hash. Returns the record without password.
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  static async create(userData) {
    return updateJSONFile(DB_PATH, (users) => {
      const newUser = {
        id: uuidv4(),
        username: userData.username,
        email: userData.email,
        password: userData.password,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      const { password: _pw, ...userWithoutPassword } = newUser;
      return { data: users, result: userWithoutPassword };
    });
  }
}

export default UserModel;
