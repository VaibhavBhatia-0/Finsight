import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwelveDataMarketDataProvider } from '../../src/services/marketData/twelveDataProvider';

describe('Twelve Data market-data adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('maps an external quote into the canonical FinSight quote contract', async () => {
    vi.stubEnv('MARKET_DATA_PROVIDER', 'twelve_data');
    vi.stubEnv('TWELVE_DATA_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      symbol: 'AAPL', open: '198.50', high: '202.25', low: '197.75', close: '201.20',
      previous_close: '199.00', change: '2.20', percent_change: '1.1055', volume: '1200500',
      datetime: '2026-09-11',
    }), { status: 200 })));

    const quote = await TwelveDataMarketDataProvider.getQuote('AAPL', 'NASDAQ');

    expect(quote).toMatchObject({ symbol: 'AAPL', price: 201.2, previousClose: 199, change: 2.2, changePercent: 1.1055, volume: 1200500, freshness: 'DELAYED', source: 'TWELVE_DATA' });
    expect(fetch).toHaveBeenCalledOnce();
    const requested = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(requested.searchParams.get('symbol')).toBe('AAPL');
    expect(requested.searchParams.get('exchange')).toBe('NASDAQ');
  });

  it('rejects a provider response without a valid positive price', async () => {
    vi.stubEnv('MARKET_DATA_PROVIDER', 'twelve_data');
    vi.stubEnv('TWELVE_DATA_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ symbol: 'AAPL', close: 'not-a-number' }), { status: 200 })));

    await expect(TwelveDataMarketDataProvider.getQuote('AAPL')).rejects.toMatchObject({ code: 'MARKET_DATA_INVALID', statusCode: 503 });
  });

  it('leaves unavailable quote fields null instead of fabricating zeroes or prices', async () => {
    vi.stubEnv('MARKET_DATA_PROVIDER', 'twelve_data');
    vi.stubEnv('TWELVE_DATA_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      symbol: 'AAPL', close: '201.20', datetime: '2026-09-11',
    }), { status: 200 })));

    const quote = await TwelveDataMarketDataProvider.getQuote('AAPL');

    expect(quote).toMatchObject({ previousClose: null, change: null, changePercent: null, open: null, high: null, low: null, volume: null });
  });
});
