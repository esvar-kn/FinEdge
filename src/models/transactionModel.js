import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { readJSONFile, updateJSONFile } from '../utils/fileHandler.js';

const DB_PATH = config.transactionsDbPath;

class TransactionModel {
  /**
   * Reads all transactions from the data store.
   * @returns {Promise<Array<Object>>}
   */
  static async findAll() {
    return await readJSONFile(DB_PATH);
  }

  /**
   * Retrieves all transactions belonging to a user.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  static async findByUserId(userId) {
    const transactions = await this.findAll();
    return transactions.filter(t => t.userId === userId);
  }

  /**
   * Creates and persists a transaction record (atomic read-modify-write).
   * @param {Object} txData
   * @returns {Promise<Object>}
   */
  static async create(txData) {
    return updateJSONFile(DB_PATH, (transactions) => {
      const newTx = {
        id: uuidv4(),
        userId: txData.userId,
        type: txData.type, // 'income' or 'expense'
        category: txData.category,
        amount: parseFloat(txData.amount),
        description: txData.description || '',
        date: txData.date || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      transactions.push(newTx);
      return { data: transactions, result: newTx };
    });
  }

  /**
   * Updates a transaction by ID (atomic read-modify-write).
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object|null>} The updated record, or null if not found.
   */
  static async update(id, updateData) {
    return updateJSONFile(DB_PATH, (transactions) => {
      const index = transactions.findIndex(t => t.id === id);
      if (index === -1) return { data: transactions, result: null };

      const updatedTx = {
        ...transactions[index],
        ...updateData,
        amount: updateData.amount !== undefined
          ? parseFloat(updateData.amount)
          : transactions[index].amount,
        updatedAt: new Date().toISOString()
      };
      transactions[index] = updatedTx;
      return { data: transactions, result: updatedTx };
    });
  }

  /**
   * Deletes a transaction by ID (atomic read-modify-write).
   * @param {string} id
   * @returns {Promise<boolean>} True if a record was removed.
   */
  static async delete(id) {
    return updateJSONFile(DB_PATH, (transactions) => {
      const index = transactions.findIndex(t => t.id === id);
      if (index === -1) return { data: transactions, result: false };

      transactions.splice(index, 1);
      return { data: transactions, result: true };
    });
  }
}

export default TransactionModel;
