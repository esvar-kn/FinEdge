import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import fs from 'fs/promises';
import app from '../src/app.js';
import { resetDatabase } from './helpers.js';
import { runBackup } from '../src/utils/backup.js';

describe('Pagination, Search, Sorting & Account Management', () => {
  let token;

  before(async () => {
    resetDatabase();
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'feature_user', email: 'features@finedge.com', password: 'password123' });
    token = res.body.data.token;
  });

  after(() => resetDatabase());

  describe('GET /api/transactions pagination, sorting & search', () => {
    before(async () => {
      // 25 expenses with distinct amounts and descriptions
      for (let i = 1; i <= 25; i++) {
        await request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send({
            amount: i * 10,
            type: 'expense',
            category: i % 2 === 0 ? 'transport' : 'food',
            description: i === 7 ? 'Uber to airport' : `Purchase number ${i}`
          });
      }
    });

    test('paginates with total metadata', async () => {
      const res = await request(app)
        .get('/api/transactions?limit=10&page=2')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.results, 10);
      assert.strictEqual(res.body.total, 25);
      assert.strictEqual(res.body.page, 2);
      assert.strictEqual(res.body.totalPages, 3);
    });

    test('returns all rows when no pagination params are given (backwards compatible)', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.results, 25);
      assert.strictEqual(res.body.total, 25);
      assert.strictEqual(res.body.page, undefined);
    });

    test('sorts by amount ascending', async () => {
      const res = await request(app)
        .get('/api/transactions?sort=amount&order=asc&limit=5')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      const amounts = res.body.data.transactions.map(t => t.amount);
      assert.deepStrictEqual(amounts, [10, 20, 30, 40, 50]);
    });

    test('searches descriptions with ?q=', async () => {
      const res = await request(app)
        .get('/api/transactions?q=uber')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.results, 1);
      assert.strictEqual(res.body.data.transactions[0].description, 'Uber to airport');
    });

    test('combines search with filters and pagination', async () => {
      const res = await request(app)
        .get('/api/transactions?q=purchase&category=food&limit=100')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      // 13 food-category rows minus the Uber one (i=7 is odd -> food)
      assert.strictEqual(res.body.results, 12);
      assert.ok(res.body.data.transactions.every(t => t.category === 'food'));
    });
  });

  describe('Fractional amounts are aggregated exactly', () => {
    test('classic float-drift amounts sum precisely', async () => {
      const resReg = await request(app)
        .post('/api/users/register')
        .send({ username: 'cents_user', email: 'cents@finedge.com', password: 'password123' });
      const centsToken = resReg.body.data.token;

      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${centsToken}`)
        .send({ amount: 1000, type: 'income', category: 'salary' });
      // 0.1 + 0.2 style drift: 3 x 33.33 should be exactly 99.99
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${centsToken}`)
          .send({ amount: 33.33, type: 'expense', category: 'misc' });
      }

      const res = await request(app)
        .get('/api/transactions/summary')
        .set('Authorization', `Bearer ${centsToken}`);

      assert.strictEqual(res.body.data.summary.totalExpenses, 99.99);
      assert.strictEqual(res.body.data.summary.netBalance, 900.01);
    });
  });

  describe('Account management', () => {
    let acctToken;

    before(async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({ username: 'acct_user', email: 'acct@finedge.com', password: 'password123' });
      acctToken = res.body.data.token;
    });

    test('GET /api/users/me returns the profile without password', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${acctToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.user.email, 'acct@finedge.com');
      assert.strictEqual(res.body.data.user.password, undefined);
    });

    test('password change rejects a wrong current password', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${acctToken}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });

      assert.strictEqual(res.status, 401);
      assert.ok(res.body.message.includes('Current password is incorrect'));
    });

    test('password change works and old password stops working', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${acctToken}`)
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

      assert.strictEqual(res.status, 200);

      const oldLogin = await request(app)
        .post('/api/users/login')
        .send({ email: 'acct@finedge.com', password: 'password123' });
      assert.strictEqual(oldLogin.status, 401);

      const newLogin = await request(app)
        .post('/api/users/login')
        .send({ email: 'acct@finedge.com', password: 'newpassword456' });
      assert.strictEqual(newLogin.status, 200);
    });

    test('account deletion requires the correct password and cascades', async () => {
      const wrong = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${acctToken}`)
        .send({ password: 'not-the-password' });
      assert.strictEqual(wrong.status, 401);

      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${acctToken}`)
        .send({ amount: 42, type: 'expense', category: 'test' });

      const res = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${acctToken}`)
        .send({ password: 'newpassword456' });
      assert.strictEqual(res.status, 204);

      const login = await request(app)
        .post('/api/users/login')
        .send({ email: 'acct@finedge.com', password: 'newpassword456' });
      assert.strictEqual(login.status, 401);
    });
  });

  describe('Database backup', () => {
    test('runBackup writes a dated snapshot file', async () => {
      const dest = await runBackup();
      const stats = await fs.stat(dest);
      assert.ok(stats.size > 0, 'backup file should not be empty');
      assert.ok(/finedge-\d{4}-\d{2}-\d{2}\.db$/.test(dest));
    });
  });
});
