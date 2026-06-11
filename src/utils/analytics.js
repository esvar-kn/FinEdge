/**
 * Calculates aggregates (total income, expenses, balance, and category breakdowns) from transaction list.
 * @param {Array<Object>} transactions 
 * @returns {Object}
 */
export function calculateSummary(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryBreakdown = {};

  transactions.forEach(t => {
    const amount = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amount;
    } else if (t.type === 'expense') {
      totalExpenses += amount;
      
      const category = t.category.toLowerCase().trim();
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + amount;
    }
  });

  const netBalance = totalIncome - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    netBalance,
    categoryBreakdown
  };
}
