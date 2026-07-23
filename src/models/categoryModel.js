import db from '../db/index.js';

class CategoryModel {
  /**
   * Every distinct category the user has used across transactions, budgets,
   * and recurring rules — in the original (display) form it was first stored.
   * @param {string} userId
   * @returns {Promise<Array<string>>}
   */
  static async distinctByUser(userId) {
    return db
      .prepare(
        `SELECT category FROM transactions WHERE userId = @userId
         UNION
         SELECT category FROM budgets WHERE userId = @userId
         UNION
         SELECT category FROM recurring_rules WHERE userId = @userId
         ORDER BY category`
      )
      .all({ userId })
      .map(r => r.category);
  }
}

export default CategoryModel;
