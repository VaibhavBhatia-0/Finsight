import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../src/app';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';
import http from 'http';

describe('Portfolios & Watchlists API Integration Tests', () => {
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

    // Register test user
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `portfolio_tester_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Portfolio User',
        baseCurrency: 'INR',
      }),
    });
    const data = await res.json();
    authToken = data.data.token;

    return () => {
      server.close();
    };
  });

  let portfolioId: string;

  it('1. GET /api/v1/watchlists creates and returns default watchlist', async () => {
    const res = await fetch(`${baseUrl}/api/v1/watchlists`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].items.length).toBeGreaterThan(0);
  });

  it('2. POST /api/v1/portfolios creates portfolio with default deposit', async () => {
    const res = await fetch(`${baseUrl}/api/v1/portfolios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Alpha Growth Portfolio',
        baseCurrency: 'INR',
        benchmarkId: 1, // NIFTY 50
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.portfolio.name).toBe('Alpha Growth Portfolio');
    expect(data.data.summary.cashBalance).toBe(100000);
    expect(data.data.summary.totalValue).toBe(100000);

    portfolioId = data.data.portfolio.id;
  });

  it('3. POST /api/v1/portfolios/:id/transactions records BUY transaction and updates holdings', async () => {
    // Buy 10 shares of RELIANCE (stock_id = 1) at ₹2950
    const buyAmount = 10 * 2950;
    const res = await fetch(`${baseUrl}/api/v1/portfolios/${portfolioId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        stockId: 1,
        transactionType: 'BUY',
        transactionDate: '2024-01-15',
        quantity: 10,
        price: 2950,
        amount: buyAmount,
        currency: 'INR',
        feeAmount: 50,
        notes: 'Initial buy of Reliance',
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.valuation.summary.cashBalance).toBe(100000 - buyAmount - 50);

    // Verify derived holdings
    const relianceHolding = data.data.valuation.holdings.find((h: any) => h.symbol === 'RELIANCE');
    expect(relianceHolding).toBeDefined();
    expect(relianceHolding.quantity).toBe(10);
    expect(relianceHolding.averageCost).toBeCloseTo((buyAmount + 50) / 10, 1);
  });

  it('4. POST /api/v1/portfolios/:id/transactions records DIVIDEND and updates cash', async () => {
    const res = await fetch(`${baseUrl}/api/v1/portfolios/${portfolioId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        stockId: 1,
        transactionType: 'DIVIDEND',
        transactionDate: '2024-06-15',
        amount: 250,
        currency: 'INR',
        notes: 'Annual dividend',
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.valuation.summary.dividendsEarned).toBe(250);
  });

  it('5. GET /api/v1/portfolios/:id returns complete valuation and metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/portfolios/${portfolioId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.summary.totalValue).toBeGreaterThan(0);
    expect(data.data.risk.sharpeRatio).toBeDefined();
    expect(data.data.risk.volatility).toBeDefined();
  });
});

