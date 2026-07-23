import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers.js';
import config from '../src/config/index.js';

describe('Categories, AI Insights & Hardening', () => {
  let token;

  before(async () => {
    resetDatabase();
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'low_user', email: 'low@finedge.com', password: 'password123' });
    token = res.body.data.token;
  });

  after(() => resetDatabase());

  const post = (payload) =>
    request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(payload);

  describe('Category normalization', () => {
    test('case, whitespace, and plural variants unify to the first-used form', async () => {
      const first = await post({ amount: 10, type: 'expense', category: 'Food' });
      assert.strictEqual(first.body.data.transaction.category, 'Food');

      const variants = await Promise.all([
        post({ amount: 5, type: 'expense', category: 'food ' }),
        post({ amount: 5, type: 'expense', category: 'FOODS' })
      ]);
      for (const res of variants) {
        assert.strictEqual(res.body.data.transaction.category, 'Food');
      }

      const list = await request(app)
        .get('/api/transactions?category=food')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(list.body.results, 3);

      const summary = await request(app)
        .get('/api/transactions/summary')
        .set('Authorization', `Bearer ${token}`);
      assert.deepStrictEqual(summary.body.data.summary.categoryBreakdown, { food: 20 });
    });

    test('-ies plurals fold too (grocery ~ Groceries)', async () => {
      const first = await post({ amount: 30, type: 'expense', category: 'Groceries' });
      assert.strictEqual(first.body.data.transaction.category, 'Groceries');

      const singular = await post({ amount: 15, type: 'expense', category: 'grocery' });
      assert.strictEqual(singular.body.data.transaction.category, 'Groceries');
    });

    test('budgets resolve to the same category as transactions', async () => {
      const res = await request(app)
        .put('/api/budgets/foods') // plural — should fold onto existing 'Food'
        .set('Authorization', `Bearer ${token}`)
        .send({ limit: 100 });
      assert.strictEqual(res.body.data.budget.category, 'Food');
    });

    test('GET /api/categories lists used categories and remaining suggestions', async () => {
      const res = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.used.includes('Food'));
      assert.ok(!res.body.data.suggestions.includes('food'), 'used category must not be re-suggested');
      assert.ok(res.body.data.suggestions.includes('transport'));
    });
  });

  describe('AI insights endpoint', () => {
    test(
      'falls back to rule-based insights when no API key is configured',
      async () => {
        const originalKey = config.groqApiKey;
        config.groqApiKey = '';
        try {
          const res = await request(app)
            .get('/api/transactions/ai-insights')
            .set('Authorization', `Bearer ${token}`);

          assert.strictEqual(res.status, 200);
          assert.strictEqual(res.body.data.source, 'rules');
          assert.ok(Array.isArray(res.body.data.insights));
          assert.ok(res.body.data.note.includes('GROQ_API_KEY'));
        } finally {
          config.groqApiKey = originalKey;
        }
      }
    );

    test('rejects an invalid month', async () => {
      const res = await request(app)
        .get('/api/transactions/ai-insights?month=nope')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(res.status, 400);
    });

    test('requires authentication', async () => {
      const res = await request(app).get('/api/transactions/ai-insights');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('Security hardening', () => {
    test('helmet security headers are present', async () => {
      const res = await request(app).get('/health');
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.ok(res.headers['content-security-policy']);
      assert.strictEqual(res.headers['x-powered-by'], undefined, 'x-powered-by must be removed');
    });

    test('no CORS headers are sent when CORS_ORIGIN is unset', async () => {
      const res = await request(app).get('/health').set('Origin', 'http://evil.example');
      assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    });
  });
});
