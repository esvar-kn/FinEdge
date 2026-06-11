# Phase 4 Evaluation Criteria: User Authentication & Auth Services

This document details the evaluation standards and testing routines for Phase 4 of the FinEdge API development (User Registration & Login Authentication).

---

## 1. Evaluation Objectives
- Verify registration saves user metadata and securely hashes passwords.
- Confirm duplicate email registrations are blocked and throw 400 validation conflicts.
- Verify login authentication succeeds for correct passwords and rejects incorrect passwords.

---

## 2. Detailed Success Criteria

### 2.1. Password Hashing Security
- The raw text password must never be stored inside `users.json`.
- The saved password string must represent a cryptographically secure hash (typically beginning with the bcrypt pattern `$2a$` or `$2b$`).

### 2.2. Login Authentication Outcomes
- Sending matching email and password inputs to the login service must return an HTTP status `200` with the user profile details (excluding the password field).
- Sending incorrect passwords must fail with HTTP status `401 Unauthorized`.

---

## 3. Step-by-Step Test Scenarios

### Test Scenario 4.1: User Registration Integrity
- **Action**: Fire registration payload:
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"username": "testuser", "email": "test@finedge.com", "password": "securepassword123"}' http://localhost:3000/api/users/register
  ```
- **Expected Result**:
  - The database `users.json` is updated.
  - The response returns status `201 Created` containing details: `id`, `username`, `email`, `createdAt`.
  - The `password` key is entirely omitted from the JSON response.

### Test Scenario 4.2: Duplicate Account Block check
- **Action**: Re-send the exact registration payload above.
- **Expected Result**: The server returns HTTP status `400 Bad Request` indicating the email is already in use.

### Test Scenario 4.3: Login Authentication
- **Action**: Test login using the credentials registered:
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"email": "test@finedge.com", "password": "securepassword123"}' http://localhost:3000/api/users/login
  ```
- **Expected Result**: Returns `200 OK` with user details. Using the wrong password must return `401 Unauthorized`.
