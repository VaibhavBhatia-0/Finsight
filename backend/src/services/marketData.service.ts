import { AppError } from '../middleware/errorHandler';
import { PriceHistoryRepository, type PriceBar } from '../repositories/priceHistory.repository';
import { StockRepository } from '../repositories/stock.repository';
import type { ScreenerFilters } from '../validators/market.validator';
import { MockMarketDataProvider } from './marketData/mockProvider';
import { TwelveDataMarketDataProvider } from './marketData/twelveDataProvider';
import type { MarketHistory, StockFundamentalData, StockQuote } from './marketData/types';
import { YahooFinanceMarketDataProvider } from './marketData/yahooProvider';
import { annualizedVolatility, calculateTechnicalAnalysis, maximumDrawdown } from './technicalAnalysis.service';

export const INDEX_UNIVERSE = [
  { code: 'NIFTY_50', providerSymbol: '^NSEI', name: 'NIFTY 50', country: 'IN', currency: 'INR', exchange: 'NSE' },
  { code: 'SENSEX', providerSymbol: '^BSESN', name: 'BSE SENSEX', country: 'IN', currency: 'INR', exchange: 'BSE' },
  { code: 'SP500', providerSymbol: '^GSPC', name: 'S&P 500', country: 'US', currency: 'USD', exchange: 'NYSE' },
  { code: 'NASDAQ_COMP', providerSymbol: '^IXIC', name: 'NASDAQ Composite', country: 'US', currency: 'USD', exchange: 'NASDAQ' },
] as const;

export class MarketDataService {
  private static useTestFixtures(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  static async getQuote(symbol: string, exchange?: string): Promise<StockQuote> {
    if (this.useTestFixtures()) return MockMarketDataProvider.getQuote(symbol);
    if (process.env.MARKET_DATA_PROVIDER?.toLowerCase() === 'mock') {
      throw new AppError('Mock market data is restricted to tests', 503, 'MARKET_DATA_UNAVAILABLE');
    }
    if (TwelveDataMarketDataProvider.configured()) return TwelveDataMarketDataProvider.getQuote(symbol, exchange);
    return YahooFinanceMarketDataProvider.getQuote(symbol, exchange);
  }

  static async getPriceHistory(stockId: string | number, symbol: string, startDate?: string, endDate?: string, exchange?: string): Promise<PriceBar[]> {
    if (this.useTestFixtures()) {
      const stored = await PriceHistoryRepository.getPrices(stockId, startDate, endDate);
      if (stored.length) return stored;
      return MockMarketDataProvider.generateHistoricalPrices(symbol, 1825)
        .filter(bar => (!startDate || bar.date >= startDate) && (!endDate || bar.date <= endDate));
    }
    if (startDate && endDate) {
      try {
        const history = await YahooFinanceMarketDataProvider.getHistoryBetween(symbol, exchange, startDate, endDate);
        await Promise.all(history.bars.map(bar => PriceHistoryRepository.savePriceBar(stockId, bar, history.provider, history.fetchedAt)));
        return history.bars;
      } catch (error) {
        const cached = await PriceHistoryRepository.getPrices(stockId, startDate, endDate);
        if (cached.length) return cached;
        throw error;
      }
    }
    const cached = await PriceHistoryRepository.getPrices(stockId, startDate, endDate);
    if (cached.length) return cached;
    return (await YahooFinanceMarketDataProvider.getHistory(symbol, exchange, '5y', '1d')).bars;
  }

  static async getExternalPriceHistory(symbol: string, exchange: string | undefined, startDate: string, endDate: string): Promise<PriceBar[]> {
    if (this.useTestFixtures()) {
      return MockMarketDataProvider.generateHistoricalPrices(symbol, 1825)
        .filter(bar => bar.date >= startDate && bar.date <= endDate);
    }
    return (await YahooFinanceMarketDataProvider.getHistoryBetween(symbol, exchange, startDate, endDate)).bars;
  }

  static async getChart(symbol: string, exchange: string | undefined, range: string, interval: string): Promise<MarketHistory> {
    if (this.useTestFixtures()) {
      return {
        symbol, provider: 'FINSIGHT_TEST_FIXTURE', currency: exchange === 'NSE' ? 'INR' : 'USD', exchange: exchange || 'UNKNOWN',
        range, interval, fetchedAt: new Date().toISOString(), adjusted: true,
        bars: MockMarketDataProvider.generateHistoricalPrices(symbol, range === '1d' ? 3 : 365), events: [],
      };
    }
    return YahooFinanceMarketDataProvider.getHistory(symbol, exchange, range, interval);
  }

  static async getProviderCorporateActions(symbol: string, exchange?: string): Promise<MarketHistory['events']> {
    if (this.useTestFixtures()) return [];
    try {
      return (await YahooFinanceMarketDataProvider.getHistory(symbol, exchange, 'max', '1wk')).events;
    } catch {
      return [];
    }
  }

  static async getProviderCorporateActionsBetween(symbol: string, exchange: string | undefined, startDate: string, endDate: string): Promise<MarketHistory['events']> {
    if (this.useTestFixtures()) return [];
    try {
      return (await YahooFinanceMarketDataProvider.getHistoryBetween(symbol, exchange, startDate, endDate)).events;
    } catch {
      return [];
    }
  }

  static async getStockFundamentals(symbol: string, stockId?: string | number, quote?: StockQuote): Promise<StockFundamentalData> {
    if (this.useTestFixtures()) return MockMarketDataProvider.getFundamentals(symbol);
    const stored = stockId ? await StockRepository.getFundamentals(stockId) : null;
    const resolvedQuote = quote || await this.getQuote(symbol);
    return {
      marketCap: numberOrNull(stored?.market_cap), peRatio: numberOrNull(stored?.pe_ratio), eps: numberOrNull(stored?.eps),
      dividendYield: numberOrNull(stored?.dividend_yield), revenue: numberOrNull(stored?.revenue),
      profit: numberOrNull(stored?.net_income), totalDebt: numberOrNull(stored?.total_debt),
      fiftyTwoWeekHigh: resolvedQuote.fiftyTwoWeekHigh, fiftyTwoWeekLow: resolvedQuote.fiftyTwoWeekLow,
      rsi14: null, sma50: null, sma200: null,
      source: stored?.source || resolvedQuote.source, retrievedAt: stored?.source_timestamp || resolvedQuote.fetchedAt,
    };
  }

  static async getSecurityQuote(stockId: string | number) {
    const stock = await StockRepository.findById(stockId);
    if (!stock || !stock.is_active) throw new AppError('Security not found', 404, 'SECURITY_NOT_FOUND');
    return { security: securityIdentity(stock), quote: await this.getQuote(stock.symbol, stock.exchange_code) };
  }

  static async getHistoricalPrice(stockId: string | number, requestedDate: string) {
    const stock = await StockRepository.findById(stockId);
    if (!stock || !stock.is_active) throw new AppError('Security not found', 404, 'SECURITY_NOT_FOUND');
    const date = new Date(`${requestedDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) throw new AppError('Invalid historical date', 400, 'INVALID_DATE');
    const start = new Date(date);
    start.setUTCDate(start.getUTCDate() - 10);
    const bars = await this.getPriceHistory(stock.id, stock.symbol, start.toISOString().slice(0, 10), requestedDate, stock.exchange_code);
    const observation = [...bars].filter(row => row.date.slice(0, 10) <= requestedDate).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!observation) throw new AppError('No historical market price is available on or before this date', 404, 'HISTORICAL_PRICE_UNAVAILABLE');
    return {
      security: securityIdentity(stock), requestedDate, priceDate: observation.date.slice(0, 10),
      price: Number(observation.adjusted_close ?? observation.close), currency: stock.currency,
      source: this.useTestFixtures() ? 'FINSIGHT_TEST_FIXTURE' : 'YAHOO_FINANCE_CHART',
      methodology: 'Latest adjusted close on or before the requested transaction date within the preceding ten calendar days.',
    };
  }

  static async getTechnicalAnalysis(stockId: string | number, period: keyof typeof TECHNICAL_PERIODS) {
    const stock = await StockRepository.findById(stockId);
    if (!stock || !stock.is_active) throw new AppError('Security not found', 404, 'SECURITY_NOT_FOUND');
    const config = TECHNICAL_PERIODS[period];
    const history = await this.getChart(stock.symbol, stock.exchange_code, config.range, config.interval);
    return { security: securityIdentity(stock), period, provider: history.provider, fetchedAt: history.fetchedAt, ...calculateTechnicalAnalysis(history.bars) };
  }

  static async compareSecurities(securityIds: Array<string | number>) {
    const securities = await Promise.all(securityIds.map(id => StockRepository.findById(id)));
    if (securities.some(stock => !stock || !stock.is_active)) throw new AppError('One or more securities were not found', 404, 'SECURITY_NOT_FOUND');
    const rows = await Promise.all(securities.map(async stock => {
      const [quoteResult, dailyResult, maxResult] = await Promise.allSettled([
        this.getQuote(stock.symbol, stock.exchange_code),
        this.getChart(stock.symbol, stock.exchange_code, '5y', '1d'),
        this.getChart(stock.symbol, stock.exchange_code, 'max', '1wk'),
      ]);
      const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
      const daily = dailyResult.status === 'fulfilled' ? dailyResult.value : null;
      const maximum = maxResult.status === 'fulfilled' ? maxResult.value : null;
      const fundamentals = quote ? await this.getStockFundamentals(stock.symbol, stock.id, quote) : emptyFundamentals();
      const dailyBars = daily?.bars ?? [];
      const maxBars = maximum?.bars ?? dailyBars;
      const closes = dailyBars.map(item => Number(item.adjusted_close ?? item.close));
      const technicals = calculateTechnicalAnalysis(dailyBars);
      return {
        security: { ...securityIdentity(stock), sector: stock.sector ?? null }, quote, fundamentals,
        performance: {
          '1D': quote?.changePercent ?? null,
          '5D': periodReturn(dailyBars, 7),
          '1M': periodReturn(dailyBars, 31),
          YTD: yearToDateReturn(dailyBars),
          '1Y': periodReturn(dailyBars, 366),
          '5Y': seriesReturn(dailyBars),
          MAX: seriesReturn(maxBars),
        },
        risk: { volatility: annualizedVolatility(closes), maxDrawdown: maximumDrawdown(closes) },
        technicals: technicals.summary,
        normalizedSeries: normalizeBars(dailyBars.filter(item => item.date >= cutoffDate(366))),
        availability: { quote: quote ? 'AVAILABLE' : 'UNAVAILABLE', fundamentals: fundamentals.source === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE', history: daily ? 'AVAILABLE' : 'UNAVAILABLE' },
      };
    }));
    const commonDates = intersectDates(rows.map(row => row.normalizedSeries.map(point => point.date)));
    return {
      securities: rows.map(row => ({ ...row, normalizedSeries: rebaseSeries(row.normalizedSeries.filter(point => commonDates.has(point.date))) })),
      methodology: 'Performance is calculated from adjusted provider closes. The normalized chart is rebased to 100 over dates common to every selected security. Missing provider data remains unavailable.',
    };
  }

  static async getMarketOverview() {
    const settled = await Promise.allSettled(INDEX_UNIVERSE.map(async index => {
      const quote = this.useTestFixtures()
        ? MockMarketDataProvider.getQuote(index.code)
        : await YahooFinanceMarketDataProvider.getQuote(index.providerSymbol, index.exchange);
      return { ...index, ...quote };
    }));
    const indices = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (!indices.length) throw new AppError('Market overview is unavailable', 503, 'MARKET_DATA_UNAVAILABLE');
    return { indices, india: indices.filter(item => item.country === 'IN'), us: indices.filter(item => item.country === 'US') };
  }

  static getHealth() {
    if (this.useTestFixtures()) {
      const now = new Date().toISOString();
      return { provider: 'FINSIGHT_TEST_FIXTURE', status: 'healthy', lastSuccessfulRequest: now, latencyMs: 0, sampleQuoteTimestamp: now, freshness: 'SYNTHETIC' };
    }
    return YahooFinanceMarketDataProvider.getHealth();
  }

  static async screenStocks(filters: ScreenerFilters) {
    const list = this.useTestFixtures() ? await StockRepository.list({
      exchange: filters.exchange, country: filters.country, sector: filters.sector,
      page: filters.page, limit: filters.limit,
      sortBy: filters.sortBy === 'name' ? 'company' : 'symbol', sortOrder: filters.sortOrder,
    }) : await StockRepository.screen(filters);
    const rows = await Promise.all(list.items.map(async stock => {
      const base = {
        id: stock.id, symbol: stock.symbol, name: stock.company_name, exchange: stock.exchange,
        exchangeCode: (stock as any).exchange_code, countryCode: (stock as any).country_code,
        currency: stock.currency, sector: stock.sector,
      };
      try {
        const quote = await this.getQuote(stock.symbol, (stock as any).exchange_code);
        const fund = await this.getStockFundamentals(stock.symbol, stock.id, quote);
        return {
          ...base, price: quote.price, changePercent: quote.changePercent, volume: quote.volume,
          marketCap: fund.marketCap, peRatio: fund.peRatio, eps: fund.eps,
          dividendYield: fund.dividendYield, revenue: fund.revenue, profit: fund.profit, debt: fund.totalDebt,
          rsi14: fund.rsi14, sma50: fund.sma50, sma200: fund.sma200,
          fiftyTwoWeekHigh: fund.fiftyTwoWeekHigh, fiftyTwoWeekLow: fund.fiftyTwoWeekLow,
          yearPosition: yearPosition(quote.price, fund.fiftyTwoWeekLow, fund.fiftyTwoWeekHigh),
          volatility: numberOrNull((stock as any).annualized_volatility), quote,
        };
      } catch {
        return {
          ...base, price: numberOrNull((stock as any).screened_price), changePercent: null,
          volume: numberOrNull((stock as any).screened_volume), marketCap: numberOrNull((stock as any).market_cap),
          peRatio: numberOrNull((stock as any).pe_ratio), eps: numberOrNull((stock as any).eps),
          dividendYield: numberOrNull((stock as any).dividend_yield), revenue: numberOrNull((stock as any).revenue),
          profit: numberOrNull((stock as any).net_income), debt: numberOrNull((stock as any).total_debt),
          rsi14: null, sma50: null, sma200: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
          yearPosition: null, volatility: numberOrNull((stock as any).annualized_volatility), quote: null,
        };
      }
    }));
    const items = this.useTestFixtures() ? sortVisibleRows(rows.filter(item => matchesAvailableFilters(item, filters)), filters) : rows;
    const testTotal = this.useTestFixtures() ? items.length : list.total;
    return { items, pagination: { page: list.page, limit: list.limit, total: testTotal, totalPages: this.useTestFixtures() ? Math.max(1, Math.ceil(testTotal / list.limit)) : list.totalPages }, sortScope: 'SERVER_RESULT_SET', unavailableMetricsExcluded: true };
  }
}

const TECHNICAL_PERIODS = {
  '1D': { range: '1d', interval: '5m' }, '5D': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' }, '6M': { range: '6mo', interval: '1d' },
  YTD: { range: 'ytd', interval: '1d' }, '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1d' }, MAX: { range: 'max', interval: '1wk' },
} as const;

function securityIdentity(stock: any) {
  return { id: stock.id, symbol: stock.symbol, displaySymbol: stock.display_symbol, providerSymbol: stock.provider_symbol, name: stock.company_name, exchange: stock.exchange_code, country: stock.country_code, currency: stock.currency, assetType: stock.asset_type };
}
function rebaseSeries(series: Array<{ date: string; value: number }>) {
  const base = series[0]?.value;
  return !base ? [] : series.map(point => ({ date: point.date, value: Math.round(point.value / base * 100 * 1e6) / 1e6 }));
}
function emptyFundamentals(): StockFundamentalData {
  return { marketCap: null, peRatio: null, eps: null, dividendYield: null, revenue: null, profit: null, totalDebt: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, rsi14: null, sma50: null, sma200: null, source: 'UNAVAILABLE', retrievedAt: new Date().toISOString() };
}
function cutoffDate(days: number): string { const date = new Date(); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10); }
function seriesReturn(bars: PriceBar[]): number | null {
  if (bars.length < 2) return null;
  const first = Number(bars[0].adjusted_close ?? bars[0].close);
  const last = Number(bars[bars.length - 1].adjusted_close ?? bars[bars.length - 1].close);
  return first > 0 ? Math.round((last / first - 1) * 100_000_000) / 1_000_000 : null;
}
function periodReturn(bars: PriceBar[], days: number): number | null {
  if (!bars.length) return null;
  const cutoff = new Date(`${bars[bars.length - 1].date.slice(0, 10)}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const subset = bars.filter(row => row.date.slice(0, 10) >= cutoff.toISOString().slice(0, 10));
  return seriesReturn(subset);
}
function yearToDateReturn(bars: PriceBar[]): number | null {
  if (!bars.length) return null;
  const year = bars[bars.length - 1].date.slice(0, 4);
  return seriesReturn(bars.filter(row => row.date.startsWith(year)));
}
function normalizeBars(bars: PriceBar[]) {
  if (!bars.length) return [];
  const first = Number(bars[0].adjusted_close ?? bars[0].close);
  if (!(first > 0)) return [];
  return bars.map(row => ({ date: row.date.slice(0, 10), value: Math.round(Number(row.adjusted_close ?? row.close) / first * 100_000_000) / 1_000_000 }));
}
function intersectDates(collections: string[][]): Set<string> {
  if (!collections.length) return new Set();
  return collections.slice(1).reduce((current, rows) => new Set([...current].filter(date => rows.includes(date))), new Set(collections[0]));
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return value == null || !Number.isFinite(parsed) ? null : parsed;
}
function yearPosition(price: number, low: number | null, high: number | null): number | null {
  return low == null || high == null || high <= low ? null : Math.round((price - low) / (high - low) * 10000) / 100;
}
function matchesAvailableFilters(stock: Record<string, any>, filters: ScreenerFilters): boolean {
  const checks: Array<[unknown, number | undefined, (a: number, b: number) => boolean]> = [
    [stock.price, filters.minPrice, (a,b) => a >= b], [stock.price, filters.maxPrice, (a,b) => a <= b],
    [stock.peRatio, filters.minPe, (a,b) => a >= b], [stock.peRatio, filters.maxPe, (a,b) => a <= b],
    [stock.eps, filters.minEps, (a,b) => a >= b], [stock.eps, filters.maxEps, (a,b) => a <= b],
    [stock.dividendYield, filters.minDivYield, (a,b) => a >= b], [stock.dividendYield, filters.maxDivYield, (a,b) => a <= b],
    [stock.marketCap, filters.minMarketCap, (a,b) => a >= b], [stock.marketCap, filters.maxMarketCap, (a,b) => a <= b],
    [stock.revenue, filters.minRevenue, (a,b) => a >= b], [stock.revenue, filters.maxRevenue, (a,b) => a <= b],
    [stock.profit, filters.minProfit, (a,b) => a >= b], [stock.profit, filters.maxProfit, (a,b) => a <= b],
    [stock.debt, filters.minDebt, (a,b) => a >= b], [stock.debt, filters.maxDebt, (a,b) => a <= b],
    [stock.volume, filters.minVolume, (a,b) => a >= b], [stock.volume, filters.maxVolume, (a,b) => a <= b],
    [stock.volatility, filters.maxVolatility, (a,b) => a <= b],
    [stock.rsi14, filters.minRsi, (a,b) => a >= b], [stock.rsi14, filters.maxRsi, (a,b) => a <= b],
    [stock.yearPosition, filters.minYearPosition, (a,b) => a >= b], [stock.yearPosition, filters.maxYearPosition, (a,b) => a <= b],
  ];
  if (!checks.every(([value, threshold, predicate]) => threshold === undefined || (typeof value === 'number' && predicate(value, threshold)))) return false;
  const relation = filters.movingAverageRelation;
  if (!relation) return true;
  const price = stock.price as number;
  const sma50 = stock.sma50 as number | null;
  const sma200 = stock.sma200 as number | null;
  if (relation === 'ABOVE_50') return sma50 !== null && price > sma50;
  if (relation === 'BELOW_50') return sma50 !== null && price < sma50;
  if (relation === 'ABOVE_200') return sma200 !== null && price > sma200;
  if (relation === 'BELOW_200') return sma200 !== null && price < sma200;
  if (relation === 'GOLDEN_CROSS') return sma50 !== null && sma200 !== null && sma50 > sma200;
  return sma50 !== null && sma200 !== null && sma50 < sma200;
}

function sortVisibleRows<T extends Record<string, any>>(rows: T[], filters: ScreenerFilters): T[] {
  if (filters.sortBy === 'symbol' || filters.sortBy === 'name') return rows;
  const field = ({ marketCap: 'marketCap', peRatio: 'peRatio', eps: 'eps', dividendYield: 'dividendYield', revenue: 'revenue', profit: 'profit', debt: 'debt', volume: 'volume', volatility: 'volatility', rsi14: 'rsi14', yearPosition: 'yearPosition', price: 'price' } as const)[filters.sortBy];
  const direction = filters.sortOrder === 'asc' ? 1 : -1;
  return rows.slice().sort((left, right) => {
    const a = typeof left[field] === 'number' ? left[field] : null;
    const b = typeof right[field] === 'number' ? right[field] : null;
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    return (a - b) * direction;
  });
}
