import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers.js';

describe('Persistence Concurrency & Update Validation', () => {
  let token;

  before(async () => {
    resetDatabase();

    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'race_user', email: 'race@finedge.com', password: 'password123' });
    token = res.body.data.token;
  });

  after(() => resetDatabase());

  test('all concurrent transaction writes are persisted (no lost updates)', async () => {
    const N = 20;
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send({ amount: i + 1, type: 'expense', category: 'race' })
      )
    );

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.results, N, `expected all ${N} concurrent writes to survive`);
  });

  test('PUT rejects an invalid amount instead of corrupting the record', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, type: 'expense', category: 'utility' });
    const id = created.body.data.transaction.id;

    // non-numeric amount would previously become NaN -> null in the file
    const res = await request(app)
      .put(`/api/transactions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 'ten dollars' });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.message.includes('Amount must be a positive number'));

    // negative amount is also rejected
    const negative = await request(app)
      .put(`/api/transactions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: -50 });
    assert.strictEqual(negative.status, 400);

    // invalid type is rejected
    const badType = await request(app)
      .put(`/api/transactions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'banana' });
    assert.strictEqual(badType.status, 400);
  });

  test('registration rejects a duplicate username', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ username: 'race_user', email: 'different@finedge.com', password: 'password123' });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.message.includes('Username is already taken'));
  });
});
