import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../src/app';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';
import http from 'http';
import { db } from '../../src/database/db';

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
    expect(data.data.items.length).toBeGreaterThan(0);
    expect(data.data.pagination).toMatchObject({ page: 1, total: 8 });

    const reliance = data.data.items.find((s: any) => s.symbol === 'RELIANCE');
    expect(reliance).toBeDefined();
    expect(reliance.quote.price).toBeGreaterThan(0);

    const nvda = data.data.items.find((s: any) => s.symbol === 'NVDA');
    expect(nvda).toBeDefined();
    expect(nvda.quote.price).toBeGreaterThan(0);
  });

  it('3. GET /api/v1/markets/stocks?q=NVIDIA searches stocks accurately', async () => {
    const res = await fetch(`${baseUrl}/api/v1/markets/stocks?q=NVIDIA`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.items.length).toBe(1);
    expect(data.data.items[0].symbol).toBe('NVDA');
  });

  it('4. GET /api/v1/markets/stocks/:id returns detail with fundamentals', async () => {
    // Get list first to grab an ID
    const listRes = await fetch(`${baseUrl}/api/v1/markets/stocks`);
    const listData = await listRes.json();
    const stockId = listData.data.items[0].id;

    const res = await fetch(`${baseUrl}/api/v1/markets/stocks/${stockId}`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.stock).toBeDefined();
    expect(data.data.fundamentals).toBeDefined();
    expect(data.data.fundamentals.peRatio).toBeGreaterThan(0);
    expect(data.data.fundamentals.marketCap).toBeGreaterThan(0);
    expect(data.data.quote.source).toBe('FINSIGHT_TEST_FIXTURE');
  });

  it('5. GET /api/v1/markets/stocks/:id/prices caches and returns OHLCV series', async () => {
    const listRes = await fetch(`${baseUrl}/api/v1/markets/stocks`);
    const listData = await listRes.json();
    const stockId = listData.data.items[0].id;

    const res = await fetch(`${baseUrl}/api/v1/markets/stocks/${stockId}/prices`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.bars.length).toBeGreaterThan(50);
    expect(data.data.bars[0].close).toBeGreaterThan(0);
    expect(data.data.bars[0].date).toBeDefined();
    expect(data.data.provider).toBe('FINSIGHT_TEST_FIXTURE');
  });

  it('6. GET /api/v1/markets/screener filters by multi-parameter criteria', async () => {
    const res = await fetch(`${baseUrl}/api/v1/markets/screener?minPrice=100&maxDivYield=3.5&minEps=1&minVolume=1000000&minYearPosition=0&movingAverageRelation=GOLDEN_CROSS&sortBy=peRatio&sortOrder=asc`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(data.data.pagination).toBeDefined();

    for (const item of data.data.items) {
      expect(item.price).toBeGreaterThanOrEqual(100);
      expect(item.dividendYield).toBeLessThanOrEqual(3.5);
      expect(item.eps).toBeGreaterThanOrEqual(1);
      expect(item.volume).toBeGreaterThanOrEqual(1000000);
      expect(item.yearPosition).toBeGreaterThanOrEqual(0);
      expect(item.sma50).toBeGreaterThan(item.sma200);
    }
  });

  it('6b. GET /api/v1/markets/screener rejects invalid filter values', async () => {
    const res = await fetch(`${baseUrl}/api/v1/markets/screener?minRsi=101`);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
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

  it('8. searches and paginates a universe larger than the original eight-stock seed without quote fan-out', async () => {
    const exchange = await db.query<{ id: string }>("SELECT id FROM exchanges WHERE code = 'NASDAQ' LIMIT 1");
    for (let index = 0; index < 12; index += 1) {
      const symbol = `ZZ${String(index).padStart(2, '0')}`;
      await db.query(`INSERT INTO stocks (symbol,display_symbol,provider_symbol,exchange_id,exchange,company_name,currency,sector,industry,asset_type,is_active) VALUES ($1,$1,$1,$2,'NASDAQ',$3,'USD','Technology','Software','EQUITY',TRUE) ON CONFLICT (symbol,exchange_id) DO NOTHING`, [symbol, exchange.rows[0].id, `Zenith Test Company ${index}`]);
    }
    const first = await fetch(`${baseUrl}/api/v1/markets/securities/search?q=zenith&page=1&pageSize=5`);
    const firstData = await first.json();
    const second = await fetch(`${baseUrl}/api/v1/markets/securities/search?q=zenith&page=2&pageSize=5`);
    const secondData = await second.json();
    expect(first.status).toBe(200);
    expect(firstData.data.pagination).toMatchObject({ page: 1, pageSize: 5, total: 12, totalPages: 3 });
    expect(firstData.data.items).toHaveLength(5);
    expect(secondData.data.items).toHaveLength(5);
    expect(new Set([...firstData.data.items, ...secondData.data.items].map((row: any) => row.id)).size).toBe(10);
    expect(firstData.data.items[0]).not.toHaveProperty('quote');
  });

  it('9. supports ticker, company, partial, exchange, country, and no-result security searches', async () => {
    const ticker = await (await fetch(`${baseUrl}/api/v1/markets/securities/search?q=ZZ11&page=1&pageSize=20`)).json();
    const company = await (await fetch(`${baseUrl}/api/v1/markets/securities/search?q=Zenith%20Test%20Company%2011&page=1&pageSize=20`)).json();
    const partial = await (await fetch(`${baseUrl}/api/v1/markets/securities/search?q=Zeni&page=1&pageSize=20`)).json();
    const exchange = await (await fetch(`${baseUrl}/api/v1/markets/securities/search?q=NASDAQ&page=1&pageSize=20`)).json();
    const country = await (await fetch(`${baseUrl}/api/v1/markets/securities/search?q=US&page=1&pageSize=20`)).json();
    const missing = await (await fetch(`${baseUrl}/api/v1/markets/securities/search?q=NO_SUCH_SECURITY_8472&page=1&pageSize=20`)).json();
    expect(ticker.data.items[0].symbol).toBe('ZZ11');
    expect(company.data.items.some((row: any) => row.symbol === 'ZZ11')).toBe(true);
    expect(partial.data.pagination.total).toBe(12);
    expect(exchange.data.pagination.total).toBeGreaterThan(10);
    expect(country.data.pagination.total).toBeGreaterThan(10);
    expect(missing.data.items).toEqual([]);
  });

  it('10. returns a selected quote, date-specific historical price, and server technicals', async () => {
    const search = await (await fetch(`${baseUrl}/api/v1/markets/securities/search?q=AAPL&page=1&pageSize=5`)).json();
    const stockId = search.data.items[0].id;
    const quote = await fetch(`${baseUrl}/api/v1/markets/securities/${stockId}/quote`);
    const quoteData = await quote.json();
    const historical = await fetch(`${baseUrl}/api/v1/markets/securities/${stockId}/historical-price?date=2024-01-15`);
    const historicalData = await historical.json();
    const technicals = await fetch(`${baseUrl}/api/v1/markets/securities/${stockId}/technicals?period=1Y`);
    const technicalData = await technicals.json();
    expect(quoteData.data).toMatchObject({ security: { symbol: 'AAPL', currency: 'USD' }, quote: { source: 'FINSIGHT_TEST_FIXTURE' } });
    expect(historicalData.data).toMatchObject({ requestedDate: '2024-01-15', currency: 'USD', source: 'FINSIGHT_TEST_FIXTURE' });
    expect(historicalData.data.priceDate <= '2024-01-15').toBe(true);
    expect(technicalData.data.series.length).toBeGreaterThan(200);
    expect(technicalData.data.summary).toHaveProperty('rsi14');
  });

  it('11. compares multiple securities on a common series rebased to exactly 100', async () => {
    const response = await fetch(`${baseUrl}/api/v1/markets/compare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ securityIds: [1, 6] }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.data.securities).toHaveLength(2);
    expect(data.data.securities.every((row: any) => row.normalizedSeries[0].value === 100)).toBe(true);
    expect(data.data.securities.every((row: any) => row.performance['1D'] != null)).toBe(true);
    expect(data.data.securities.every((row: any) => row.risk.maxDrawdown != null)).toBe(true);
  });

  it('12. returns explicit errors for unavailable selected quotes and historical dates', async () => {
    const quote = await fetch(`${baseUrl}/api/v1/markets/securities/999999/quote`);
    const history = await fetch(`${baseUrl}/api/v1/markets/securities/1/historical-price?date=2000-01-01`);
    expect(quote.status).toBe(404);
    expect((await quote.json()).error.code).toBe('SECURITY_NOT_FOUND');
    expect(history.status).toBe(404);
    expect((await history.json()).error.code).toBe('HISTORICAL_PRICE_UNAVAILABLE');
  });
});
