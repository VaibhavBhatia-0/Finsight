import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/middleware/errorHandler';
import { MarketDataService } from '../../src/services/marketData.service';
import { YahooFinanceMarketDataProvider } from '../../src/services/marketData/yahooProvider';

const quote = {
  symbol: 'INDEX', providerSymbol: 'INDEX', provider: 'YAHOO_FINANCE_CHART' as const,
  exchange: 'TEST', currency: 'USD', price: 100, change: 1, changePercent: 1,
  open: 99, high: 101, low: 98, previousClose: 99, volume: 1000,
  fiftyTwoWeekHigh: 110, fiftyTwoWeekLow: 80,
  marketTimestamp: '2026-10-12T10:00:00.000Z', timestamp: '2026-10-12T10:00:00.000Z',
  fetchedAt: '2026-10-12T10:00:01.000Z', freshnessSeconds: 1,
  freshnessLabel: 'LIVE' as const, freshness: 'LIVE' as const, marketStatus: 'OPEN' as const,
  isDelayed: false, isStale: false, source: 'YAHOO_FINANCE_CHART' as const,
};

describe('market overview provider degradation', () => {
  const previousEnvironment = process.env.NODE_ENV;

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  });

  it('returns the successful subset when one upstream index request fails', async () => {
    process.env.NODE_ENV = 'development';
    vi.spyOn(YahooFinanceMarketDataProvider, 'getQuote').mockImplementation(async symbol => {
      if (symbol === '^GSPC') throw new AppError('Market provider returned HTTP 429', 503, 'MARKET_DATA_UNAVAILABLE');
      return { ...quote, symbol, providerSymbol: symbol };
    });
    const result = await MarketDataService.getMarketOverview();
    expect(result.indices).toHaveLength(3);
    expect(result.indices.map(item => item.code)).not.toContain('SP500');
  });

  it('returns an application 503 only when every upstream index request fails', async () => {
    process.env.NODE_ENV = 'development';
    vi.spyOn(YahooFinanceMarketDataProvider, 'getQuote').mockRejectedValue(new AppError('Market provider returned HTTP 429', 503, 'MARKET_DATA_UNAVAILABLE'));
    await expect(MarketDataService.getMarketOverview()).rejects.toMatchObject({ statusCode: 503, code: 'MARKET_DATA_UNAVAILABLE' });
  });
});
