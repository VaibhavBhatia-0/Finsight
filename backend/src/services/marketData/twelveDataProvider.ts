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
    const observedAt = timestamp(value.datetime);
    if (!Number.isFinite(price) || price <= 0) throw new AppError('Market-data provider returned an invalid quote', 503, 'MARKET_DATA_INVALID');
    if (!observedAt) throw new AppError('Market-data provider returned an invalid quote timestamp', 503, 'MARKET_DATA_INVALID');
    const hasPreviousClose = Number.isFinite(previousClose) && previousClose > 0;
    const change = nullableNumber(value.change) ?? (hasPreviousClose ? price - previousClose : null);
    const changePercent = nullableNumber(value.percent_change) ?? (hasPreviousClose ? (price - previousClose) / previousClose * 100 : null);
    return {
      symbol: value.symbol || symbol.toUpperCase(),
      providerSymbol: value.symbol || symbol.toUpperCase(), provider: 'TWELVE_DATA', exchange: exchange || 'UNKNOWN', currency: 'N/A',
      price,
      change,
      changePercent,
      open: nullableNumber(value.open),
      high: nullableNumber(value.high),
      low: nullableNumber(value.low),
      previousClose: hasPreviousClose ? previousClose : null,
      volume: nullableNumber(value.volume),
      fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
      freshness: 'DELAYED', freshnessLabel: 'DELAYED', marketStatus: 'UNKNOWN',
      marketTimestamp: observedAt, timestamp: observedAt, fetchedAt: new Date().toISOString(), freshnessSeconds: 0,
      isDelayed: true, isStale: false,
      source: 'TWELVE_DATA',
    };
  }
}

function number(value?: string): number { return Number(value); }
function nullableNumber(value?: string): number | null { const parsed = Number(value); return value !== undefined && Number.isFinite(parsed) ? parsed : null; }
function timestamp(value?: string): string | null { if (!value) return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); }
