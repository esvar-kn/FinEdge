# Phase 6 Evaluation Criteria: Financial Analytics & AI-Driven Insights

This document outlines the evaluation targets and verification tests for Phase 6 (Analytics computations and AI logic).

---

## 1. Evaluation Objectives
- Verify calculations inside `analytics.js` (total income, total expense, savings rates, and category group spend sums).
- Confirm rules inside `aiHelper.js` trigger alerts correctly based on balance thresholds (e.g. expenses exceeding 70% of income).
- Ensure that the `/summary` route aggregates both quantitative calculations and qualitative advice.

---

## 2. Detailed Success Criteria

### 2.1. Arithmetic Consistency
- **Net Balance**: Must represent mathematically: `Total Income - Total Expenses`.
- **Category breakdown**: Group sums must match the exact sum of individual transactions within those groups.

### 2.2. Trigger Logic for AI Recommendations
- **70% Spending Warning**: If Total Expenses > `0.7 * Total Income`, the response must contain an alert string flagging the overspending.
- **Null Income Scenario**: If the user has zero income but some expenses, the engine must handle the logic gracefully (no divide-by-zero crashes) and output a prompt suggesting the user record an income source.

---

## 3. Step-by-Step Test Scenarios

### Test Scenario 6.1: Balance Summary Verification
- **Action**: Seed the data store with 3 transactions for a user:
  1. Income: Category "Salary", Amount: 2000
  2. Expense: Category "Food", Amount: 500
  3. Expense: Category "Rent", Amount: 1000
  Call the summary endpoint:
  ```bash
  curl -H "X-User-Id: TEST_USER_UUID" http://localhost:3000/api/transactions/summary
  ```
- **Expected Result**: The endpoint returns:
  - `totalIncome: 2000`
  - `totalExpenses: 1500`
  - `netBalance: 500`
  - `categoryBreakdown: { "food": 500, "rent": 1000 }`
  - An AI insight array containing a warning: since expenses (1500) exceed 70% of income (1400 threshold), an overspending alert is triggered.
