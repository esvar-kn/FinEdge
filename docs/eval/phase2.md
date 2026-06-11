# Phase 2 Evaluation Criteria: Asynchronous JSON Models & Data Persistence

This document outlines the validation steps and success standards for evaluating Phase 2 of the FinEdge API (Data Access and Persistence layer).

---

## 1. Evaluation Objectives
- Verify that `fileHandler.js` reads and writes JSON objects safely using non-blocking, async operations.
- Verify `UserModel` retrieves existing records, isolates emails, and appends new registrations with unique UUIDs.
- Verify `TransactionModel` handles all CRUD operations on `transactions.json` without failing.

---

## 2. Detailed Success Criteria

### 2.1. File Utility Integrity
- The files helper must wrap operational file failures. If a file does not exist, `readJSONFile()` must return `[]` instead of throwing a fatal error.
- All model methods must be asynchronous and return native Javascript Promises.

### 2.2. User Model Schema Conformance
- Calling `UserModel.create(userData)` must save a record with the fields: `id` (valid UUID), `username`, `email`, `password`, and `createdAt` (ISO timestamp).

### 2.3. Transaction Model CRUD Capabilities
- Creating a transaction must output a record referencing the parent `userId`.
- Updating a transaction by ID must selectively apply partial changes (e.g. updating description only, keeping other details intact).
- Deleting a transaction by ID must successfully purge the item from the persistent storage array.

---

## 3. Step-by-Step Test Scenarios

### Test Scenario 2.1: Verification of File Recovery Handlers
- **Action**: Call `readJSONFile` on a non-existent file or path (e.g., `src/data/missing.json`).
- **Expected Result**: The function must return an empty list `[]` without triggering an unhandled file rejection block.

### Test Scenario 2.2: Mock Operations Verification Script
- **Action**: Execute a script (e.g. `node src/scratch/testModels.js`) that performs:
  1. `UserModel.create({ username: "testuser", email: "test@domain.com", password: "hashedPassword" })`.
  2. `TransactionModel.create({ userId: "uuid-above", type: "income", category: "salary", amount: 1500 })`.
  3. `TransactionModel.update(txId, { amount: 2000 })`.
  4. Inspect the contents of `users.json` and `transactions.json` files.
- **Expected Result**: 
  - `users.json` contains a JSON entry matching `test@domain.com`.
  - `transactions.json` contains a transaction object with `amount: 2000` and a valid `userId` reference.
