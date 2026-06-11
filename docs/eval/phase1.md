# Phase 1 Evaluation Criteria: Environment Setup & Server Scaffold

This document defines the evaluation standards, validation procedures, and verification checks for Phase 1 of the FinEdge API development.

---

## 1. Evaluation Objectives
- Verify that the Node.js project environment is correctly set up with the required dependencies.
- Confirm the directory structures exist and local JSON database files are initialized with empty arrays.
- Ensure that the Express app starts successfully and returns a healthy response via the `/health` endpoint.

---

## 2. Detailed Success Criteria

### 2.1. File Structures and Dependencies
- **`package.json`**: Must declare `express`, `bcryptjs`, `uuid`, and `dotenv`. It must use ES modules syntax (`"type": "module"`).
- **Database Initial state**:
  - `src/data/users.json` must exist and contain `[]`.
  - `src/data/transactions.json` must exist and contain `[]`.

### 2.2. Server Health Check
- The entrypoint `src/app.js` must listen on a port (default: 3000).
- Requesting `GET http://localhost:3000/health` must return an HTTP status code `200` with a JSON payload indicating server status.

---

## 3. Step-by-Step Test Scenarios

### Test Scenario 1.1: Verification of Directories and Initialized Databases
- **Action**: Check if databases are initialized correctly. Run in terminal:
  ```bash
  cat src/data/users.json
  cat src/data/transactions.json
  ```
- **Expected Result**: Both commands must output `[]` (empty JSON arrays) without raising "No such file or directory" exceptions.

### Test Scenario 1.2: Server Lifecycle and Endpoint Check
- **Action**:
  1. Spin up the server using the dev script:
     ```bash
     npm run dev
     ```
  2. Send a query to the health endpoint in a separate terminal:
     ```bash
     curl -i http://localhost:3000/health
     ```
- **Expected Result**:
  - The curl output must show:
    - HTTP status line containing `HTTP/1.1 200 OK`
    - Content-Type matching `application/json`
    - A JSON body such as `{"status":"up"}` or similar message indicating success.
