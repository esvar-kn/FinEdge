# Phase 3 Evaluation Criteria: Core Middlewares (Logging, Central Errors & Validation)

This document defines the evaluation rules and verification steps for the middlewares layer of the FinEdge API project.

---

## 1. Evaluation Objectives
- Ensure all incoming HTTP requests are logged in a readable format.
- Confirm validation schemas intercept invalid requests (e.g. invalid emails, negative amounts) and respond with `400 Bad Request`.
- Verify centralized error-handling middleware returns standardized JSON schemas for operational errors.

---

## 2. Detailed Success Criteria

### 2.1. Centralized Error Formatting
- Error responses must follow the format:
  ```json
  {
    "status": "fail" or "error",
    "message": "Readable description of error"
  }
  ```
- Operational errors (e.g., throwing a `new AppError("User not found", 404)`) must return their corresponding HTTP status codes (e.g. 404 instead of 500).

### 2.2. Request Validation Safeguards
- Register inputs must fail if:
  - Email format is invalid (e.g. `user@com` or `user.domain`).
  - Username has fewer than 3 characters.
  - Password has fewer than 6 characters.
- Transaction inputs must fail if:
  - Amount is negative, zero, or not a number.
  - Type is not `income` or `expense`.
  - Category is empty or missing.

---

## 3. Step-by-Step Test Scenarios

### Test Scenario 3.1: Request Validation Interception
- **Action**: Fire a POST request to a validated route with missing or invalid fields. For example, send a transaction creation with negative amount:
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"amount": -50, "type": "invalid", "category": ""}' http://localhost:3000/api/transactions
  ```
- **Expected Result**:
  - The server returns HTTP status `400 Bad Request`.
  - The response body is a JSON object listing specific validation error descriptions.

### Test Scenario 3.2: Centralized Error Mapping
- **Action**: Trigger an endpoint designed to raise an operational error (e.g., accessing a non-existent transaction).
- **Expected Result**:
  - The server captures the exception, logs it, and returns the appropriate HTTP status code.
  - The response body does not spill standard stack trace leaks to the client in production mode.
