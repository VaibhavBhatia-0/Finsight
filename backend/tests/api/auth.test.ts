import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../src/app';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';
import http from 'http';

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
});

