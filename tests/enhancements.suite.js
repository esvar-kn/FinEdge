import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers.js';

describe('Currency, Goals, Reminders, Forecast & Report', () => {
  let token;

  before(async () => {
    resetDatabase();
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'enh_user', email: 'enh@finedge.com', password: 'password123' });
    token = res.body.data.token;
  });

  after(() => resetDatabase());

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const post = (payload) => request(app).post('/api/transactions').set(auth()).send(payload);

  describe('Currency settings', () => {
    test('new users default to USD and settings list the options', async () => {
      const me = await request(app).get('/api/users/me').set(auth());
      assert.strictEqual(me.body.data.user.currency, 'USD');

      const settings = await request(app).get('/api/users/settings').set(auth());
      assert.strictEqual(settings.status, 200);
      assert.strictEqual(settings.body.data.currency, 'USD');
      assert.ok(settings.body.data.supportedCurrencies.some(c => c.code === 'INR'));
    });

    test('currency can be changed and is reflected on the profile', async () => {
      const res = await request(app)
        .put('/api/users/settings')
        .set(auth())
        .send({ currency: 'inr' }); // lowercase -> normalized
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.user.currency, 'INR');

      const me = await request(app).get('/api/users/me').set(auth());
      assert.strictEqual(me.body.data.user.currency, 'INR');
    });

    test('an unsupported currency is rejected', async () => {
      const res = await request(app)
        .put('/api/users/settings')
        .set(auth())
        .send({ currency: 'XYZ' });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('Unsupported currency'));
    });
  });

  describe('Savings goals', () => {
    let goalId;

    test('creates a goal with computed progress', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set(auth())
        .send({ name: 'Emergency fund', target: 1000, saved: 250, deadline: '2026-12-31' });
      assert.strictEqual(res.status, 201);
      const g = res.body.data.goal;
      goalId = g.id;
      assert.strictEqual(g.target, 1000);
      assert.strictEqual(g.saved, 250);
      assert.strictEqual(g.remaining, 750);
      assert.strictEqual(g.percentSaved, 25);
      assert.strictEqual(g.complete, false);
    });

    test('rejects an invalid target', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set(auth())
        .send({ name: 'Bad', target: -5 });
      assert.strictEqual(res.status, 400);
    });

    test('contributions move the saved balance and can complete the goal', async () => {
      const res = await request(app)
        .post(`/api/goals/${goalId}/contribute`)
        .set(auth())
        .send({ amount: 800 });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.goal.saved, 1050);
      assert.strictEqual(res.body.data.goal.complete, true);
      assert.strictEqual(res.body.data.goal.remaining, 0);
    });

    test('a withdrawal is clamped at zero', async () => {
      const res = await request(app)
        .post(`/api/goals/${goalId}/contribute`)
        .set(auth())
        .send({ amount: -99999 });
      assert.strictEqual(res.body.data.goal.saved, 0);
    });

    test('ownership is enforced', async () => {
      const other = await request(app)
        .post('/api/users/register')
        .send({ username: 'enh_other', email: 'other@finedge.com', password: 'password123' });
      const res = await request(app)
        .delete(`/api/goals/${goalId}`)
        .set({ Authorization: `Bearer ${other.body.data.token}` });
      assert.strictEqual(res.status, 403);
    });

    test('lists and deletes goals', async () => {
      const list = await request(app).get('/api/goals').set(auth());
      assert.strictEqual(list.body.results, 1);

      const del = await request(app).delete(`/api/goals/${goalId}`).set(auth());
      assert.strictEqual(del.status, 204);

      const after = await request(app).get('/api/goals').set(auth());
      assert.strictEqual(after.body.results, 0);
    });
  });

  describe('Bill reminders (recurring/upcoming)', () => {
    test('lists rules due within the horizon with daysUntil', async () => {
      // A weekly rule starting today: after today's run materializes, the next
      // run is ~7 days out — reliably inside a 30-day horizon (a monthly rule
      // would advance ~31 days out and could fall just outside near month-end).
      await request(app)
        .post('/api/recurring')
        .set(auth())
        .send({ type: 'expense', category: 'groceries', amount: 80, frequency: 'weekly' });

      const res = await request(app).get('/api/recurring/upcoming?days=30').set(auth());
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.results >= 1, 'expected at least one upcoming bill');
      const bill = res.body.data.upcoming[0];
      assert.ok('daysUntil' in bill);
      assert.ok(bill.daysUntil <= 7, 'weekly bill should be due within a week');
    });
  });

  describe('Forecast', () => {
    test('projects month end = actuals + remaining scheduled recurring', async () => {
      // Fresh user to isolate the math
      const reg = await request(app)
        .post('/api/users/register')
        .send({ username: 'fc_user', email: 'fc@finedge.com', password: 'password123' });
      const fcAuth = { Authorization: `Bearer ${reg.body.data.token}` };

      // Actual income this month
      await request(app).post('/api/transactions').set(fcAuth)
        .send({ type: 'income', category: 'salary', amount: 4000 });
      // A weekly recurring expense (will have future runs this month)
      await request(app).post('/api/recurring').set(fcAuth)
        .send({ type: 'expense', category: 'food', amount: 100, frequency: 'weekly' });

      const res = await request(app).get('/api/transactions/forecast').set(fcAuth);
      assert.strictEqual(res.status, 200);
      const f = res.body.data.forecast;
      assert.strictEqual(f.actual.income, 4000);
      // projected income >= actual; projected expenses >= actual expenses
      assert.ok(f.projected.income >= f.actual.income);
      assert.ok(f.projected.expenses >= f.actual.expenses);
      assert.strictEqual(f.projected.net, Math.round((f.projected.income - f.projected.expenses) * 100) / 100);
    });
  });

  describe('Year report', () => {
    test('returns 12 months, totals, and category breakdown', async () => {
      const reg = await request(app)
        .post('/api/users/register')
        .send({ username: 'rep_user', email: 'rep@finedge.com', password: 'password123' });
      const rAuth = { Authorization: `Bearer ${reg.body.data.token}` };

      await request(app).post('/api/transactions').set(rAuth)
        .send({ type: 'income', category: 'salary', amount: 3000, date: '2025-03-10' });
      await request(app).post('/api/transactions').set(rAuth)
        .send({ type: 'expense', category: 'travel', amount: 500, date: '2025-03-15' });

      const res = await request(app).get('/api/transactions/report?year=2025').set(rAuth);
      assert.strictEqual(res.status, 200);
      const rep = res.body.data.report;
      assert.strictEqual(rep.year, 2025);
      assert.strictEqual(rep.months.length, 12);
      assert.strictEqual(rep.totalIncome, 3000);
      assert.strictEqual(rep.totalExpenses, 500);
      assert.strictEqual(rep.months.find(m => m.month === '2025-03').income, 3000);
      assert.strictEqual(rep.categoryBreakdown.travel, 500);
    });

    test('rejects an invalid year', async () => {
      const res = await request(app).get('/api/transactions/report?year=99').set(auth());
      assert.strictEqual(res.status, 400);
    });
  });
});
