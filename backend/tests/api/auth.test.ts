import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../src/app';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';
import http from 'http';
import { AuthActionTokenRepository } from '../../src/repositories/authActionToken.repository';
import { UserRepository } from '../../src/repositories/user.repository';
import { db } from '../../src/database/db';

describe('Auth API Integration Tests (/api/v1/auth)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await runMigrations();
    await runSeeds();

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    return () => {
      server.close();
    };
  });

  const testUser = {
    email: `trader_${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Rohit Sharma',
    baseCurrency: 'INR',
  };

  let authToken = '';

  it('1. POST /api/v1/auth/register registers new user and auto-creates preferences', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe(testUser.email.toLowerCase());
    expect(data.data.user.baseCurrency).toBe('INR');
    expect(data.data.preferences).toBeDefined();
    expect(data.data.preferences.default_currency).toBe('INR');
    expect(data.data.token).toBeDefined();

    authToken = data.data.token;
  });

  it('2. POST /api/v1/auth/register rejects duplicate registration with 409', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('EMAIL_EXISTS');
  });

  it('3. POST /api/v1/auth/login succeeds with correct credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.preferences).toBeDefined();
  });

  it('4. POST /api/v1/auth/login fails with invalid password', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'WrongPassword!',
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('5. GET /api/v1/auth/me returns authenticated profile', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe(testUser.email.toLowerCase());
  });

  it('6. PUT /api/v1/auth/preferences updates theme and layout', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        theme: 'dark',
        selected_market_indices: ['NIFTY_50', 'SP500'],
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.theme).toBe('dark');
  });

  it('7. GET /api/v1/auth/me without token returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('8. confirms a hashed, one-use email verification token', async () => {
    const user = await UserRepository.findByEmail(testUser.email);
    const token = await AuthActionTokenRepository.create(user!.id, 'EMAIL_VERIFICATION', 60);
    const stored = await db.query<{ token_hash: string }>('SELECT token_hash FROM auth_action_tokens WHERE user_id = $1 AND token_type = $2;', [user!.id, 'EMAIL_VERIFICATION']);
    expect(stored.rows[0].token_hash).not.toBe(token);
    expect(stored.rows[0].token_hash).toHaveLength(64);

    const confirm = await fetch(`${baseUrl}/api/v1/auth/verification/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    expect(confirm.status).toBe(200);
    const replay = await fetch(`${baseUrl}/api/v1/auth/verification/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    expect(replay.status).toBe(400);
    expect((await replay.json()).error.code).toBe('INVALID_VERIFICATION_TOKEN');
  });

  it('9. resets the password once and revokes older JWTs through auth versioning', async () => {
    const user = await UserRepository.findByEmail(testUser.email);
    const token = await AuthActionTokenRepository.create(user!.id, 'PASSWORD_RESET', 30);
    const reset = await fetch(`${baseUrl}/api/v1/auth/password-reset/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: 'NewSecurePassword456!' }) });
    expect(reset.status).toBe(200);

    const oldJwt = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } });
    expect(oldJwt.status).toBe(401);
    expect((await oldJwt.json()).error.code).toBe('INVALID_TOKEN');
    const oldPassword = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: testUser.email, password: testUser.password }) });
    expect(oldPassword.status).toBe(401);
    const newPassword = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: testUser.email, password: 'NewSecurePassword456!' }) });
    expect(newPassword.status).toBe(200);
  });

  it('10. fails explicitly when Google OAuth credentials are not configured', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/google`);
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('OAUTH_NOT_CONFIGURED');
  });
});
