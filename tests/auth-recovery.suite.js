import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers.js';
import UserService from '../src/services/userService.js';

// Reads the `exp` claim (seconds) from a JWT without verifying it.
function tokenExp(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return payload.exp;
}

describe('Password Reset & Remember Me', () => {
  before(() => resetDatabase());
  after(() => resetDatabase());

  describe('Remember me', () => {
    test('rememberMe issues a much longer-lived token than the default', async () => {
      await request(app)
        .post('/api/users/register')
        .send({ username: 'rm_user', email: 'rm@finedge.com', password: 'password123' });

      const normal = await request(app)
        .post('/api/users/login')
        .send({ email: 'rm@finedge.com', password: 'password123' });
      const remembered = await request(app)
        .post('/api/users/login')
        .send({ email: 'rm@finedge.com', password: 'password123', rememberMe: true });

      const normalExp = tokenExp(normal.body.data.token);
      const rememberedExp = tokenExp(remembered.body.data.token);
      // Default 7d vs remember 30d -> remembered expires clearly later (> 2 weeks more)
      assert.ok(rememberedExp - normalExp > 14 * 24 * 60 * 60, 'remembered token should outlive the default by weeks');
    });
  });

  describe('Password reset', () => {
    before(async () => {
      await request(app)
        .post('/api/users/register')
        .send({ username: 'reset_user', email: 'reset@finedge.com', password: 'password123' });
    });

    test('forgot-password returns a generic 200 for both known and unknown emails', async () => {
      const known = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'reset@finedge.com' });
      const unknown = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'nobody@finedge.com' });

      assert.strictEqual(known.status, 200);
      assert.strictEqual(unknown.status, 200);
      // Identical response -> no user enumeration, and never leaks a token
      assert.strictEqual(known.body.message, unknown.body.message);
      assert.strictEqual(known.body.token, undefined);
    });

    test('a valid token resets the password; old fails, new works', async () => {
      // Obtain the raw token via the service (the HTTP layer never returns it)
      const { token } = await UserService.requestPasswordReset('reset@finedge.com');

      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ token, newPassword: 'brandnew456' });
      assert.strictEqual(res.status, 200);

      const oldLogin = await request(app)
        .post('/api/users/login')
        .send({ email: 'reset@finedge.com', password: 'password123' });
      assert.strictEqual(oldLogin.status, 401);

      const newLogin = await request(app)
        .post('/api/users/login')
        .send({ email: 'reset@finedge.com', password: 'brandnew456' });
      assert.strictEqual(newLogin.status, 200);
    });

    test('a used token cannot be reused', async () => {
      const { token } = await UserService.requestPasswordReset('reset@finedge.com');
      await request(app).post('/api/users/reset-password').send({ token, newPassword: 'another789' });

      const reuse = await request(app)
        .post('/api/users/reset-password')
        .send({ token, newPassword: 'shouldfail000' });
      assert.strictEqual(reuse.status, 400);
      assert.ok(reuse.body.message.includes('Invalid or expired'));
    });

    test('a bogus token is rejected', async () => {
      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ token: 'not-a-real-token', newPassword: 'password123' });
      assert.strictEqual(res.status, 400);
    });

    test('validation: short new password and missing email are rejected', async () => {
      const shortPw = await request(app)
        .post('/api/users/reset-password')
        .send({ token: 'x', newPassword: '123' });
      assert.strictEqual(shortPw.status, 400);

      const badEmail = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'not-an-email' });
      assert.strictEqual(badEmail.status, 400);
    });

    test('the reset token hash never leaks in profile responses', async () => {
      await UserService.requestPasswordReset('reset@finedge.com');
      const login = await request(app)
        .post('/api/users/login')
        .send({ email: 'reset@finedge.com', password: 'another789' });
      assert.strictEqual(login.body.data.user.resetTokenHash, undefined);
      assert.strictEqual(login.body.data.user.resetTokenExpires, undefined);
      assert.strictEqual(login.body.data.user.password, undefined);
    });
  });
});
