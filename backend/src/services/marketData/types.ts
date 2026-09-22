import type { PriceBar } from '../../repositories/priceHistory.repository';

export type MarketFreshness = 'LIVE' | 'DELAYED' | 'LAST CLOSE' | 'STALE' | 'UNAVAILABLE' | 'SYNTHETIC';
export type MarketStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export interface StockQuote {
  symbol: string;
  providerSymbol: string;
  provider: string;
  exchange: string;
  currency: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketTimestamp: string;
  /** Backward-compatible alias; equals marketTimestamp. */
  timestamp: string;
  fetchedAt: string;
  freshnessSeconds: number;
  freshnessLabel: MarketFreshness;
  freshness: MarketFreshness;
  marketStatus: MarketStatus;
  isDelayed: boolean;
  isStale: boolean;
  source: string;
}

export interface StockFundamentalData {
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  revenue: number | null;
  profit: number | null;
  totalDebt: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  source: string;
  retrievedAt: string;
}

export interface MarketHistory {
  symbol: string;
  provider: string;
  currency: string;
  exchange: string;
  interval: string;
  range: string;
  fetchedAt: string;
  adjusted: boolean;
  bars: PriceBar[];
  events: Array<{
    type: 'DIVIDEND' | 'SPLIT';
    date: string;
    amount: number | null;
    ratio: number | null;
    currency: string;
    source: string;
  }>;
}

export interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  lastSuccessfulRequest: string | null;
  latencyMs: number | null;
  sampleQuoteTimestamp: string | null;
  freshness: MarketFreshness | null;
  error?: string;
}
