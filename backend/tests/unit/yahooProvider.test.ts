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
    expect(YahooFinanceMarketDataProvider.providerSymbol('BRK.B', 'NYSE')).toBe('BRK-B');
    expect(YahooFinanceMarketDataProvider.providerSymbol('RELIANCE.NS', 'NSE')).toBe('RELIANCE.NS');
  });

  it('maps exchange suffixes and provider-declared delay', async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(chart({ symbol: '500325.BO', currency: 'INR', exchangeName: 'BSE', fullExchangeName: 'BSE', regularMarketPrice: 1500, chartPreviousClose: 1490, regularMarketTime: now - 900, exchangeDataDelayedBy: 15 })), { status: 200 })));
    const quote = await YahooFinanceMarketDataProvider.getQuote('500325', 'BSE');
    expect(quote).toMatchObject({ providerSymbol: '500325.BO', currency: 'INR', freshnessLabel: 'DELAYED', isDelayed: true });
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('500325.BO');
  });

  it('maps successful provider history into adjusted OHLCV bars', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(chart()), { status: 200 })));
    const history = await YahooFinanceMarketDataProvider.getHistory('HISTORY_SUCCESS', 'NASDAQ', '1mo', '1d');
    expect(history).toMatchObject({
      symbol: 'HISTORY_SUCCESS', provider: 'YAHOO_FINANCE_CHART', currency: 'USD',
      exchange: 'NasdaqGS', range: '1mo', interval: '1d', adjusted: true, isStale: false,
    });
    expect(history.bars).toEqual([expect.objectContaining({
      open: 219, high: 221, low: 217.5, close: 220.25, adjusted_close: 220.25, volume: 123456,
    })]);
    const requestedUrl = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(requestedUrl).toContain('/chart/HISTORY_SUCCESS');
    expect(requestedUrl).toContain('range=1mo');
    expect(requestedUrl).toContain('interval=1d');
  });

  it('labels expired cached history as stale and replaces it after provider recovery', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T14:00:00Z'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(chart()), { status: 200 }))
      .mockResolvedValueOnce(new Response('temporary outage', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chart({ regularMarketPrice: 222 })), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const original = await YahooFinanceMarketDataProvider.getHistory('HISTORY_RECOVERY_CASE', 'NASDAQ', '1mo', '1d');
    vi.setSystemTime(new Date('2026-09-21T20:00:01Z'));
    const fallback = await YahooFinanceMarketDataProvider.getHistory('HISTORY_RECOVERY_CASE', 'NASDAQ', '1mo', '1d');
    expect(fallback).toMatchObject({ isStale: true, fetchedAt: original.fetchedAt, bars: original.bars });
    const recovered = await YahooFinanceMarketDataProvider.getHistory('HISTORY_RECOVERY_CASE', 'NASDAQ', '1mo', '1d');
    expect(recovered.isStale).toBe(false);
    expect(recovered.fetchedAt).not.toBe(original.fetchedAt);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

  it('recovers a stale cached quote after the provider becomes available', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T14:00:00Z'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(chart()), { status: 200 }))
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chart({ regularMarketPrice: 222 })), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const original = await YahooFinanceMarketDataProvider.getQuote('RECOVERY_CASE', 'NASDAQ');
    vi.setSystemTime(new Date('2026-09-21T14:00:31Z'));
    const stale = await YahooFinanceMarketDataProvider.getQuote('RECOVERY_CASE', 'NASDAQ');
    expect(stale).toMatchObject({ isStale: true, fetchedAt: original.fetchedAt });
    vi.setSystemTime(new Date('2026-09-21T14:01:02Z'));
    const recovered = await YahooFinanceMarketDataProvider.getQuote('RECOVERY_CASE', 'NASDAQ');
    expect(recovered).toMatchObject({ price: 222, isStale: false });
    expect(recovered.fetchedAt).not.toBe(original.fetchedAt);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
    const fetchMock = vi.fn(async () => new Response('unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(YahooFinanceMarketDataProvider.getQuote('FAILURE', 'NYSE')).rejects.toMatchObject({ code: 'MARKET_DATA_UNAVAILABLE', statusCode: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds a timed-out provider request and returns an explicit unavailable error', async () => {
    const fetchMock = vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); });
    vi.stubGlobal('fetch', fetchMock);
    await expect(YahooFinanceMarketDataProvider.getQuote('TIMEOUT_CASE', 'NYSE')).rejects.toMatchObject({
      code: 'MARKET_DATA_UNAVAILABLE', statusCode: 503,
    });
    expect(YahooFinanceMarketDataProvider.getHealth()).toMatchObject({ error: 'Market provider request timed out' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('recovers from one transient provider 5xx with a bounded retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('temporary failure', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chart()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(YahooFinanceMarketDataProvider.getQuote('TRANSIENT_CASE', 'NYSE')).resolves.toMatchObject({ price: 220.25 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds concurrent outbound provider requests across different symbols', async () => {
    let active = 0;
    let maximum = 0;
    const fetchMock = vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active -= 1;
      return new Response(JSON.stringify(chart()), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all(['BOUND1', 'BOUND2', 'BOUND3', 'BOUND4', 'BOUND5'].map(symbol => YahooFinanceMarketDataProvider.getQuote(symbol, 'NYSE')));
    expect(maximum).toBeLessThanOrEqual(2);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('records an upstream rate limit separately from application failures', async () => {
    const fetchMock = vi.fn(async () => new Response('rate limited', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(YahooFinanceMarketDataProvider.getQuote('RATE_LIMIT_CASE', 'NYSE')).rejects.toMatchObject({ code: 'MARKET_DATA_UNAVAILABLE', statusCode: 503 });
    expect(YahooFinanceMarketDataProvider.getHealth()).toMatchObject({ status: 'unavailable', error: 'Market provider returned HTTP 429' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
