import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

class UserModel {
  /**
   * Reads all users from the data store (raw records, incl. password hashes).
   * @returns {Promise<Array<Object>>}
   */
  static async findAll() {
    return db.prepare('SELECT * FROM users').all();
  }

  /**
   * Finds a user by id. Returns the raw record incl. hash, or null.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  }

  /**
   * Finds a user by email (case-insensitive via COLLATE NOCASE). Returns the
   * raw record incl. hash.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
  }

  /**
   * Finds a user by username (case-insensitive via COLLATE NOCASE).
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  static async findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
  }

  /**
   * Persists a new user record. The password must already be hashed by the
   * service layer — the model does not hash. Returns the record without password.
   * UNIQUE constraints on email/username make duplicate registration impossible
   * even under concurrent requests; violations surface as SqliteError with
   * code SQLITE_CONSTRAINT_UNIQUE for the service to translate.
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  static async create(userData) {
    const newUser = {
      id: uuidv4(),
      username: userData.username,
      email: userData.email,
      password: userData.password,
      currency: userData.currency,
      createdAt: new Date().toISOString()
    };
    db.prepare(
      'INSERT INTO users (id, username, email, password, currency, createdAt) VALUES (@id, @username, @email, @password, @currency, @createdAt)'
    ).run(newUser);

    const { password: _pw, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  /**
   * Updates the user's currency preference.
   * @param {string} id
   * @param {string} currency ISO code (already validated by the service)
   * @returns {Promise<boolean>} True if a record was updated.
   */
  static async updateCurrency(id, currency) {
    const info = db.prepare('UPDATE users SET currency = ? WHERE id = ?').run(currency, id);
    return info.changes > 0;
  }

  /**
   * Stores a password-reset token hash and its expiry (ISO string) on a user.
   * @param {string} id
   * @param {string} tokenHash
   * @param {string} expiresIso
   * @returns {Promise<void>}
   */
  static async setResetToken(id, tokenHash, expiresIso) {
    db.prepare('UPDATE users SET resetTokenHash = ?, resetTokenExpires = ? WHERE id = ?')
      .run(tokenHash, expiresIso, id);
  }

  /**
   * Finds a user by an unexpired reset-token hash. Returns null if no match or
   * the token has expired.
   * @param {string} tokenHash
   * @param {string} nowIso
   * @returns {Promise<Object|null>}
   */
  static async findByResetTokenHash(tokenHash, nowIso) {
    return db
      .prepare('SELECT * FROM users WHERE resetTokenHash = ? AND resetTokenExpires > ?')
      .get(tokenHash, nowIso) || null;
  }

  /**
   * Clears any reset token on a user (called after a successful reset).
   * @param {string} id
   * @returns {Promise<void>}
   */
  static async clearResetToken(id) {
    db.prepare('UPDATE users SET resetTokenHash = NULL, resetTokenExpires = NULL WHERE id = ?').run(id);
  }

  /**
   * Replaces a user's password hash.
   * @param {string} id
   * @param {string} hashedPassword
   * @returns {Promise<boolean>} True if a record was updated.
   */
  static async updatePassword(id, hashedPassword) {
    const info = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, id);
    return info.changes > 0;
  }

  /**
   * Deletes a user; ON DELETE CASCADE removes their transactions too.
   * @param {string} id
   * @returns {Promise<boolean>} True if a record was removed.
   */
  static async delete(id) {
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

export default UserModel;
