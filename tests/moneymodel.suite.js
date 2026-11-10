import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers.js';

describe('Money-model depth: rollover, debts, tags/splits, receipts, currency', () => {
  let token;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  // Next calendar month as YYYY-MM (UTC), used to exercise rollover carry-over.
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 7);

  before(async () => {
    resetDatabase();
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'mm_user', email: 'mm@finedge.com', password: 'password123' });
    token = res.body.data.token;
  });

  after(() => resetDatabase());

  describe('Budget rollover', () => {
    test('unspent budget carries into a later month when rollover is on', async () => {
      await request(app).put('/api/budgets/dining').set(auth()).send({ limit: 200, rollover: true });
      // Spend 50 this month; 150 of the 200 envelope is unused.
      await request(app).post('/api/transactions').set(auth())
        .send({ type: 'expense', category: 'dining', amount: 50 });

      const res = await request(app).get(`/api/budgets?month=${nextMonth}`).set(auth());
      const dining = res.body.data.budgets.find((b) => b.category.toLowerCase() === 'dining');
      assert.strictEqual(dining.rollover, true);
      assert.strictEqual(dining.carriedOver, 150);
      assert.strictEqual(dining.available, 350);
      assert.strictEqual(dining.remaining, 350);
    });

    test('a non-rollover budget does not carry', async () => {
      await request(app).put('/api/budgets/transport').set(auth()).send({ limit: 100 });
      await request(app).post('/api/transactions').set(auth())
        .send({ type: 'expense', category: 'transport', amount: 30 });

      const res = await request(app).get(`/api/budgets?month=${nextMonth}`).set(auth());
      const transport = res.body.data.budgets.find((b) => b.category.toLowerCase() === 'transport');
      assert.strictEqual(transport.rollover, false);
      assert.strictEqual(transport.carriedOver, undefined);
      assert.strictEqual(transport.remaining, 100);
    });
  });

  describe('Debt tracking & payoff', () => {
    let debtId;

    test('creates a debt with a payoff projection', async () => {
      const res = await request(app).post('/api/debts').set(auth())
        .send({ name: 'Car loan', kind: 'loan', balance: 1000, apr: 0, minPayment: 100 });
      assert.strictEqual(res.status, 201);
      debtId = res.body.data.debt.id;
      assert.strictEqual(res.body.data.debt.balance, 1000);
      // 0% APR, $100/mo on $1000 => 10 months, no interest.
      assert.strictEqual(res.body.data.debt.payoff.feasible, true);
      assert.strictEqual(res.body.data.debt.payoff.months, 10);
      assert.strictEqual(res.body.data.debt.payoff.totalInterest, 0);
    });

    test('a larger monthly payment pays off faster', async () => {
      const res = await request(app).get(`/api/debts/${debtId}/payoff?monthlyPayment=500`).set(auth());
      assert.strictEqual(res.body.data.payoff.months, 2);
    });

    test('a payment that cannot cover interest is infeasible', async () => {
      const res = await request(app).post('/api/debts').set(auth())
        .send({ name: 'Credit card', kind: 'credit_card', balance: 1000, apr: 24, minPayment: 1 });
      assert.strictEqual(res.body.data.debt.payoff.feasible, false);
      assert.strictEqual(res.body.data.debt.payoff.months, null);
    });

    test('recording a payment reduces the balance', async () => {
      const res = await request(app).post(`/api/debts/${debtId}/payment`).set(auth())
        .send({ amount: 400 });
      assert.strictEqual(res.body.data.debt.balance, 600);
    });

    test('ownership is enforced', async () => {
      const other = await request(app).post('/api/users/register')
        .send({ username: 'mm_other', email: 'mm_other@finedge.com', password: 'password123' });
      const res = await request(app).delete(`/api/debts/${debtId}`)
        .set({ Authorization: `Bearer ${other.body.data.token}` });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('Tags & split transactions', () => {
    test('tags are stored and filterable', async () => {
      const made = await request(app).post('/api/transactions').set(auth())
        .send({ type: 'expense', category: 'shopping', amount: 25, tags: ['Costco', 'grocery', 'costco'] });
      assert.deepStrictEqual(made.body.data.transaction.tags, ['costco', 'grocery']); // lowercased, de-duped

      const filtered = await request(app).get('/api/transactions?tag=costco').set(auth());
      assert.ok(filtered.body.data.transactions.some((t) => t.id === made.body.data.transaction.id));
    });

    test('splits re-slice the category breakdown without changing totals', async () => {
      const reg = await request(app).post('/api/users/register')
        .send({ username: 'split_user', email: 'split@finedge.com', password: 'password123' });
      const sAuth = { Authorization: `Bearer ${reg.body.data.token}` };

      const res = await request(app).post('/api/transactions').set(sAuth).send({
        type: 'expense', category: 'shopping', amount: 100,
        splits: [{ category: 'food', amount: 60 }, { category: 'household', amount: 40 }]
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.transaction.splits.length, 2);

      const summary = await request(app).get('/api/transactions/summary').set(sAuth);
      const cb = summary.body.data.summary.categoryBreakdown;
      assert.strictEqual(cb.food, 60);
      assert.strictEqual(cb.household, 40);
      assert.strictEqual(cb.shopping, undefined); // primary category is replaced by splits
      assert.strictEqual(summary.body.data.summary.totalExpenses, 100); // total unchanged
    });

    test('splits that do not sum to the amount are rejected', async () => {
      const res = await request(app).post('/api/transactions').set(auth()).send({
        type: 'expense', category: 'shopping', amount: 100,
        splits: [{ category: 'food', amount: 60 }, { category: 'household', amount: 30 }]
      });
      assert.strictEqual(res.status, 400);
    });
  });

  describe('Receipt attachments', () => {
    let txId;

    before(async () => {
      const res = await request(app).post('/api/transactions').set(auth())
        .send({ type: 'expense', category: 'misc', amount: 12 });
      txId = res.body.data.transaction.id;
    });

    test('uploads, serves, and deletes a receipt image', async () => {
      const upload = await request(app)
        .post(`/api/transactions/${txId}/receipt`)
        .set(auth())
        .set('Content-Type', 'image/png')
        .send(Buffer.from('\x89PNG\r\n\x1a\n-fake-image-bytes'));
      assert.strictEqual(upload.status, 201);
      assert.strictEqual(upload.body.data.transaction.receipt, `${txId}.png`);

      const get = await request(app).get(`/api/transactions/${txId}/receipt`).set(auth());
      assert.strictEqual(get.status, 200);
      assert.ok(get.headers['content-type'].includes('image/png'));

      const del = await request(app).delete(`/api/transactions/${txId}/receipt`).set(auth());
      assert.strictEqual(del.status, 204);

      const after = await request(app).get(`/api/transactions/${txId}/receipt`).set(auth());
      assert.strictEqual(after.status, 404);
    });

    test('rejects a non-image content type', async () => {
      const res = await request(app)
        .post(`/api/transactions/${txId}/receipt`)
        .set(auth())
        .set('Content-Type', 'text/plain')
        .send('not an image');
      assert.strictEqual(res.status, 400);
    });
  });

  describe('Currency conversion', () => {
    let curAuth;

    before(async () => {
      const reg = await request(app).post('/api/users/register')
        .send({ username: 'cur_user', email: 'cur@finedge.com', password: 'password123' });
      curAuth = { Authorization: `Bearer ${reg.body.data.token}` };
    });

    test('exposes exchange rates', async () => {
      const res = await request(app).get('/api/rates').set(curAuth);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.base, 'USD');
      assert.strictEqual(res.body.data.rates.USD, 1);
      assert.strictEqual(res.body.data.rates.INR, 83);
    });

    test('net worth converts mixed-currency accounts to the display currency', async () => {
      // 8300 INR = 100 USD at the seeded rate.
      await request(app).post('/api/accounts').set(curAuth)
        .send({ name: 'India', type: 'savings', currency: 'INR', openingBalance: 8300 });
      await request(app).post('/api/accounts').set(curAuth)
        .send({ name: 'US', type: 'checking', currency: 'USD', openingBalance: 50 });

      const res = await request(app).get('/api/accounts').set(curAuth);
      assert.strictEqual(res.body.displayCurrency, 'USD');
      const india = res.body.data.accounts.find((a) => a.name === 'India');
      assert.strictEqual(india.balance, 8300); // own currency
      assert.strictEqual(india.balanceInDisplayCurrency, 100); // converted
      assert.strictEqual(res.body.netWorth, 150); // 100 + 50
    });

    test('an unsupported account currency is rejected', async () => {
      const res = await request(app).post('/api/accounts').set(curAuth)
        .send({ name: 'Bad', type: 'cash', currency: 'XYZ' });
      assert.strictEqual(res.status, 400);
    });
  });
});
