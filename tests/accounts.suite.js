import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers.js';

describe('Accounts, Transfers & Net Worth', () => {
  let token;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  before(async () => {
    resetDatabase();
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'acct_user', email: 'acct@finedge.com', password: 'password123' });
    token = res.body.data.token;
  });

  after(() => resetDatabase());

  describe('Account CRUD', () => {
    test('creates accounts with opening balances and lists net worth', async () => {
      const checking = await request(app)
        .post('/api/accounts')
        .set(auth())
        .send({ name: 'Checking', type: 'checking', openingBalance: 1000 });
      assert.strictEqual(checking.status, 201);
      assert.strictEqual(checking.body.data.account.name, 'Checking');
      assert.strictEqual(checking.body.data.account.openingBalance, 1000);

      // Credit card starts negative (money owed).
      const credit = await request(app)
        .post('/api/accounts')
        .set(auth())
        .send({ name: 'Visa', type: 'credit', openingBalance: -200 });
      assert.strictEqual(credit.status, 201);

      const list = await request(app).get('/api/accounts').set(auth());
      assert.strictEqual(list.status, 200);
      assert.strictEqual(list.body.results, 2);
      // netWorth = 1000 + (-200) = 800
      assert.strictEqual(list.body.netWorth, 800);
      const byName = Object.fromEntries(list.body.data.accounts.map((a) => [a.name, a]));
      assert.strictEqual(byName.Checking.balance, 1000);
      assert.strictEqual(byName.Visa.balance, -200);
    });

    test('rejects an invalid type and a duplicate name', async () => {
      const bad = await request(app)
        .post('/api/accounts')
        .set(auth())
        .send({ name: 'Nope', type: 'brokerage' });
      assert.strictEqual(bad.status, 400);

      const dup = await request(app)
        .post('/api/accounts')
        .set(auth())
        .send({ name: 'checking', type: 'checking' }); // case-insensitive clash
      assert.strictEqual(dup.status, 409);
    });

    test('updates an account and can archive it out of net worth', async () => {
      const made = await request(app)
        .post('/api/accounts')
        .set(auth())
        .send({ name: 'Old Savings', type: 'savings', openingBalance: 500 });
      const id = made.body.data.account.id;

      const archived = await request(app)
        .put(`/api/accounts/${id}`)
        .set(auth())
        .send({ archived: true });
      assert.strictEqual(archived.status, 200);
      assert.strictEqual(archived.body.data.account.archived, true);

      const list = await request(app).get('/api/accounts').set(auth());
      // Archived account's 500 is excluded from net worth (still 800).
      assert.strictEqual(list.body.netWorth, 800);

      await request(app).delete(`/api/accounts/${id}`).set(auth());
    });
  });

  describe('Transactions move account balances', () => {
    let checkingId;

    before(async () => {
      const list = await request(app).get('/api/accounts').set(auth());
      checkingId = list.body.data.accounts.find((a) => a.name === 'Checking').id;
    });

    test('income and expense on an account adjust its balance', async () => {
      await request(app)
        .post('/api/transactions')
        .set(auth())
        .send({ type: 'income', category: 'salary', amount: 300, accountId: checkingId });
      await request(app)
        .post('/api/transactions')
        .set(auth())
        .send({ type: 'expense', category: 'food', amount: 100, accountId: checkingId });

      const list = await request(app).get('/api/accounts').set(auth());
      const checking = list.body.data.accounts.find((a) => a.id === checkingId);
      // 1000 opening + 300 - 100 = 1200
      assert.strictEqual(checking.balance, 1200);
    });

    test('transactions can be filtered by account', async () => {
      const res = await request(app)
        .get(`/api/transactions?accountId=${checkingId}`)
        .set(auth());
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.results, 2);
      assert.ok(res.body.data.transactions.every((t) => t.accountId === checkingId));
    });

    test('a transaction on a non-owned account is rejected', async () => {
      const other = await request(app)
        .post('/api/users/register')
        .send({ username: 'acct_other', email: 'acct_other@finedge.com', password: 'password123' });
      const res = await request(app)
        .post('/api/transactions')
        .set({ Authorization: `Bearer ${other.body.data.token}` })
        .send({ type: 'expense', category: 'food', amount: 10, accountId: checkingId });
      assert.strictEqual(res.status, 403); // account exists but is not theirs
    });
  });

  describe('Transfers', () => {
    let fromId;
    let toId;

    before(async () => {
      const list = await request(app).get('/api/accounts').set(auth());
      fromId = list.body.data.accounts.find((a) => a.name === 'Checking').id;
      toId = list.body.data.accounts.find((a) => a.name === 'Visa').id;
    });

    test('a transfer moves cents between accounts and leaves net worth unchanged', async () => {
      const before = await request(app).get('/api/accounts').set(auth());
      const netBefore = before.body.netWorth;

      const res = await request(app)
        .post('/api/transfers')
        .set(auth())
        .send({ fromAccountId: fromId, toAccountId: toId, amount: 150, description: 'CC payment' });
      assert.strictEqual(res.status, 201);

      const after = await request(app).get('/api/accounts').set(auth());
      const byId = Object.fromEntries(after.body.data.accounts.map((a) => [a.id, a]));
      assert.strictEqual(byId[fromId].balance, 1200 - 150);
      assert.strictEqual(byId[toId].balance, -200 + 150);
      assert.strictEqual(after.body.netWorth, netBefore); // transfers don't change net worth
    });

    test('a transfer does NOT appear in spending analytics', async () => {
      const summary = await request(app).get('/api/transactions/summary').set(auth());
      // Only the real income/expense count: 300 income, 100 expense.
      assert.strictEqual(summary.body.data.summary.totalIncome, 300);
      assert.strictEqual(summary.body.data.summary.totalExpenses, 100);
    });

    test('rejects same-account, non-positive, and non-owned transfers', async () => {
      const same = await request(app)
        .post('/api/transfers')
        .set(auth())
        .send({ fromAccountId: fromId, toAccountId: fromId, amount: 10 });
      assert.strictEqual(same.status, 400);

      const negative = await request(app)
        .post('/api/transfers')
        .set(auth())
        .send({ fromAccountId: fromId, toAccountId: toId, amount: -5 });
      assert.strictEqual(negative.status, 400);

      const other = await request(app)
        .post('/api/users/register')
        .send({ username: 'tr_other', email: 'tr_other@finedge.com', password: 'password123' });
      const notOwned = await request(app)
        .post('/api/transfers')
        .set({ Authorization: `Bearer ${other.body.data.token}` })
        .send({ fromAccountId: fromId, toAccountId: toId, amount: 10 });
      assert.strictEqual(notOwned.status, 403); // accounts exist but aren't theirs
    });

    test('lists and deletes transfers', async () => {
      const list = await request(app).get('/api/transfers').set(auth());
      assert.strictEqual(list.body.results, 1);

      const del = await request(app)
        .delete(`/api/transfers/${list.body.data.transfers[0].id}`)
        .set(auth());
      assert.strictEqual(del.status, 204);

      const after = await request(app).get('/api/transfers').set(auth());
      assert.strictEqual(after.body.results, 0);
    });
  });

  describe('Account deletion guards', () => {
    test('refuses to delete an account with transactions unless reassigned', async () => {
      const list = await request(app).get('/api/accounts').set(auth());
      const checkingId = list.body.data.accounts.find((a) => a.name === 'Checking').id;

      const blocked = await request(app).delete(`/api/accounts/${checkingId}`).set(auth());
      assert.strictEqual(blocked.status, 409);

      // Create a target and reassign on delete.
      const target = await request(app)
        .post('/api/accounts')
        .set(auth())
        .send({ name: 'Cash', type: 'cash' });
      const targetId = target.body.data.account.id;

      const reassigned = await request(app)
        .delete(`/api/accounts/${checkingId}?reassignTo=${targetId}`)
        .set(auth());
      assert.strictEqual(reassigned.status, 204);

      // The two transactions now live on Cash; its balance = 300 - 100 = 200.
      const afterList = await request(app).get('/api/accounts').set(auth());
      const cash = afterList.body.data.accounts.find((a) => a.id === targetId);
      assert.strictEqual(cash.balance, 200);
    });
  });

  describe('Net worth over time', () => {
    let nwAuth;
    const today = new Date().toISOString().slice(0, 10);

    before(async () => {
      const reg = await request(app)
        .post('/api/users/register')
        .send({ username: 'nw_user', email: 'nw@finedge.com', password: 'password123' });
      nwAuth = { Authorization: `Bearer ${reg.body.data.token}` };
      await request(app)
        .post('/api/accounts')
        .set(nwAuth)
        .send({ name: 'Main', type: 'checking', openingBalance: 1000 });
    });

    test('records a snapshot of current net worth for today', async () => {
      const res = await request(app).get('/api/accounts/history').set(nwAuth);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.results, 1);
      const point = res.body.data.history[0];
      assert.strictEqual(point.date, today);
      assert.strictEqual(point.netWorth, 1000);
    });

    test("today's point updates as balances change (no duplicate day)", async () => {
      await request(app)
        .post('/api/accounts')
        .set(nwAuth)
        .send({ name: 'Savings', type: 'savings', openingBalance: 500 });

      const res = await request(app).get('/api/accounts/history?days=7').set(nwAuth);
      assert.strictEqual(res.body.results, 1); // still one calendar day
      assert.strictEqual(res.body.data.history[0].netWorth, 1500);
    });

    test('history is user-scoped', async () => {
      const other = await request(app)
        .post('/api/users/register')
        .send({ username: 'nw_other', email: 'nw_other@finedge.com', password: 'password123' });
      const res = await request(app)
        .get('/api/accounts/history')
        .set({ Authorization: `Bearer ${other.body.data.token}` });
      // The other user sees only their own snapshot (net worth 0), never 1500.
      assert.strictEqual(res.body.results, 1);
      assert.strictEqual(res.body.data.history[0].netWorth, 0);
    });
  });
});
