import { AppError } from '../../middleware/errorHandler';
import type { PriceBar } from '../../repositories/priceHistory.repository';
import type { MarketFreshness, MarketHistory, MarketStatus, ProviderHealth, StockQuote } from './types';

type CacheEntry<T> = { value: T; expiresAt: number };

interface YahooMeta {
  symbol?: string;
  currency?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketTime?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  exchangeDataDelayedBy?: number;
  currentTradingPeriod?: { regular?: { start?: number; end?: number } };
}

interface YahooChartResult {
  meta: YahooMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }>;
    adjclose?: Array<{ adjclose?: Array<number | null> }>;
  };
  events?: {
    dividends?: Record<string, { amount?: number; date?: number }>;
    splits?: Record<string, { date?: number; numerator?: number; denominator?: number; splitRatio?: string }>;
  };
}

interface YahooChartResponse { chart?: { result?: YahooChartResult[] | null; error?: { code?: string; description?: string } | null } }

const quoteCache = new Map<string, CacheEntry<StockQuote>>();
const historyCache = new Map<string, CacheEntry<MarketHistory>>();
const pending = new Map<string, Promise<unknown>>();
const QUOTE_TTL_MS = 30_000;
const INTRADAY_TTL_MS = 60_000;
const HISTORICAL_TTL_MS = 6 * 60 * 60 * 1000;

let health: ProviderHealth = {
  provider: 'YAHOO_FINANCE_CHART', status: 'unavailable', lastSuccessfulRequest: null,
  latencyMs: null, sampleQuoteTimestamp: null, freshness: null,
};

export class YahooFinanceMarketDataProvider {
  static providerSymbol(symbol: string, exchange?: string): string {
    const normalized = symbol.trim().toUpperCase();
    if (normalized.startsWith('^') || normalized.includes('.') || normalized.includes('=')) return normalized;
    if (exchange?.toUpperCase() === 'NSE') return `${normalized}.NS`;
    if (exchange?.toUpperCase() === 'BSE') return `${normalized}.BO`;
    return normalized;
  }

  static async getQuote(symbol: string, exchange?: string): Promise<StockQuote> {
    const providerSymbol = this.providerSymbol(symbol, exchange);
    const key = `quote:${providerSymbol}`;
    const cached = quoteCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      return await deduplicate(key, async () => {
        const started = Date.now();
        const result = await requestChart(providerSymbol, { range: '5d', interval: '5m' });
        const fetchedAt = new Date();
        const quote = mapQuote(symbol, providerSymbol, result, fetchedAt);
        quoteCache.set(key, { value: quote, expiresAt: fetchedAt.getTime() + QUOTE_TTL_MS });
        health = {
          provider: quote.provider, status: quote.isStale ? 'degraded' : 'healthy',
          lastSuccessfulRequest: quote.fetchedAt, latencyMs: Date.now() - started,
          sampleQuoteTimestamp: quote.marketTimestamp, freshness: quote.freshnessLabel,
        };
        return quote;
      });
    } catch (error) {
      if (cached) {
        const fallback = staleQuote(cached.value);
        health = { ...health, status: 'degraded', error: safeMessage(error) };
        return fallback;
      }
      health = { ...health, status: 'unavailable', error: safeMessage(error) };
      throw providerError(error);
    }
  }

  static async getHistory(symbol: string, exchange: string | undefined, range: string, interval: string): Promise<MarketHistory> {
    const providerSymbol = this.providerSymbol(symbol, exchange);
    const key = `history:${providerSymbol}:${range}:${interval}`;
    const cached = historyCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    return deduplicate(key, async () => {
      const result = await requestChart(providerSymbol, { range, interval, events: 'div,splits' });
      const value = mapHistory(providerSymbol, range, interval, result);
      const ttl = interval.endsWith('m') || interval.endsWith('h') ? INTRADAY_TTL_MS : HISTORICAL_TTL_MS;
      historyCache.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    });
  }

  static async getHistoryBetween(symbol: string, exchange: string | undefined, startDate: string, endDate: string): Promise<MarketHistory> {
    const start = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
    const end = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new AppError('Invalid historical date range', 400, 'INVALID_DATE_RANGE');
    const providerSymbol = this.providerSymbol(symbol, exchange);
    const key = `history:${providerSymbol}:${start}:${end}:1d`;
    const cached = historyCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    return deduplicate(key, async () => {
      const result = await requestChart(providerSymbol, { period1: String(start), period2: String(end), interval: '1d', events: 'div,splits' });
      const value = mapHistory(providerSymbol, `${startDate}:${endDate}`, '1d', result);
      historyCache.set(key, { value, expiresAt: Date.now() + HISTORICAL_TTL_MS });
      return value;
    });
  }

  static getHealth(): ProviderHealth { return { ...health }; }
}

async function requestChart(symbol: string, params: Record<string, string>): Promise<YahooChartResult> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('includePrePost', 'false');
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'FinSight/1.0 personal-research-workspace' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new AppError(`Market provider returned HTTP ${response.status}`, 503, 'MARKET_DATA_UNAVAILABLE');
  const payload = await response.json() as YahooChartResponse;
  const providerFailure = payload.chart?.error;
  const result = payload.chart?.result?.[0];
  if (providerFailure || !result?.meta) throw new AppError(providerFailure?.description || 'No market data is available for this symbol', 503, 'MARKET_DATA_UNAVAILABLE');
  return result;
}

function mapQuote(symbol: string, providerSymbol: string, result: YahooChartResult, fetchedAt: Date): StockQuote {
  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const timestamps = result.timestamp ?? [];
  let latestIndex = -1;
  for (let index = closes.length - 1; index >= 0; index -= 1) if (finite(closes[index])) { latestIndex = index; break; }
  const price = firstFinite(meta.regularMarketPrice, latestIndex >= 0 ? closes[latestIndex] : null);
  const previousClose = firstFinite(meta.chartPreviousClose, meta.previousClose);
  const marketEpoch = firstFinite(meta.regularMarketTime, latestIndex >= 0 ? timestamps[latestIndex] : null);
  if (!finite(price) || price! <= 0 || !finite(marketEpoch)) throw new AppError('Market provider returned an incomplete quote', 503, 'MARKET_DATA_INVALID');
  const marketTimestamp = new Date(marketEpoch! * 1000);
  const status = marketStatus(meta, fetchedAt);
  const providerDelaySeconds = Math.max(0, Math.round(firstFinite(meta.exchangeDataDelayedBy, defaultDelayMinutes(meta.exchangeName))! * 60));
  const freshnessSeconds = Math.max(0, Math.floor((fetchedAt.getTime() - marketTimestamp.getTime()) / 1000));
  const freshnessLabel = classifyFreshness(status, freshnessSeconds, providerDelaySeconds);
  const change = finite(previousClose) && previousClose! > 0 ? price! - previousClose! : 0;
  return {
    symbol: symbol.toUpperCase(), providerSymbol, provider: 'YAHOO_FINANCE_CHART',
    exchange: meta.fullExchangeName || meta.exchangeName || 'UNKNOWN', currency: meta.currency || 'N/A',
    price: price!, change: round(change), changePercent: previousClose! > 0 ? round(change / previousClose! * 100) : 0,
    open: nullable(meta.regularMarketOpen), high: nullable(meta.regularMarketDayHigh), low: nullable(meta.regularMarketDayLow),
    previousClose: nullable(previousClose), volume: nullable(meta.regularMarketVolume),
    fiftyTwoWeekHigh: nullable(meta.fiftyTwoWeekHigh), fiftyTwoWeekLow: nullable(meta.fiftyTwoWeekLow),
    marketTimestamp: marketTimestamp.toISOString(), timestamp: marketTimestamp.toISOString(), fetchedAt: fetchedAt.toISOString(), freshnessSeconds,
    freshnessLabel, freshness: freshnessLabel, marketStatus: status,
    isDelayed: providerDelaySeconds > 0 || freshnessLabel === 'DELAYED', isStale: freshnessLabel === 'STALE',
    source: 'YAHOO_FINANCE_CHART',
  };
}

function mapHistory(providerSymbol: string, range: string, interval: string, result: YahooChartResult): MarketHistory {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  if (!quote || !timestamps.length) throw new AppError('Market provider returned no historical observations', 503, 'MARKET_DATA_UNAVAILABLE');
  const bars: PriceBar[] = [];
  timestamps.forEach((timestamp, index) => {
    const close = quote.close?.[index];
    if (!finite(close) || close! <= 0) return;
    bars.push({
      date: interval === '1d' || interval.endsWith('wk') || interval.endsWith('mo')
        ? new Date(timestamp * 1000).toISOString().slice(0, 10)
        : new Date(timestamp * 1000).toISOString(),
      open: finite(quote.open?.[index]) ? quote.open![index]! : close!,
      high: finite(quote.high?.[index]) ? quote.high![index]! : close!,
      low: finite(quote.low?.[index]) ? quote.low![index]! : close!,
      close: close!, adjusted_close: finite(adjusted[index]) ? adjusted[index]! : close!,
      volume: finite(quote.volume?.[index]) ? Math.max(0, quote.volume![index]!) : 0,
    });
  });
  if (!bars.length) throw new AppError('Market provider returned no usable historical observations', 503, 'MARKET_DATA_UNAVAILABLE');
  return {
    symbol: providerSymbol, provider: 'YAHOO_FINANCE_CHART', currency: result.meta.currency || 'N/A',
    exchange: result.meta.fullExchangeName || result.meta.exchangeName || 'UNKNOWN', interval, range,
    fetchedAt: new Date().toISOString(), adjusted: true, bars,
    events: mapEvents(result),
  };
}

function mapEvents(result: YahooChartResult): MarketHistory['events'] {
  const currency = result.meta.currency || 'N/A';
  const dividends = Object.values(result.events?.dividends || {}).flatMap(event => {
    if (!finite(event.amount) || !finite(event.date) || event.amount! < 0) return [];
    return [{ type: 'DIVIDEND' as const, date: new Date(event.date! * 1000).toISOString().slice(0, 10), amount: event.amount!, ratio: null, currency, source: 'YAHOO_FINANCE_CHART' }];
  });
  const splits = Object.values(result.events?.splits || {}).flatMap(event => {
    if (!finite(event.date)) return [];
    const ratio = finite(event.numerator) && finite(event.denominator) && event.denominator! > 0
      ? event.numerator! / event.denominator!
      : splitRatio(event.splitRatio);
    if (!finite(ratio) || ratio! <= 0) return [];
    return [{ type: 'SPLIT' as const, date: new Date(event.date! * 1000).toISOString().slice(0, 10), amount: null, ratio: ratio!, currency, source: 'YAHOO_FINANCE_CHART' }];
  });
  return [...dividends, ...splits].sort((left, right) => left.date.localeCompare(right.date));
}

function splitRatio(value?: string): number | null {
  if (!value) return null;
  const [numerator, denominator] = value.split(':').map(Number);
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0 ? numerator / denominator : null;
}

function marketStatus(meta: YahooMeta, now: Date): MarketStatus {
  const regular = meta.currentTradingPeriod?.regular;
  if (!finite(regular?.start) || !finite(regular?.end)) return 'UNKNOWN';
  const epoch = Math.floor(now.getTime() / 1000);
  return epoch >= regular!.start! && epoch <= regular!.end! ? 'OPEN' : 'CLOSED';
}

function classifyFreshness(status: MarketStatus, ageSeconds: number, delaySeconds: number): MarketFreshness {
  if (status === 'OPEN') {
    if (ageSeconds <= delaySeconds + 180) return delaySeconds > 0 ? 'DELAYED' : 'LIVE';
    return 'STALE';
  }
  if (ageSeconds <= 7 * 24 * 60 * 60) return 'LAST CLOSE';
  return 'STALE';
}

function defaultDelayMinutes(exchange?: string): number {
  return ['BSE', 'BOM'].includes((exchange || '').toUpperCase()) ? 15 : 0;
}

function staleQuote(value: StockQuote): StockQuote {
  const fetchedAt = new Date().toISOString();
  return { ...value, fetchedAt, freshnessSeconds: Math.max(0, Math.floor((Date.now() - new Date(value.marketTimestamp).getTime()) / 1000)), freshness: 'STALE', freshnessLabel: 'STALE', isStale: true };
}

async function deduplicate<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = operation().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

function providerError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('Market-data provider is unavailable', 503, 'MARKET_DATA_UNAVAILABLE');
}
function safeMessage(error: unknown): string { return error instanceof Error ? error.message : 'Provider request failed'; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function nullable(value: unknown): number | null { return finite(value) ? value : null; }
function firstFinite(...values: unknown[]): number | null { return (values.find(finite) as number | undefined) ?? null; }
function round(value: number): number { return Math.round(value * 1e6) / 1e6; }
