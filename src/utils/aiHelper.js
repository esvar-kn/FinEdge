import dotenv from 'dotenv';
dotenv.config();

/**
 * Generates rule-based financial advice insights from financial summaries.
 * Handles edge case where total income is 0.
 * @param {Object} summary 
 * @returns {Array<string>} List of actionable insight strings.
 */
export function generateInsights(summary) {
  const { totalIncome, totalExpenses, categoryBreakdown } = summary;
  const insights = [];

  // Edgecase check: No income registered
  if (totalIncome === 0) {
    if (totalExpenses > 0) {
      insights.push("Warning: You have logged expenses but no income source. Consider registering an income source to balance your budget.");
    } else {
      insights.push("No transaction records detected. Start logging income and expenses to generate financial insights.");
    }
    return insights;
  }

  // 1. Savings Alert (trigger warning if expenses exceed configured threshold of total income)
  const threshold = parseFloat(process.env.SAVINGS_WARNING_THRESHOLD || 0.70);
  const spendingRatio = totalExpenses / totalIncome;
  if (spendingRatio > threshold) {
    insights.push(`Warning: Your total expenses consume ${(spendingRatio * 100).toFixed(1)}% of your income. This exceeds the recommended ${(threshold * 100).toFixed(0)}% threshold. Try restricting non-essential spending.`);
  } else {
    const savingsRatio = 1 - spendingRatio;
    insights.push(`Healthy Finance! You are saving ${(savingsRatio * 100).toFixed(1)}% of your monthly income.`);
  }

  // 2. Budget Warnings & Actionable Category Spend Peaks
  if (totalExpenses > 0) {
    let topCategory = '';
    let maxSpend = 0;

    for (const [cat, amount] of Object.entries(categoryBreakdown)) {
      if (amount > maxSpend) {
        maxSpend = amount;
        topCategory = cat;
      }
    }

    if (topCategory) {
      const percentage = (maxSpend / totalExpenses) * 100;
      insights.push(`Your top spending category is '${topCategory}', constituting ${percentage.toFixed(1)}% of your total expenses.`);

      // Category-specific actionable tips
      if (topCategory.toLowerCase() === 'food') {
        insights.push("Your food spending constitutes a major portion of your expenses; consider cooking at home to improve savings.");
      } else if (['entertainment', 'leisure', 'shopping', 'movies'].includes(topCategory.toLowerCase())) {
        insights.push(`Leisure spending on '${topCategory}' is high. Consider setting strict budget limits on non-essential categories.`);
      } else {
        insights.push(`Review your '${topCategory}' transaction items to check for recurring subscriptions or bills that can be trimmed.`);
      }
    }
  }

  return insights;
}
