import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../src/app.js';

const usersDbPath = path.resolve('src/data/users.json');
const txDbPath = path.resolve('src/data/transactions.json');

describe('User Authentication API', () => {
  let originalUsers = '[]';
  let originalTxs = '[]';

  before(async () => {
    // Back up the databases
    try {
      originalUsers = await fs.readFile(usersDbPath, 'utf8');
    } catch (e) {
      originalUsers = '[]';
    }
    try {
      originalTxs = await fs.readFile(txDbPath, 'utf8');
    } catch (e) {
      originalTxs = '[]';
    }

    // Set up clean environment
    await fs.writeFile(usersDbPath, '[]');
    await fs.writeFile(txDbPath, '[]');
  });

  after(async () => {
    // Restore original database contents
    await fs.writeFile(usersDbPath, originalUsers);
    await fs.writeFile(txDbPath, originalTxs);
  });

  describe('POST /api/users/register', () => {
    test('should register a new user successfully and return a token (without password)', async () => {
      const payload = {
        username: 'test_user_node',
        email: 'testnode@finedge.com',
        password: 'password123'
      };

      const res = await request(app)
        .post('/api/users/register')
        .send(payload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.status, 'success');
      assert.ok(res.body.data.token);
      assert.strictEqual(res.body.data.user.username, payload.username);
      assert.strictEqual(res.body.data.user.email, payload.email);
      assert.strictEqual(res.body.data.user.password, undefined);
    });

    test('should reject duplicate registration with same username or email', async () => {
      const payload = {
        username: 'test_user_node',
        email: 'testnode@finedge.com',
        password: 'password123'
      };

      // Attempt duplicate registration
      const res = await request(app)
        .post('/api/users/register')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('already registered'));
    });

    test('should reject registration with invalid fields', async () => {
      const payload = {
        username: 'ab', // too short
        email: 'invalid-email',
        password: '123' // too short
      };

      const res = await request(app)
        .post('/api/users/register')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('Username must be a string and contain at least 3 characters') || res.body.message.includes('valid email') || res.body.message.includes('Password must be a string and contain at least 6 characters'));
    });
  });

  describe('POST /api/users/login', () => {
    test('should authenticate and login valid user successfully', async () => {
      const payload = {
        email: 'testnode@finedge.com',
        password: 'password123'
      };

      const res = await request(app)
        .post('/api/users/login')
        .send(payload);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'success');
      assert.ok(res.body.data.token);
      assert.strictEqual(res.body.data.user.email, payload.email);
      assert.strictEqual(res.body.data.user.password, undefined);
    });

    test('should reject login with wrong credentials', async () => {
      const payload = {
        email: 'testnode@finedge.com',
        password: 'wrongpassword'
      };

      const res = await request(app)
        .post('/api/users/login')
        .send(payload);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('Invalid email or password'));
    });

    test('should reject login when required fields are missing', async () => {
      const payload = {
        email: 'testnode@finedge.com'
        // missing password
      };

      const res = await request(app)
        .post('/api/users/login')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.status, 'fail');
      assert.ok(res.body.message.includes('Password is required'));
    });
  });
});
