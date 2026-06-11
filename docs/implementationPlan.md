# Phase-Wise Implementation Plan: FinEdge – Personal Finance & Expense Tracker API

This implementation plan outlines the development path for the FinEdge API backend, dividing the work into logical, sequential phases. It is designed to be aligned with the specifications in [architecture.md](file:///Users/esvarnatarajan/Desktop/Airtribe/Coding_practise/AI-Projects/Project2/docs/architecture.md) and the targets in [problemStatement.md](file:///Users/esvarnatarajan/Desktop/Airtribe/Coding_practise/AI-Projects/Project2/docs/problemStatement.md).

---

## Project Directory Structure

```text
Project2/
├── docs/
│   ├── problemStatement.md
│   ├── architecture.md
│   └── implementationPlan.md
├── src/
│   ├── app.js                 # Express Application & Server Entrypoint
│   ├── routes/
│   │   ├── userRoutes.js      # User registration & login routes
│   │   └── transactionRoutes.js # CRUD & summary transaction routes
│   ├── controllers/
│   │   ├── userController.js  # Directs HTTP user input to UserService
│   │   └── transactionController.js # Directs HTTP transaction input to service
│   ├── services/
│   │   ├── userService.js     # User registration logic & credentials check
│   │   └── transactionService.js # Transaction logic (retrieval, edits, CRUD)
│   ├── models/
│   │   ├── userModel.js       # User JSON file persistent model
│   │   └── transactionModel.js # Transaction JSON file persistent model
│   ├── middleware/
│   │   ├── errorHandler.js    # Global catching & formatting middleware
│   │   ├── logger.js          # Console request logging utility
│   │   └── validator.js       # Payload fields validator (express-validator)
│   ├── utils/
│   │   ├── analytics.js       # Summary & category calculations
│   │   └── aiHelper.js        # Rule-based spending warnings & budget alerts
│   └── data/
│       ├── users.json         # Stores user profiles list (JSON format)
│       └── transactions.json  # Stores transaction records list (JSON format)
├── package.json               # Dependencies and script definitions
└── README.md
```

---

## Phase 0: Development Environment & Prerequisites
**Goal**: Verify the development environment has compatible Node.js runtime and package manager versions, and ensure workspace permissions are properly set up.

### Tasks
1. **Verify Node.js Version**:
   - Ensure Node.js version is equal to or greater than 18.x by running `node -v` in the shell.
2. **Verify npm Version**:
   - Ensure npm version is equal to or greater than 9.x by running `npm -v` in the shell.
3. **Workspace Permissions Validation**:
   - Verify read and write accessibility inside the `Project2` directory.

### Verification Steps
- Run `node -v` and `npm -v` in the terminal to confirm versions are within required bounds.
- Run `echo "test" > write_test.txt && rm write_test.txt` to confirm write access.

---

## Phase 1: Environment Setup, Dependencies & Server Scaffold
**Goal**: Configure project files, setup Node scripts, initialize empty data stores, and create a basic Express listener.

### Tasks
1. **Initialize Project File & NPM dependencies**:
   - Create `package.json` with the following configuration and scripts:
     ```json
     {
       "name": "finedge-api",
       "version": "1.0.0",
       "description": "Personal Finance Tracker API backend",
       "main": "src/app.js",
       "type": "module",
       "scripts": {
         "start": "node src/app.js",
         "dev": "nodemon src/app.js"
       },
       "dependencies": {
         "express": "^4.19.2",
         "bcryptjs": "^2.4.3",
         "uuid": "^9.0.1",
         "dotenv": "^16.4.5"
       },
       "devDependencies": {
         "nodemon": "^3.1.0"
       }
     }
     ```
2. **Setup Folder Structures and Empty JSON Databases**:
   - Create directories `src/routes`, `src/controllers`, `src/services`, `src/models`, `src/middleware`, `src/utils`, `src/data`.
   - Write empty arrays `[]` in `src/data/users.json` and `src/data/transactions.json` files to initialize the database storage.
3. **Scaffold Express Server (`src/app.js`)**:
   - Create `src/app.js` configuring raw Express features: port routing, standard JSON middleware body parser (`express.json()`), and a default server health-check endpoint (`GET /health`).

### Verification Steps
- Run `npm install` followed by `npm run dev` to start the server.
- Perform a health check query using curl: `curl http://localhost:3000/health` and verify it returns a successful response.

---

## Phase 2: Asynchronous JSON Models & Data Persistence
**Goal**: Build the data access layer representing files operations safely with async methods.

### Tasks
1. **Develop File Utility Helper (`src/utils/fileHandler.js`)**:
   - Write helper functions to handle file I/O operations using `fs/promises`:
     - `readJSONFile(filePath)`: Reads file content, parses it safely, and falls back to empty arrays on failure.
     - `writeJSONFile(filePath, data)`: Writes updated JSON objects back to file with proper formatting.
2. **Implement `src/models/userModel.js`**:
   - Develop static model queries matching the interface design:
     - `findAll()`, `findByEmail(email)`, and `create(userData)`.
     - Assign unique `id` to new users using `uuid.v4()`.
3. **Implement `src/models/transactionModel.js`**:
   - Develop standard CRUD interface queries:
     - `findAll()`, `findByUserId(userId)`, `create(txData)`, `update(id, updateData)`, and `delete(id)`.
     - Automatically append `createdAt` and `date` timestamps.

### Verification Steps
- Create a temporary script `src/scratch/testModels.js` to create dummy users, read them, update, and inspect the structural integrity of the generated entries in the JSON files.

---

## Phase 3: Core Middlewares (Logging, Central Errors & Validation)
**Goal**: Implement the supporting services layer to intercept, validate, and log all requests.

### Tasks
1. **Implement Logger Middleware (`src/middleware/logger.js`)**:
   - Create request logging middleware tracking details: `[Timestamp] Method Path IP (Execution Time)`.
2. **Implement Custom AppError and Central Handler (`src/middleware/errorHandler.js`)**:
   - Define custom error class extending native `Error` with HTTP status support.
   - Setup general catcher returning structured JSON structures:
     ```json
     { "status": "fail/error", "message": "error description" }
     ```
3. **Implement Schema Validation Middleware (`src/middleware/validator.js`)**:
   - Design helper validation functions checking fields before routes:
     - For User Register: check `username` length (min 3), `email` syntax format, `password` safety limits (min 6).
     - For Transactions: check `amount` is a float greater than 0, `type` is one of `['income', 'expense']`, and `category` is present.

### Verification Steps
- Set up a dummy route in `app.js` that throws a `new AppError("Testing global error handler", 400)` and check that the client receives the expected structured JSON error response.

---

## Phase 4: User Authentication & Authentication Services
**Goal**: Implement user registration, secure password hashing, and user credential validation.

### Tasks
1. **Create `src/services/userService.js`**:
   - Write register functions executing uniqueness validation (email check) against `userModel.findByEmail`.
   - Perform password hashing using `bcryptjs` (salt rounds = 10) before saving user profiles.
   - Write credentials validation logic comparing passwords during login.
2. **Create `src/controllers/userController.js`**:
   - Call services inside async controller functions. Capture errors and forward them to `next(err)`.
3. **Create `src/routes/userRoutes.js` and Integrate**:
   - Connect endpoints `POST /api/users/register` and `POST /api/users/login` with validator chains.
   - Register routes in `src/app.js`.

### Verification Steps
- Send API requests to register a user via Postman/curl. Verify that registration succeeds and the user is saved with a hashed password in `users.json`. Verify that registering duplicate emails returns a 400 Bad Request error.

---

## Phase 5: Transaction CRUD Operations
**Goal**: Implement transaction management routes, linking records to authenticated users.

### Tasks
1. **Create `src/services/transactionService.js`**:
   - Write business workflow functions:
     - `addTransaction(userId, data)`: Links transaction to user.
     - `getUserTransactions(userId, filters)`: Implements search filtering (by type or category).
     - `modifyTransaction(id, userId, data)`: Edits transaction (verifying user ownership).
     - `removeTransaction(id, userId)`: Deletes transaction (verifying user ownership).
2. **Create `src/controllers/transactionController.js`**:
   - Map payload and parameters to the transaction service.
3. **Create `src/routes/transactionRoutes.js`**:
   - Connect endpoints:
     - `POST /api/transactions` (create)
     - `GET /api/transactions` (retrieve)
     - `PUT /api/transactions/:id` (update)
     - `DELETE /api/transactions/:id` (delete)
   - Register routes in `src/app.js`.

### Verification Steps
- Log transactions (income/expense) for a specific user ID. Attempt editing and deleting transactions. Verify that only the transaction creator can update or delete their transactions.

---

## Phase 6: Financial Analytics & AI-Driven Insights
**Goal**: Generate financial summaries and rule-based insights.

### Tasks
1. **Implement `src/utils/analytics.js`**:
   - Calculate summary aggregates from the user's transaction records:
     - `totalIncome`: Total of all income transactions.
     - `totalExpenses`: Total of all expense transactions.
     - `netBalance`: Net amount (`income - expenses`).
     - `categoryBreakdown`: Group expenses by category (e.g., `{ "food": 150, "bills": 350 }`).
2. **Implement `src/utils/aiHelper.js`**:
   - Build rule-based analysis generating insight strings:
     - Savings alert: Trigger warnings if expenses exceed 70% of total income.
     - Budget warnings: Identify category spend peaks.
     - Provide actionable savings advice (e.g. *"Your food spending constitutes 45% of your total expenses; consider cooking at home to improve savings."*).
3. **Create Summary Endpoint**:
   - Route `GET /api/transactions/summary` to return aggregated statistics along with the generated AI-driven insights.

### Verification Steps
- Call `GET /api/transactions/summary`. Verify that total balances, category breakdowns, and AI savings warnings are returned correctly based on the logged data.
