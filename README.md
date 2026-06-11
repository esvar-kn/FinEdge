# FinEdge – Personal Finance & Expense Tracker API

FinEdge is a clean, modular RESTful API backend for tracking personal finance transactions (income and expenses), generating category-based summaries, and executing rule-based AI financial insights. Built on **Node.js** and **Express.js**, the project demonstrates asynchronous programming, a Three-Tier Service-Repository architecture, robust middlewares, and concurrency-safe JSON file database persistence.

---

## Directory Structure

```text
Project2/
├── docs/
│   ├── problemStatement.md    # Background context, scope, allocation details
│   ├── architecture.md        # Modular interfaces, databases, schemas, workflows
│   ├── implementationPlan.md  # Detailed phase-wise development lifecycle
│   ├── edgecase.md            # Mitigations for race conditions and vulnerabilities
│   └── eval/                  # Step-by-step verification standards for each phase
├── src/
│   ├── app.js                 # Central listener and router mounting
│   ├── routes/
│   │   ├── userRoutes.js      # Register & login authentication routes
│   │   └── transactionRoutes.js # CRUD & analytics transaction routes
│   ├── controllers/
│   │   ├── userController.js  # Directs user HTTP payloads to services
│   │   └── transactionController.js # Directs transaction HTTP requests
│   ├── services/
│   │   ├── userService.js     # Signup encryption & credential logins
│   │   └── transactionService.js # Transaction logic and security checks
│   ├── models/
│   │   ├── userModel.js       # Asynchronous user database schema mappings
│   │   └── transactionModel.js # Asynchronous transaction database mappings
│   ├── middleware/
│   │   ├── logger.js          # Request logger with timing metrics
│   │   ├── errorHandler.js    # Centralized operational custom AppErrors
│   │   └── validator.js       # Inputs validation & header authorization check
│   ├── utils/
│   │   ├── fileHandler.js     # Atomic file operations with locking queue
│   │   ├── analytics.js       # Arithmetic sums & category aggregations
│   │   └── aiHelper.js        # Rule-based spending ratios & insights advice
│   └── data/
│       ├── users.json         # User store file (initializes to [])
│       └── transactions.json  # Transactions store file (initializes to [])
├── .env.example               # Environmental configuration template
├── .gitignore                 # Specifies excluded workspace files
├── package.json               # Package declarations and command scripts
└── README.md
```

---

## Installation & Setup

1. **Install Dependencies**:
   Navigate to the `Project2` directory and install required npm packages:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to create a `.env` file at the root of the project:
   ```bash
   cp .env.example .env
   ```
   Define your active environment parameters:
   ```text
   PORT=3000
   NODE_ENV=development
   USERS_DB_PATH=src/data/users.json
   TRANSACTIONS_DB_PATH=src/data/transactions.json
   SAVINGS_WARNING_THRESHOLD=0.70
   ```

3. **Run Application**:
   - Start in development mode (using nodemon automatic reloads):
     ```bash
     npm run dev
     ```
   - Start in production mode:
     ```bash
     npm start
     ```

---

## API Documentation

All protected transaction endpoints require passing an authorization header: `Authorization: Bearer <TOKEN>`.

### 1. User Authentication Routes
| Method | Endpoint | Description | Payload Schema |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/users/register` | Registers a new account, hashes password, and returns a signed JWT | `{ "username": "string", "email": "email", "password": "min-6" }` |
| **POST** | `/api/users/login` | Validates credentials and returns a signed JWT | `{ "email": "email", "password": "password" }` |

### 2. Transaction Management Routes
| Method | Endpoint | Headers Required | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/transactions` | `Authorization: Bearer <TOKEN>` | Creates a transaction (type: `income` or `expense`) |
| **GET** | `/api/transactions` | `Authorization: Bearer <TOKEN>` | Retrieves transactions (supports filters `?type=expense&category=food`) |
| **PUT** | `/api/transactions/:id` | `Authorization: Bearer <TOKEN>` | Updates a transaction's fields (verifies ownership) |
| **DELETE** | `/api/transactions/:id` | `Authorization: Bearer <TOKEN>` | Deletes a transaction (verifies ownership) |
| **GET** | `/api/transactions/summary` | `Authorization: Bearer <TOKEN>` | Computes balance sheets and generates rule-based insights advice |
