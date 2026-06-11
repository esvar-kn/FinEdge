# Phase 5 Evaluation Criteria: Transaction CRUD Operations

This document defines the evaluation metrics and test suites to verify Phase 5 of the FinEdge API development (Transaction CRUD and Isolation).

---

## 1. Evaluation Objectives
- Verify that users can create, retrieve, update, and delete their own transaction records.
- Ensure retrieval supports query parameters (filtering by `type` or `category`).
- Confirm transaction isolation: users are blocked from reading, modifying, or deleting other users' records.

---

## 2. Detailed Success Criteria

### 2.1. Transaction Isolation & Authorization
- Requests to modify or delete a transaction must be rejected with HTTP status `403 Forbidden` or `404 Not Found` if the transaction does not belong to the user requesting the action.

### 2.2. Query Parameters and Filters
- Sending `GET /api/transactions?type=expense` must return only expense transactions for that user.
- Sending `GET /api/transactions?category=food` must return only transactions logged under "food".

---

## 3. Step-by-Step Test Scenarios

### Test Scenario 5.1: Create & Retrieve Transaction
- **Action**: Add an expense to User A:
  ```bash
  curl -X POST -H "Content-Type: application/json" -H "X-User-Id: USER_A_UUID" -d '{"amount": 45.5, "type": "expense", "category": "food", "description": "Lunch"}' http://localhost:3000/api/transactions
  ```
- **Expected Result**:
  - The server returns `201 Created` with a new transaction object (including unique `id`).
  - Requesting `GET /api/transactions` with header `X-User-Id: USER_A_UUID` returns the newly created transaction.

### Test Scenario 5.2: Isolation Validation (Hijack Block check)
- **Action**: Use User B's header to update User A's transaction:
  ```bash
  curl -X PUT -H "Content-Type: application/json" -H "X-User-Id: USER_B_UUID" -d '{"amount": 1000}' http://localhost:3000/api/transactions/USER_A_TX_ID
  ```
- **Expected Result**: The server returns `403 Forbidden` or `404 Not Found`, and User A's transaction remains unchanged.
