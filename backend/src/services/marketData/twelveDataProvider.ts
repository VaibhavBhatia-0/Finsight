import { AppError } from '../../middleware/errorHandler';
import type { StockQuote } from './types';

interface TwelveDataQuote {
  symbol?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  volume?: string;
  datetime?: string;
  status?: 'error';
  message?: string;
}

export class TwelveDataMarketDataProvider {
  static configured(): boolean { return process.env.MARKET_DATA_PROVIDER?.toLowerCase() === 'twelve_data' && Boolean(process.env.TWELVE_DATA_API_KEY?.trim()); }

  static async getQuote(symbol: string, exchange?: string): Promise<StockQuote> {
    const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();
    if (!apiKey) throw new AppError('Twelve Data is not configured', 503, 'MARKET_DATA_UNAVAILABLE');

    const url = new URL('https://api.twelvedata.com/quote');
    url.searchParams.set('symbol', symbol.toUpperCase());
    if (exchange) url.searchParams.set('exchange', exchange.toUpperCase());
    url.searchParams.set('apikey', apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new AppError('Market-data provider request failed', 503, 'MARKET_DATA_UNAVAILABLE');
    const value = await response.json() as TwelveDataQuote;
    if (value.status === 'error') throw new AppError(value.message || 'Market-data provider rejected the symbol', 503, 'MARKET_DATA_UNAVAILABLE');

    const price = number(value.close);
    const previousClose = number(value.previous_close);
    if (!Number.isFinite(price) || price <= 0) throw new AppError('Market-data provider returned an invalid quote', 503, 'MARKET_DATA_INVALID');
    return {
      symbol: value.symbol || symbol.toUpperCase(),
      providerSymbol: value.symbol || symbol.toUpperCase(), provider: 'TWELVE_DATA', exchange: exchange || 'UNKNOWN', currency: 'N/A',
      price,
      change: finite(value.change, price - previousClose),
      changePercent: finite(value.percent_change, previousClose > 0 ? (price - previousClose) / previousClose * 100 : 0),
      open: finite(value.open, price),
      high: finite(value.high, price),
      low: finite(value.low, price),
      previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : price,
      volume: Math.max(0, finite(value.volume, 0)),
      fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
      freshness: 'DELAYED', freshnessLabel: 'DELAYED', marketStatus: 'UNKNOWN',
      marketTimestamp: timestamp(value.datetime), timestamp: timestamp(value.datetime), fetchedAt: new Date().toISOString(), freshnessSeconds: 0,
      isDelayed: true, isStale: false,
      source: 'TWELVE_DATA',
    };
  }
}

function number(value?: string): number { return Number(value); }
function finite(value: string | undefined, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function timestamp(value?: string): string { const parsed = value ? new Date(value) : new Date(); return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(); }
