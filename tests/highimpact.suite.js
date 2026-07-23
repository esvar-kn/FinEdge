import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers.js';

describe('Dates, Budgets, Recurring Rules & CSV', () => {
  let token;

  before(async () => {
    resetDatabase();
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'hi_user', email: 'hi@finedge.com', password: 'password123' });
    token = res.body.data.token;
  });

  after(() => resetDatabase());

  const post = (payload) =>
    request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(payload);

  describe('Date validation & range filtering', () => {
    test('rejects an invalid date on create and update', async () => {
      const bad = await post({ amount: 10, type: 'expense', category: 'food', date: 'banana' });
      assert.strictEqual(bad.status, 400);
      assert.ok(bad.body.message.includes('Date must be a valid'));

      const created = await post({ amount: 10, type: 'expense', category: 'food' });
      const badUpdate = await request(app)
        .put(`/api/transactions/${created.body.data.transaction.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date: 'not-a-date' });
      assert.strictEqual(badUpdate.status, 400);
    });

    test('normalizes YYYY-MM-DD dates and filters by ?from=&to=', async () => {
      await post({ amount: 100, type: 'expense', category: 'travel', date: '2026-05-15' });
      await post({ amount: 200, type: 'expense', category: 'travel', date: '2026-06-15' });
      await post({ amount: 300, type: 'expense', category: 'travel', date: '2026-07-15' });

      const res = await request(app)
        .get('/api/transactions?category=travel&from=2026-06-01&to=2026-06-30')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.results, 1);
      assert.strictEqual(res.body.data.transactions[0].amount, 200);
      assert.ok(res.body.data.transactions[0].date.startsWith('2026-06-15T'));
    });

    test('rejects an invalid range value', async () => {
      const res = await request(app)
        .get('/api/transactions?from=whenever')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(res.status, 400);
    });
  });

  describe('Monthly summary', () => {
    test('?month=YYYY-MM restricts totals to that month', async () => {
      await post({ amount: 1000, type: 'income', category: 'salary', date: '2026-06-01' });

      const june = await request(app)
        .get('/api/transactions/summary?month=2026-06')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(june.status, 200);
      assert.strictEqual(june.body.data.summary.period, '2026-06');
      assert.strictEqual(june.body.data.summary.totalIncome, 1000);
      assert.strictEqual(june.body.data.summary.totalExpenses, 200);

      const bad = await request(app)
        .get('/api/transactions/summary?month=junk')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(bad.status, 400);
    });

    test('trend endpoint returns a continuous per-month series', async () => {
      const res = await request(app)
        .get('/api/transactions/trend?months=3')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.trend.length, 3);
      assert.ok(res.body.data.trend.every(m => /^\d{4}-\d{2}$/.test(m.month)));
    });
  });

  describe('Budgets', () => {
    test('upserts a budget and reports over/warning/ok status in the summary', async () => {
      const set = await request(app)
        .put('/api/budgets/food')
        .set('Authorization', `Bearer ${token}`)
        .send({ limit: 500 });
      assert.strictEqual(set.status, 200);
      assert.strictEqual(set.body.data.budget.monthlyLimit, 500);

      // Spend 600 on food this month -> over budget
      await post({ amount: 600, type: 'expense', category: 'Food' });

      const summary = await request(app)
        .get('/api/transactions/summary')
        .set('Authorization', `Bearer ${token}`);

      const foodBudget = summary.body.data.summary.budgets.find(b => b.category === 'food');
      assert.ok(foodBudget, 'expected food budget in summary');
      assert.strictEqual(foodBudget.status, 'over');
      assert.ok(summary.body.data.summary.insights.some(i => i.includes('Budget alert')));
    });

    test('budget validation and listing with status', async () => {
      const bad = await request(app)
        .put('/api/budgets/misc')
        .set('Authorization', `Bearer ${token}`)
        .send({ limit: -5 });
      assert.strictEqual(bad.status, 400);

      const list = await request(app)
        .get('/api/budgets')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(list.status, 200);
      assert.strictEqual(list.body.results, 1);
      assert.strictEqual(list.body.data.budgets[0].category, 'food');
    });

    test('deletes a budget (404 when absent)', async () => {
      const del = await request(app)
        .delete('/api/budgets/food')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(del.status, 204);

      const again = await request(app)
        .delete('/api/budgets/food')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(again.status, 404);
    });
  });

  describe('Recurring rules', () => {
    test('a past-dated weekly rule backfills its due transactions', async () => {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - 21); // 3 weeks ago -> 4 runs incl. today

      const res = await request(app)
        .post('/api/recurring')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 15,
          type: 'expense',
          category: 'subscriptions',
          description: 'Streaming service',
          frequency: 'weekly',
          startDate: start.toISOString().slice(0, 10)
        });

      assert.strictEqual(res.status, 201);
      const ruleId = res.body.data.rule.id;
      assert.ok(new Date(res.body.data.rule.nextRunDate) > new Date(), 'nextRunDate should be in the future');

      const txs = await request(app)
        .get('/api/transactions?category=subscriptions')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(txs.body.results, 4);
      assert.ok(txs.body.data.transactions.every(t => t.recurringRuleId === ruleId));
    });

    test('rejects an invalid frequency', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10, type: 'expense', category: 'x', frequency: 'fortnightly' });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('Frequency must be one of'));
    });

    test('deleting a rule keeps its transactions and stops future runs', async () => {
      const rules = await request(app)
        .get('/api/recurring')
        .set('Authorization', `Bearer ${token}`);
      const ruleId = rules.body.data.rules[0].id;

      const del = await request(app)
        .delete(`/api/recurring/${ruleId}`)
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(del.status, 204);

      const txs = await request(app)
        .get('/api/transactions?category=subscriptions')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(txs.body.results, 4, 'existing transactions must survive rule deletion');
    });
  });

  describe('CSV export & import', () => {
    test('export returns a CSV attachment honoring filters', async () => {
      const res = await request(app)
        .get('/api/transactions/export?category=travel')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      assert.ok(res.headers['content-disposition'].includes('finedge-transactions.csv'));
      const lines = res.text.trim().split(/\r?\n/);
      assert.strictEqual(lines[0], 'id,type,category,amount,description,date');
      assert.strictEqual(lines.length, 4); // header + 3 travel rows
    });

    test('import creates valid rows and reports skipped ones', async () => {
      const csv = [
        'type,category,amount,description,date',
        'expense,groceries,45.50,"Weekly shop, market",2026-07-05',
        'income,salary,2500,,2026-07-01',
        'expense,groceries,not-a-number,bad row,2026-07-06',
        'teleport,groceries,10,bad type,2026-07-07'
      ].join('\n');

      const res = await request(app)
        .post('/api/transactions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/csv')
        .send(csv);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.imported, 2);
      assert.strictEqual(res.body.data.skipped.length, 2);
      assert.strictEqual(res.body.data.skipped[0].line, 4);

      const groceries = await request(app)
        .get('/api/transactions?category=groceries')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(groceries.body.results, 1);
      assert.strictEqual(groceries.body.data.transactions[0].amount, 45.5);
      assert.strictEqual(groceries.body.data.transactions[0].description, 'Weekly shop, market');
    });

    test('import without required columns fails with 400', async () => {
      const res = await request(app)
        .post('/api/transactions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/csv')
        .send('foo,bar\n1,2');
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes("missing the required"));
    });
  });
});
