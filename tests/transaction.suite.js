import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase, clearTransactions } from './helpers.js';

describe('Transaction API & Analytics', () => {
  let tokenUserA;
  let userIdUserA;
  let tokenUserB;
  let userIdUserB;

  before(async () => {
    resetDatabase();

    // Setup: Register User A and User B
    const resA = await request(app)
      .post('/api/users/register')
      .send({ username: 'user_a', email: 'usera@domain.com', password: 'password123' });
    
    tokenUserA = resA.body.data.token;
    userIdUserA = resA.body.data.user.id;

    const resB = await request(app)
      .post('/api/users/register')
      .send({ username: 'user_b', email: 'userb@domain.com', password: 'password123' });

    tokenUserB = resB.body.data.token;
    userIdUserB = resB.body.data.user.id;
  });

  after(() => resetDatabase());

  describe('Authentication Enforcement', () => {
    test('should reject requests without authorization header', async () => {
      const res = await request(app)
        .get('/api/transactions');
      
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('Bearer token is missing or malformed'));
    });

    test('should reject requests with invalid/expired token', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', 'Bearer invalid_token');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('Invalid or expired token'));
    });
  });

  describe('Transaction Creation & Validation', () => {
    test('should successfully create a valid transaction for authenticated user', async () => {
      const payload = {
        amount: 250.00,
        type: 'expense',
        category: 'Food',
        description: 'Groceries'
      };

      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send(payload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.status, 'success');
      assert.ok(res.body.data.transaction.id);
      assert.strictEqual(res.body.data.transaction.userId, userIdUserA);
      assert.strictEqual(res.body.data.transaction.amount, 250.00);
      assert.strictEqual(res.body.data.transaction.type, 'expense');
      assert.strictEqual(res.body.data.transaction.category, 'Food');
    });

    test('should reject transaction creation with invalid type', async () => {
      const payload = {
        amount: 100,
        type: 'invalid_type',
        category: 'Food'
      };

      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('Type must be either'));
    });

    test('should reject transaction creation with negative amount', async () => {
      const payload = {
        amount: -50,
        type: 'income',
        category: 'Salary'
      };

      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('Amount must be a positive number'));
    });

    test('should reject transaction creation with empty category', async () => {
      const payload = {
        amount: 1500,
        type: 'income',
        category: ''
      };

      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('Category must be a non-empty string'));
    });
  });

  describe('Transaction Retrieval & Isolation', () => {
    test('should retrieve only the authenticated user\'s transactions and apply filters', async () => {
      // Create another transaction for User A
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ amount: 1500.00, type: 'income', category: 'Salary', description: 'Monthly pay' });

      // Create a transaction for User B
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({ amount: 50.00, type: 'expense', category: 'Entertainment', description: 'Movie' });

      // User A retrieves transactions
      const resA = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`);

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resA.body.results, 2);
      assert.ok(resA.body.data.transactions.every(tx => tx.userId === userIdUserA));

      // User A filters by type: income
      const resFilterType = await request(app)
        .get('/api/transactions?type=income')
        .set('Authorization', `Bearer ${tokenUserA}`);

      assert.strictEqual(resFilterType.status, 200);
      assert.strictEqual(resFilterType.body.results, 1);
      assert.strictEqual(resFilterType.body.data.transactions[0].type, 'income');

      // User A filters by category: Food
      const resFilterCategory = await request(app)
        .get('/api/transactions?category=Food')
        .set('Authorization', `Bearer ${tokenUserA}`);

      assert.strictEqual(resFilterCategory.status, 200);
      assert.strictEqual(resFilterCategory.body.results, 1);
      assert.strictEqual(resFilterCategory.body.data.transactions[0].category, 'Food');
    });
  });

  describe('Transaction Modification & Ownership Controls', () => {
    let transactionId;

    before(async () => {
      // Create a test transaction to modify
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ amount: 100, type: 'expense', category: 'Utility', description: 'Electric bill' });
      transactionId = res.body.data.transaction.id;
    });

    test('should allow owner to update the transaction', async () => {
      const payload = {
        amount: 120.00,
        description: 'Updated electric bill'
      };

      const res = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send(payload);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'success');
      assert.strictEqual(res.body.data.transaction.amount, 120.00);
      assert.strictEqual(res.body.data.transaction.description, 'Updated electric bill');
    });

    test('should deny non-owner from updating the transaction', async () => {
      const payload = {
        amount: 200.00
      };

      const res = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send(payload);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('You do not own this transaction'));
    });

    test('should return 404 for updating a non-existent transaction', async () => {
      const res = await request(app)
        .put('/api/transactions/non-existent-uuid')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ amount: 100 });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.status, 'fail');
    });

    test('should deny non-owner from deleting the transaction', async () => {
      const res = await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${tokenUserB}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('You do not own this transaction'));
    });

    test('should return 404 for deleting a non-existent transaction', async () => {
      const res = await request(app)
        .delete('/api/transactions/non-existent-uuid')
        .set('Authorization', `Bearer ${tokenUserA}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.status, 'fail');
    });

    test('should allow owner to delete the transaction', async () => {
      const res = await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      assert.strictEqual(res.status, 204);
    });
  });

  describe('Financial Analytics & Savings Alert Insights', () => {
    test('should calculate correct summary statistics and savings warnings', async () => {
      // Clear transactions so calculations are exact
      clearTransactions();

      // 1. Create Income: 2000.00
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ amount: 2000.00, type: 'income', category: 'Salary' });

      // 2. Create Expense: 1500.00 (which is 75% of income, > 70% warning threshold)
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ amount: 1500.00, type: 'expense', category: 'Rent' });

      const res = await request(app)
        .get('/api/transactions/summary')
        .set('Authorization', `Bearer ${tokenUserA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'success');
      
      const { totalIncome, totalExpenses, netBalance, insights } = res.body.data.summary;
      assert.strictEqual(totalIncome, 2000.00);
      assert.strictEqual(totalExpenses, 1500.00);
      assert.strictEqual(netBalance, 500.00);

      // Verify the warning insights triggers for high expense ratio
      const hasWarning = insights.some(insight => insight.includes('Warning: Your total expenses consume'));
      assert.ok(hasWarning, 'Savings warning alert is missing from insights');
    });
  });
});
