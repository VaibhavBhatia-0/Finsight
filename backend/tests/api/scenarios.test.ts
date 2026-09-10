import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../src/app';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';
import http from 'http';

describe('FinSight Lab Scenarios API Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let authToken = '';

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

    // Register user
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `lab_user_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Lab Explorer',
        baseCurrency: 'INR',
      }),
    });
    const data = await res.json();
    authToken = data.data.token;

    return () => {
      server.close();
    };
  });

  let savedScenarioId: string;

  it('1. POST /api/v1/scenarios/simulate allows public exploration without auth', async () => {
    const res = await fetch(`${baseUrl}/api/v1/scenarios/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'NVDA',
        startDate: '2023-06-01',
        endDate: '2024-01-02',
        initialAmount: 100000,
        baseCurrency: 'INR',
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.stock.symbol).toBe('NVDA');
    expect(data.data.financials.initial_investment).toBe(100000);
    expect(data.data.financials.gross_value).toBeGreaterThan(0);
    expect(data.data.attribution).toBeDefined();
    expect(data.data.attribution.asset_return_amount).toBeDefined();
    expect(data.data.attribution.fx_impact_amount).toBeDefined();
  });

  it('2. POST /api/v1/scenarios saves simulation for authenticated user', async () => {
    const res = await fetch(`${baseUrl}/api/v1/scenarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'My NVDA 2023 Ride',
        symbol: 'NVDA',
        stockId: 5,
        startDate: '2023-06-01',
        endDate: '2024-01-02',
        initialAmount: 50000,
        baseCurrency: 'INR',
        scenarioType: 'SINGLE_INVESTMENT',
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.scenario.id).toBeDefined();
    expect(data.data.scenario.name).toBe('My NVDA 2023 Ride');
    expect(Number(data.data.result.final_value)).toBeGreaterThan(0);

    savedScenarioId = data.data.scenario.id;
  });

  it('3. GET /api/v1/scenarios lists user saved scenarios', async () => {
    const res = await fetch(`${baseUrl}/api/v1/scenarios`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    expect(data.data[0].name).toBe('My NVDA 2023 Ride');
  });

  it('4. GET /api/v1/scenarios/:id returns complete details with attribution and assets', async () => {
    const res = await fetch(`${baseUrl}/api/v1/scenarios/${savedScenarioId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('My NVDA 2023 Ride');
    expect(data.data.assets.length).toBe(1);
    expect(data.data.result.attribution).toBeDefined();
  });
});
