# FinEdge – Personal Finance & Expense Tracker API

FinEdge is a clean, modular RESTful API backend for tracking personal finances — income and expenses, category budgets, recurring bills, and spending insights. Built on **Node.js** and **Express.js**, it follows a three-tier route → controller → service → model architecture with durable **SQLite** persistence (via `better-sqlite3`), exact integer-cents money arithmetic, and automated daily backups.

**Feature highlights**

| Area | What you get |
| :--- | :--- |
| Transactions | Full CRUD with ownership checks, filters, description search, date ranges, sorting, and pagination |
| Analytics | Exact SQL-computed summaries, all-time or per-month, plus a per-month trend series for charting |
| Budgets | Monthly per-category limits with `ok` / `warning` / `over` status folded into insights |
| Recurring | Daily/weekly/monthly/yearly rules that auto-materialize with catch-up after downtime |
| Import/Export | CSV export honoring all filters; CSV import with per-row error reporting |
| Categories | Case, whitespace, and plural variants fold onto one category; used + suggested category listing |
| Insights | Rule-based advice out of the box; optional AI-generated advice via the Groq API (free tier) |
| Security | JWT auth, bcrypt hashing, helmet headers, opt-in CORS, rate-limited auth endpoints |
| Reliability | WAL-mode SQLite, foreign keys with cascade, daily backups with retention, 57 automated tests |

---

## Directory Structure

```text
FinEdge/
├── docs/
│   ├── problemStatement.md        # Background context, scope, allocation details
│   ├── architecture.md            # Modular interfaces, databases, schemas, workflows
│   ├── implementationPlan.md      # Detailed phase-wise development lifecycle
│   ├── edgecase.md                # Mitigations for race conditions and vulnerabilities
│   └── eval/                      # Step-by-step verification standards for each phase
├── src/
│   ├── app.js                     # Express setup, middleware, router mounting, startup jobs
│   ├── config/
│   │   └── index.js               # Central env-backed config (fails fast without JWT_SECRET)
│   ├── db/
│   │   └── index.js               # SQLite connection, schema, indexes, lightweight migrations
│   ├── routes/
│   │   ├── userRoutes.js          # Auth + account management routes
│   │   ├── transactionRoutes.js   # CRUD, analytics, CSV import/export routes
│   │   ├── budgetRoutes.js        # Per-category monthly budget routes
│   │   ├── recurringRoutes.js     # Recurring transaction rule routes
│   │   └── categoryRoutes.js      # Category listing route
│   ├── controllers/
│   │   ├── userController.js      # Register, login, profile, password, delete account
│   │   ├── transactionController.js # Query parsing, pagination metadata, CSV responses
│   │   ├── budgetController.js    # Budget CRUD with month validation
│   │   └── recurringController.js # Recurring rule CRUD
│   ├── services/
│   │   ├── userService.js         # Password hashing, JWT signing, credential checks
│   │   ├── transactionService.js  # Transaction logic, summaries, CSV import/export
│   │   ├── budgetService.js       # Budget upserts and spend-vs-limit status
│   │   ├── recurringService.js    # Rule materialization with catch-up
│   │   ├── categoryService.js     # Category normalization and suggestions
│   │   └── aiInsightsService.js   # Groq-powered advice with rule-based fallback
│   ├── models/
│   │   ├── userModel.js           # Users table access
│   │   ├── transactionModel.js    # Transactions: filters, aggregation, trend queries
│   │   ├── budgetModel.js         # Budgets table access
│   │   ├── recurringModel.js      # Recurring rules table access
│   │   └── categoryModel.js       # Distinct categories across all tables
│   ├── middleware/
│   │   ├── logger.js              # Request logger with timing metrics
│   │   ├── errorHandler.js        # Centralized operational AppError handling
│   │   ├── validator.js           # Input validation + Bearer token authentication
│   │   └── rateLimiter.js         # Brute-force protection for auth endpoints
│   ├── utils/
│   │   ├── insightHelper.js       # Rule-based spending ratios and advice
│   │   ├── dates.js               # Date validation, month ranges, recurrence arithmetic
│   │   ├── csv.js                 # Dependency-free RFC-4180 CSV encode/parse
│   │   └── backup.js              # Automated daily DB snapshots with retention
│   └── data/
│       ├── finedge.db             # SQLite database (created on first run)
│       └── backups/               # Daily snapshots (last 7 kept by default)
├── scripts/
│   └── migrate-json-to-sqlite.js  # One-time import of the legacy JSON stores
├── tests/
│   ├── index.test.js              # Entry point — imports suites sequentially
│   ├── helpers.js                 # Shared database reset helpers
│   ├── user.suite.js              # Registration, login, validation
│   ├── transaction.suite.js       # CRUD, ownership isolation, analytics
│   ├── concurrency.suite.js       # Concurrent writes and update validation
│   ├── features.suite.js          # Pagination, search, sorting, account management
│   ├── highimpact.suite.js        # Dates, budgets, recurring rules, CSV
│   └── lowimpact.suite.js         # Categories, AI insights, security headers
├── FrontEnd/                      # Web UI assets and design mockups (work in progress)
├── .env.example                   # Environment configuration template
├── .gitignore                     # Excluded workspace files (DB, backups, secrets)
├── package.json                   # Package declarations and command scripts
└── README.md
```

---

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to create a `.env` file at the project root:
   ```bash
   cp .env.example .env
   ```

   | Variable | Default | Purpose |
   | :--- | :--- | :--- |
   | `PORT` | `3000` | HTTP listen port |
   | `NODE_ENV` | `development` | Environment name (`test` disables rate limiting) |
   | `JWT_SECRET` | — | **Required.** Token signing key; the server refuses to start without it |
   | `JWT_EXPIRES_IN` | `7d` | Token lifetime |
   | `DB_PATH` | `src/data/finedge.db` | SQLite database file |
   | `BACKUP_DIR` | `src/data/backups` | Where daily snapshots are written |
   | `BACKUP_KEEP` | `7` | Number of snapshots retained |
   | `SAVINGS_WARNING_THRESHOLD` | `0.70` | Expense/income ratio that triggers the savings warning |
   | `GROQ_API_KEY` | — | Optional. Enables AI insights; free key at [console.groq.com](https://console.groq.com) |
   | `AI_MODEL` | `llama-3.3-70b-versatile` | Groq model used for AI insights |
   | `CORS_ORIGIN` | — | Optional. Allowed browser origin; unset means same-origin only |
   | `AUTH_RATE_LIMIT_MAX` | `30` | Auth attempts allowed per window per IP |
   | `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window (15 minutes) |

   Generate a strong signing key with:
   ```bash
   openssl rand -hex 32
   ```

   **Migrating from the JSON-file store?** If you have data in the legacy
   `src/data/users.json` / `src/data/transactions.json` files, import it once with:
   ```bash
   npm run migrate:json
   ```
   The script is safe to re-run — already-imported records are skipped.

3. **Run Application**:
   - Development mode (nodemon auto-reload):
     ```bash
     npm run dev
     ```
   - Production mode:
     ```bash
     npm start
     ```

   On startup the server creates the database if needed, materializes any recurring transactions that came due while it was offline, and writes a backup snapshot.

---

## Testing

```bash
npm test              # run all 57 tests
npm run test:coverage # run with c8 coverage reporting
```

Tests run against a separate database (`src/data/test.db`), so your real data is never touched. Rate limiting is disabled under `NODE_ENV=test`, which the test script sets automatically.

---

## API Documentation

Base URL: `http://localhost:3000`. All routes except registration, login, and the health check require an `Authorization: Bearer <TOKEN>` header.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/health` | — | Liveness check; returns `{ "status": "up" }` |

### 1. User Authentication & Account Routes
| Method | Endpoint | Auth | Description | Payload Schema |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/users/register` | — | Registers a new account, hashes the password, and returns a signed JWT | `{ "username": "min-3", "email": "email", "password": "min-6" }` |
| **POST** | `/api/users/login` | — | Validates credentials and returns a signed JWT | `{ "email": "email", "password": "password" }` |
| **GET** | `/api/users/me` | Bearer | Returns the authenticated user's profile | — |
| **PUT** | `/api/users/password` | Bearer | Changes the password (verifies the current one) | `{ "currentPassword": "string", "newPassword": "min-6" }` |
| **DELETE** | `/api/users/me` | Bearer | Deletes the account and all its data (cascade) | `{ "password": "string" }` |

### 2. Transaction Management Routes
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/transactions` | Bearer | Creates a transaction (type: `income` or `expense`) |
| **GET** | `/api/transactions` | Bearer | Retrieves transactions with filters, search, sorting, and pagination (see below) |
| **PUT** | `/api/transactions/:id` | Bearer | Updates a transaction's fields (verifies ownership) |
| **DELETE** | `/api/transactions/:id` | Bearer | Deletes a transaction (verifies ownership) |
| **GET** | `/api/transactions/summary` | Bearer | Balance sheet, category breakdown, budget status, and insights. `?month=YYYY-MM` restricts to one month |
| **GET** | `/api/transactions/trend` | Bearer | Per-month income/expense totals for charting (`?months=N`, default 6, max 24) |
| **GET** | `/api/transactions/ai-insights` | Bearer | AI-generated financial advice (`?month=YYYY-MM` optional) — see AI Insights below |
| **GET** | `/api/transactions/export` | Bearer | Downloads transactions as CSV (honors the same filters as the list endpoint) |
| **POST** | `/api/transactions/import` | Bearer | Imports transactions from a CSV request body (`Content-Type: text/csv`). Required columns: `type,category,amount`; optional: `description,date`. Invalid rows are skipped and reported per line |

Transaction `date` values are validated (`YYYY-MM-DD` or ISO-8601) and normalized to ISO timestamps. Amounts must be positive numbers.

#### GET /api/transactions query parameters
| Parameter | Values | Description |
| :--- | :--- | :--- |
| `type` | `income` \| `expense` | Filter by transaction type |
| `category` | string | Filter by category (case-insensitive) |
| `q` | string | Case-insensitive substring search over descriptions |
| `from`, `to` | `YYYY-MM-DD` or ISO timestamp | Date range; `to` given as a date includes that whole day |
| `sort` | `date` (default) \| `amount` \| `category` \| `createdAt` | Sort field |
| `order` | `desc` (default) \| `asc` | Sort direction |
| `page`, `limit` | integers (limit ≤ 100, default 20) | Optional pagination; response then includes `total`, `page`, `limit`, and `totalPages`. Omit both to receive all matching rows |

### 3. Budget Routes (monthly, per expense category)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/budgets` | Bearer | Lists budgets with spend-vs-limit status (`?month=YYYY-MM`, default current month) |
| **PUT** | `/api/budgets/:category` | Bearer | Creates or updates a category's monthly budget: `{ "limit": number }` |
| **DELETE** | `/api/budgets/:category` | Bearer | Removes a category budget |

Each budget status entry reports `spent`, `remaining`, `percentUsed`, and a `status` of `ok` (< 80%), `warning` (≥ 80%), or `over` (> 100%). Over-budget and warning categories also surface in the summary's `insights`.

### 4. Recurring Transaction Routes
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/recurring` | Bearer | Lists recurring rules |
| **POST** | `/api/recurring` | Bearer | Creates a rule: `{ "type", "category", "amount", "frequency": "daily"\|"weekly"\|"monthly"\|"yearly", "description"?, "startDate"?, "endDate"? }` |
| **DELETE** | `/api/recurring/:id` | Bearer | Deletes a rule (transactions it already created are kept) |

Due runs materialize automatically — on server start, whenever the user's transactions or summary are read, and immediately on rule creation (a past `startDate` backfills at once). Monthly and yearly rules keep their anchor day across short months, so a rule on the 31st fires Feb 28 and then Mar 31 again. Generated transactions carry a `recurringRuleId` for traceability.

### 5. Category Routes
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/categories` | Bearer | Lists the user's used categories plus default suggestions they haven't used yet |

Categories are normalized on every write (transactions, budgets, recurring rules, CSV import): case and whitespace variants and simple plurals fold onto the user's first-used spelling, so "Food", "food " and "FOODS" — or "grocery" and "Groceries" — never fragment your breakdown.

---

## AI Insights

`GET /api/transactions/ai-insights` sends your summary, budget status, and six-month trend to the [Groq API](https://console.groq.com) and returns narrative budgeting advice.

- **With `GROQ_API_KEY` set** — the response carries `source: "ai"`, the `model` used, and an `advice` string.
- **Without a key, or on any API failure** — the response carries `source: "rules"` with the built-in rule-based `insights` array and a `note` explaining why. The endpoint always answers.

Groq's free tier requires no payment method, and the integration uses Node's built-in `fetch` — no extra dependency. Override the model with `AI_MODEL` in `.env`.

> The advice covers budgeting and spending habits only. FinEdge is not a licensed financial advisor and does not make investment recommendations.

---

## Security

- **Passwords** are hashed with bcrypt; login returns the same error for an unknown email and a wrong password.
- **JWT authentication** guards every data route, and ownership is verified on each transaction update and delete.
- **`JWT_SECRET` is mandatory** — the server refuses to start without it and warns if it is still a placeholder value.
- **helmet** sets standard security headers on every response; `X-Powered-By` is removed.
- **CORS is off by default** (same-origin only). Set `CORS_ORIGIN` to allow a browser frontend on another origin.
- **Auth endpoints are rate-limited** (register, login, password change): `AUTH_RATE_LIMIT_MAX` attempts (default 30) per `AUTH_RATE_LIMIT_WINDOW_MS` (default 15 minutes) per IP, returning 429 beyond that.
- **Secrets and data stay local** — `.env`, the SQLite database, and backups are all git-ignored.

---

## Data & Backups

- Data persists in a single SQLite file (`DB_PATH`, default `src/data/finedge.db`) in WAL mode with foreign keys enforced. Deleting a user cascades to their transactions, budgets, and recurring rules.
- Amounts are stored as **integer cents**, so aggregation is exact with no floating-point drift. The API accepts and returns ordinary decimal amounts.
- Unique constraints on email and username make duplicate registration impossible even under concurrent requests; indexes on `userId` and `(userId, date)` keep queries fast as history grows.
- On server start and every 24 hours thereafter, the database is snapshotted to `BACKUP_DIR` — one file per day, with the last `BACKUP_KEEP` retained. Trigger one manually with `npm run backup`, and restore by copying a snapshot over `DB_PATH` while the server is stopped.

---

## npm Scripts

| Script | Purpose |
| :--- | :--- |
| `npm start` | Start the server |
| `npm run dev` | Start with nodemon auto-reload |
| `npm test` | Run the full test suite |
| `npm run test:coverage` | Run tests with c8 coverage |
| `npm run backup` | Write a database snapshot immediately |
| `npm run migrate:json` | One-time import from the legacy JSON stores |
