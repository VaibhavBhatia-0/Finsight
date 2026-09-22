import { afterEach, describe, expect, it, vi } from 'vitest';
import { YahooFinanceMarketDataProvider } from '../../src/services/marketData/yahooProvider';

function chart(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    chart: {
      result: [{
        meta: {
          symbol: 'AAPL', currency: 'USD', exchangeName: 'NMS', fullExchangeName: 'NasdaqGS',
          regularMarketPrice: 220.25, chartPreviousClose: 218.5, regularMarketTime: now,
          regularMarketOpen: 219, regularMarketDayHigh: 221, regularMarketDayLow: 217.5,
          regularMarketVolume: 123456, fiftyTwoWeekHigh: 240, fiftyTwoWeekLow: 165,
          exchangeDataDelayedBy: 0, currentTradingPeriod: { regular: { start: now - 3600, end: now + 3600 } },
          ...overrides,
        },
        timestamp: [now],
        indicators: { quote: [{ open: [219], high: [221], low: [217.5], close: [220.25], volume: [123456] }], adjclose: [{ adjclose: [220.25] }] },
      }],
      error: null,
    },
  };
}

describe('Yahoo Finance market-data adapter', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('maps provider price, timestamp, exchange, currency, and live freshness without inventing fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(chart()), { status: 200 })));
    const quote = await YahooFinanceMarketDataProvider.getQuote('AAPL', 'NASDAQ');
    expect(quote).toMatchObject({ symbol: 'AAPL', providerSymbol: 'AAPL', provider: 'YAHOO_FINANCE_CHART', exchange: 'NasdaqGS', currency: 'USD', price: 220.25, freshnessLabel: 'LIVE', isDelayed: false, isStale: false });
    expect(quote.change).toBe(1.75);
    expect(quote.changePercent).toBeCloseTo(0.800915, 6);
    expect(quote.freshnessSeconds).toBeLessThanOrEqual(1);
    expect(new Date(quote.marketTimestamp).getTime()).not.toBeNaN();
  });

  it('calculates negative, zero, and unavailable previous-close changes from one snapshot safely', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(chart({ regularMarketPrice: 90, chartPreviousClose: 100 })), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chart({ regularMarketPrice: 100, chartPreviousClose: 100 })), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chart({ regularMarketPrice: 100, chartPreviousClose: 0, previousClose: 0 })), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const negative = await YahooFinanceMarketDataProvider.getQuote('NEGATIVE_CASE', 'NYSE');
    const unchanged = await YahooFinanceMarketDataProvider.getQuote('ZERO_CASE', 'NYSE');
    const unavailable = await YahooFinanceMarketDataProvider.getQuote('NO_PREVIOUS_CASE', 'NYSE');
    expect(negative).toMatchObject({ price: 90, previousClose: 100, change: -10, changePercent: -10 });
    expect(unchanged).toMatchObject({ price: 100, previousClose: 100, change: 0, changePercent: 0 });
    expect(unavailable).toMatchObject({ price: 100, previousClose: null, change: null, changePercent: null });
  });

  it('maps the four canonical market overview symbols without altering index tickers', () => {
    expect(YahooFinanceMarketDataProvider.providerSymbol('^NSEI', 'NSE')).toBe('^NSEI');
    expect(YahooFinanceMarketDataProvider.providerSymbol('^BSESN', 'BSE')).toBe('^BSESN');
    expect(YahooFinanceMarketDataProvider.providerSymbol('^GSPC', 'NYSE')).toBe('^GSPC');
    expect(YahooFinanceMarketDataProvider.providerSymbol('^IXIC', 'NASDAQ')).toBe('^IXIC');
  });

  it('maps exchange suffixes and provider-declared delay', async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(chart({ symbol: '500325.BO', currency: 'INR', exchangeName: 'BSE', fullExchangeName: 'BSE', regularMarketPrice: 1500, chartPreviousClose: 1490, regularMarketTime: now - 900, exchangeDataDelayedBy: 15 })), { status: 200 })));
    const quote = await YahooFinanceMarketDataProvider.getQuote('500325', 'BSE');
    expect(quote).toMatchObject({ providerSymbol: '500325.BO', currency: 'INR', freshnessLabel: 'DELAYED', isDelayed: true });
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('500325.BO');
  });

  it('returns an explicitly stale cached quote when a refresh fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T14:00:00Z'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(chart()), { status: 200 }))
      .mockResolvedValueOnce(new Response('down', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const original = await YahooFinanceMarketDataProvider.getQuote('MSFT', 'NASDAQ');
    vi.setSystemTime(new Date('2026-09-21T14:00:31Z'));
    const fallback = await YahooFinanceMarketDataProvider.getQuote('MSFT', 'NASDAQ');
    expect(original.freshnessLabel).toBe('LIVE');
    expect(fallback).toMatchObject({ source: 'YAHOO_FINANCE_CHART', freshnessLabel: 'STALE', isStale: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails explicitly when required quote fields are absent', async () => {
    const payload = chart({ regularMarketPrice: undefined, regularMarketTime: undefined });
    const result = payload.chart.result[0];
    result.timestamp = [];
    result.indicators.quote[0].close = [];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    await expect(YahooFinanceMarketDataProvider.getQuote('MISSING', 'NYSE')).rejects.toMatchObject({ code: 'MARKET_DATA_INVALID', statusCode: 503 });
  });

  it('surfaces provider failure when no real cached quote exists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));
    await expect(YahooFinanceMarketDataProvider.getQuote('FAILURE', 'NYSE')).rejects.toMatchObject({ code: 'MARKET_DATA_UNAVAILABLE', statusCode: 503 });
  });
});
