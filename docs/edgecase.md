# Project Edge Cases & Mitigation Strategies: FinEdge Tracker API

This document details the critical edge cases, structural limitations, security vulnerabilities, and error scenarios for the FinEdge Personal Finance Tracker API, alongside specific code-level mitigation strategies.

---

## 1. Asynchronous File Storage & Concurrent Writing (Race Conditions)

### 1.1. Concurrent Writes to JSON files
- **Description**: Two requests concurrently execute write operations (e.g., two users registering at the same millisecond, or a user logging multiple expenses simultaneously). One write operation overrides the other, causing data loss or JSON corruption.
- **Impact**: Financial logs are deleted, or the JSON files become corrupt and throw parser exceptions.
- **Mitigation**:
  - Implement a basic Write Queue or Mutex Lock in `src/utils/fileHandler.js` using a promise chain:
    ```javascript
    let writeQueue = Promise.resolve();
    
    export const writeJSONFileSafe = (filePath, data) => {
      writeQueue = writeQueue.then(async () => {
        const tempPath = `${filePath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
        await fs.rename(tempPath, filePath); // Atomic rename prevents file corruption
      });
      return writeQueue;
    };
    ```

### 1.2. Manually Corrupted JSON Files
- **Description**: A developer or external script edits `users.json` or `transactions.json` and leaves a trailing comma or malformed syntax.
- **Impact**: The server crashes on startup or throws an unhandled SyntaxError during parsing.
- **Mitigation**:
  - Encapsulate file reads in try-catch structures within `src/utils/fileHandler.js`.
  - If parsing fails, back up the corrupted file to `filename.corrupt` and return an empty array `[]` to prevent system-wide API crashes.

---

## 2. Security & Request Validation Edge Cases

### 2.1. Transaction Ownership Hijacking (ID Manipulation)
- **Description**: User A requests to update or delete a transaction: `PUT /api/transactions/12345` with details of their expense. However, transaction `12345` belongs to User B.
- **Impact**: Unauthorized modifications (or deletions) of other users' financial records.
- **Mitigation**:
  - Ensure the database operation in the Service/Model layer always queries by **both** the transaction `id` and the owner's `userId`:
    ```javascript
    // Inside transactionModel.js
    static async update(id, userId, updateData) {
      const txs = await this.findAll();
      const index = txs.findIndex(t => t.id === id && t.userId === userId);
      if (index === -1) return null; // Returns null if transaction does not belong to the user
      txs[index] = { ...txs[index], ...updateData, updatedAt: new Date().toISOString() };
      await fileHandler.write(txs);
      return txs[index];
    }
    ```

### 2.2. Numeric Boundaries on Transaction Amounts
- **Description**: An attacker inputs a negative amount (`amount: -100`) or extreme values (`amount: 9999999999999`) or non-numeric items (`amount: "ten dollars"`).
- **Impact**: Negative values invert balance calculations, turning an expense into income, or breaking numerical summary limits.
- **Mitigation**:
  - Implement rigorous type check constraints inside `src/middleware/validator.js` using schema validation:
    ```javascript
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number greater than 0.')
    ```

### 2.3. Password Injection & Plaintext Leaks
- **Description**: Weak verification schemas allow registering usernames with SQL-like syntax or password strings that leak credentials in error logs.
- **Impact**: SQL injection vulnerabilities (in case of future database migrations) and logging sensitive data.
- **Mitigation**:
  - Sanitize string inputs using validation sanitizers.
  - Never include raw `req.body.password` in debug logs or custom AppError message builders.

---

## 3. Data Flow & Transaction Edge Cases

### 3.1. Division by Zero in Savings Analytics
- **Description**: A user logs expenses but has zero income (`totalIncome === 0`).
- **Impact**: The AI/analytics engine throws a `NaN` or `Infinity` error when calculating the savings ratio (`totalExpenses / totalIncome`).
- **Mitigation**:
  - Safeguard the calculation in `src/utils/analytics.js` and `src/utils/insightHelper.js`:
    ```javascript
    const savingsRatio = totalIncome > 0 ? (totalExpenses / totalIncome) : 0;
    ```

### 3.2. Missing or Future Dates on Transactions
- **Description**: User posts a transaction with a future date or leaves the date field blank.
- **Impact**: Distorts monthly reports and insights calculations.
- **Mitigation**:
  - If a transaction request does not contain a `date` parameter, default to the current timestamp: `new Date().toISOString()`.
  - Validate that the parsed date is not in the future relative to the system clock.
