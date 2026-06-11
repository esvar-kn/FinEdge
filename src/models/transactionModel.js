import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dotenv from 'dotenv';
import { readJSONFile, writeJSONFile } from '../utils/fileHandler.js';

dotenv.config();

// Get absolute path of transactions.json from env, fallback to default
const DB_PATH = path.resolve(process.env.TRANSACTIONS_DB_PATH || 'src/data/transactions.json');

class TransactionModel {
  /**
   * Reads all transactions from data/transactions.json.
   * @returns {Promise<Array<Object>>}
   */
  static async findAll() {
    return await readJSONFile(DB_PATH);
  }

  /**
   * Retrieves all transactions associated with a userId.
   * @param {string} userId 
   * @returns {Promise<Array<Object>>}
   */
  static async findByUserId(userId) {
    const transactions = await this.findAll();
    return transactions.filter(t => t.userId === userId);
  }

  /**
   * Creates and persists a transaction record.
   * @param {Object} txData 
   * @returns {Promise<Object>}
   */
  static async create(txData) {
    const transactions = await this.findAll();
    
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
    await writeJSONFile(DB_PATH, transactions);
    return newTx;
  }

  /**
   * Updates an existing transaction record by ID.
   * @param {string} id 
   * @param {Object} updateData 
   * @returns {Promise<Object|null>}
   */
  static async update(id, updateData) {
    const transactions = await this.findAll();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const updatedTx = {
      ...transactions[index],
      ...updateData,
      // Ensure numerical values are parsed correctly if updated
      amount: updateData.amount !== undefined ? parseFloat(updateData.amount) : transactions[index].amount,
      updatedAt: new Date().toISOString()
    };
    
    transactions[index] = updatedTx;
    await writeJSONFile(DB_PATH, transactions);
    return updatedTx;
  }

  /**
   * Deletes a transaction record by ID.
   * @param {string} id 
   * @returns {Promise<boolean>} True if deleted, false otherwise.
   */
  static async delete(id) {
    const transactions = await this.findAll();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return false;
    
    transactions.splice(index, 1);
    await writeJSONFile(DB_PATH, transactions);
    return true;
  }
}

export default TransactionModel;
