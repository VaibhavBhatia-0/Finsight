import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../src/app';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';
import http from 'http';

describe('Markets & FX API Integration Tests (/api/v1/markets)', () => {
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

  it('1. GET /api/v1/markets/overview returns India and US index snapshots with freshness', async () => {
    const res = await fetch(`${baseUrl}/api/v1/markets/overview`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.india.length).toBeGreaterThanOrEqual(2); // NIFTY 50, SENSEX
    expect(data.data.us.length).toBeGreaterThanOrEqual(2);    // SP500, NASDAQ
    expect(data.meta.freshness).toBeDefined();
  });

  it('2. GET /api/v1/markets/stocks returns listed stocks with quotes', async () => {
    const res = await fetch(`${baseUrl}/api/v1/markets/stocks`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);

    const reliance = data.data.find((s: any) => s.symbol === 'RELIANCE');
    expect(reliance).toBeDefined();
    expect(reliance.quote.price).toBeGreaterThan(0);

    const nvda = data.data.find((s: any) => s.symbol === 'NVDA');
    expect(nvda).toBeDefined();
    expect(nvda.quote.price).toBeGreaterThan(0);
  });

  it('3. GET /api/v1/markets/stocks?q=NVIDIA searches stocks accurately', async () => {
    const res = await fetch(`${baseUrl}/api/v1/markets/stocks?q=NVIDIA`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].symbol).toBe('NVDA');
  });

  it('4. GET /api/v1/markets/stocks/:id returns detail with fundamentals', async () => {
    // Get list first to grab an ID
    const listRes = await fetch(`${baseUrl}/api/v1/markets/stocks`);
    const listData = await listRes.json();
    const stockId = listData.data[0].id;

    const res = await fetch(`${baseUrl}/api/v1/markets/stocks/${stockId}`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.stock).toBeDefined();
    expect(data.data.fundamentals).toBeDefined();
    expect(data.data.fundamentals.peRatio).toBeGreaterThan(0);
    expect(data.data.fundamentals.marketCap).toBeGreaterThan(0);
  });

  it('5. GET /api/v1/markets/stocks/:id/prices caches and returns OHLCV series', async () => {
    const listRes = await fetch(`${baseUrl}/api/v1/markets/stocks`);
    const listData = await listRes.json();
    const stockId = listData.data[0].id;

    const res = await fetch(`${baseUrl}/api/v1/markets/stocks/${stockId}/prices`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(50);
    expect(data.data[0].close).toBeGreaterThan(0);
    expect(data.data[0].date).toBeDefined();
  });

  it('6. GET /api/v1/markets/screener filters by multi-parameter criteria', async () => {
    const res = await fetch(`${baseUrl}/api/v1/markets/screener?minPrice=100&sortBy=peRatio&sortOrder=asc`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(data.data.pagination).toBeDefined();

    for (const item of data.data.items) {
      expect(item.price).toBeGreaterThanOrEqual(100);
    }
  });

  it('7. GET /api/v1/markets/fx returns dynamic exchange rate', async () => {
    const res = await fetch(`${baseUrl}/api/v1/markets/fx?from=USD&to=INR`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.from).toBe('USD');
    expect(data.data.to).toBe('INR');
    expect(data.data.rate).toBeGreaterThan(50.0);
  });
});

