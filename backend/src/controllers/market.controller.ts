import { Request, Response, NextFunction } from 'express';
import { MarketDataService } from '../services/marketData.service';
import { FXService } from '../services/fx.service';
import { StockRepository } from '../repositories/stock.repository';
import { sendSuccess, sendError } from '../utils/response';
import type { ScreenerFilters } from '../validators/market.validator';
import type { MarketFreshness } from '../services/marketData/types';

const PERIODS: Record<string, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '5D': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1h' },
  '6M': { range: '6mo', interval: '1d' },
  'YTD': { range: 'ytd', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1d' },
  'MAX': { range: 'max', interval: '1wk' },
};

export class MarketController {
  static async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await MarketDataService.getMarketOverview();
      const freshness = aggregateFreshness(overview.indices.map(item => item.freshnessLabel));
      sendSuccess(res, overview, 200, freshness, { source: 'YAHOO_FINANCE_CHART', degraded: freshness === 'STALE' });
    } catch (error) { next(error); }
  }

  static async getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = MarketDataService.getHealth();
      sendSuccess(res, health, health.status === 'unavailable' ? 503 : 200, (health.freshness || 'UNAVAILABLE') as MarketFreshness);
    } catch (error) { next(error); }
  }

  static async getStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as Record<string, string>;
      const list = await StockRepository.list({
        q: query.q, exchange: query.exchange, country: query.country, sector: query.sector,
        page: Number(query.page), limit: Number(query.limit), sortBy: query.sortBy as 'symbol' | 'company', sortOrder: query.sortOrder as 'asc' | 'desc',
      });
      const settled = await Promise.allSettled(list.items.map(async stock => ({
        ...stock,
        quote: await MarketDataService.getQuote(stock.symbol, (stock as any).exchange_code),
      })));
      const items = settled.map((result, index) => result.status === 'fulfilled'
        ? result.value
        : { ...list.items[index], quote: null, quoteError: 'UNAVAILABLE' });
      const quotes = items.flatMap(item => item.quote ? [item.quote] : []);
      const freshness = quotes.length ? aggregateFreshness(quotes.map(quote => quote.freshnessLabel)) : 'UNAVAILABLE';
      sendSuccess(res, { items, pagination: { page: list.page, limit: list.limit, total: list.total, totalPages: list.totalPages } }, 200, freshness, {
        source: 'YAHOO_FINANCE_CHART', degraded: items.some(item => !item.quote || item.quote.isStale),
      });
    } catch (error) { next(error); }
  }

  static async searchSecurities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { sendSuccess(res, await StockRepository.searchSecurities(req.query as unknown as { q: string; page: number; pageSize: number }), 200, 'Reference'); }
    catch (error) { next(error); }
  }

  static async getUniverseStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { sendSuccess(res, await StockRepository.universeStats(), 200, 'Reference'); }
    catch (error) { next(error); }
  }

  static async getSecurityQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const value = await MarketDataService.getSecurityQuote(req.params.id);
      sendSuccess(res, value, 200, value.quote.freshnessLabel, { source: value.quote.source, marketTimestamp: value.quote.marketTimestamp, fetchedAt: value.quote.fetchedAt, degraded: value.quote.isStale });
    } catch (error) { next(error); }
  }

  static async getHistoricalPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { sendSuccess(res, await MarketDataService.getHistoricalPrice(req.params.id, String(req.query.date)), 200, 'Historical'); }
    catch (error) { next(error); }
  }

  static async getTechnicals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { sendSuccess(res, await MarketDataService.getTechnicalAnalysis(req.params.id, String(req.query.period || '1Y') as any), 200, 'Historical'); }
    catch (error) { next(error); }
  }

  static async compareSecurities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { sendSuccess(res, await MarketDataService.compareSecurities(req.body.securityIds), 200, 'Historical'); }
    catch (error) { next(error); }
  }

  static async getStockDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const stock = /^\d+$/.test(id) ? await StockRepository.findById(id) : await StockRepository.findBySymbol(id);
      if (!stock) { sendError(res, 404, 'STOCK_NOT_FOUND', `Stock with ID ${id} not found`); return; }
      const quote = await MarketDataService.getQuote(stock.symbol, stock.exchange_code);
      const fundamentals = await MarketDataService.getStockFundamentals(stock.symbol, stock.id, quote);
      const [storedDividends, storedActions, providerEvents] = await Promise.all([
        StockRepository.getDividends(stock.id), StockRepository.getCorporateActions(stock.id),
        MarketDataService.getProviderCorporateActions(stock.symbol, stock.exchange_code),
      ]);
      const dividends = dedupeBy([
        ...storedDividends,
        ...providerEvents.filter(event => event.type === 'DIVIDEND').map((event, index) => ({ id: `provider-dividend-${index}`, stock_id: stock.id, ex_date: event.date, payment_date: null, amount: event.amount, currency: event.currency, source: event.source })),
      ], row => `${isoDate(row.ex_date)}:${Number(row.amount).toFixed(8)}`)
        .map(row => ({ ...row, ex_date: isoDate(row.ex_date), source: row.source || 'DATABASE' }))
        .sort((left, right) => left.ex_date.localeCompare(right.ex_date));
      const corporateActions = dedupeBy([
        ...storedActions,
        ...providerEvents.filter(event => event.type === 'SPLIT').map((event, index) => ({ id: `provider-split-${index}`, stock_id: stock.id, action_type: 'SPLIT', action_date: event.date, ratio: event.ratio, description: `Provider-reported split (${event.ratio}:1)`, source: event.source })),
      ], row => `${isoDate(row.action_date)}:${row.action_type}:${Number(row.ratio).toFixed(8)}`)
        .map(row => ({ ...row, action_date: isoDate(row.action_date), source: row.source || 'DATABASE' }))
        .sort((left, right) => left.action_date.localeCompare(right.action_date));
      sendSuccess(res, { stock, quote, fundamentals, dividends, corporateActions, eventAvailability: { dividends: 'AVAILABLE_WHEN_REPORTED', splits: 'AVAILABLE_WHEN_REPORTED', earnings: 'UNAVAILABLE_FROM_CURRENT_PROVIDER' } }, 200, quote.freshnessLabel, {
        source: quote.source, marketTimestamp: quote.marketTimestamp, fetchedAt: quote.fetchedAt, degraded: quote.isStale,
      });
    } catch (error) { next(error); }
  }

  static async getStockPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stock = await StockRepository.findById(req.params.id);
      if (!stock) { sendError(res, 404, 'STOCK_NOT_FOUND', `Stock with ID ${req.params.id} not found`); return; }
      const period = String(req.query.period || '').toUpperCase();
      if (period) {
        const config = PERIODS[period];
        if (!config) { sendError(res, 400, 'INVALID_PERIOD', 'Period must be one of 1D, 5D, 1M, 6M, YTD, 1Y, 5Y, MAX'); return; }
        const history = await MarketDataService.getChart(stock.symbol, stock.exchange_code, config.range, config.interval);
        sendSuccess(res, history, 200, 'Historical', { source: history.provider, fetchedAt: history.fetchedAt });
        return;
      }
      const prices = await MarketDataService.getPriceHistory(stock.id, stock.symbol, req.query.startDate as string, req.query.endDate as string, stock.exchange_code);
      sendSuccess(res, { bars: prices, provider: process.env.NODE_ENV === 'test' ? 'FINSIGHT_TEST_FIXTURE' : 'YAHOO_FINANCE_CHART', interval: '1d', range: 'custom', adjusted: true, events: [] }, 200, 'Historical');
    } catch (error) { next(error); }
  }

  static async screenStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await MarketDataService.screenStocks(req.query as unknown as ScreenerFilters);
      const quoted = results.items.flatMap(item => item.quote ? [item.quote.freshnessLabel] : []);
      const freshness = quoted.length ? aggregateFreshness(quoted) : 'UNAVAILABLE';
      sendSuccess(res, results, 200, freshness, { source: process.env.NODE_ENV === 'test' ? 'FINSIGHT_TEST_FIXTURE' : 'YAHOO_FINANCE_CHART' });
    } catch (error) { next(error); }
  }

  static async getFxRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from = 'USD', to = 'INR', date } = req.query;
      const rateInfo = await FXService.convertAmount(1, from as string, to as string, date as string);
      sendSuccess(res, { from, to, rate: rateInfo.rate, date: date || new Date().toISOString().slice(0, 10), source: rateInfo.source, observedAt: rateInfo.observedAt }, 200, rateInfo.freshness as any);
    } catch (error) { next(error); }
  }
}

function isoDate(value: string | Date): string { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }

function aggregateFreshness(values: MarketFreshness[]): MarketFreshness {
  const order: MarketFreshness[] = ['UNAVAILABLE', 'STALE', 'SYNTHETIC', 'LAST CLOSE', 'DELAYED', 'LIVE'];
  return order.find(value => values.includes(value)) || 'UNAVAILABLE';
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => { const value = key(item); if (seen.has(value)) return false; seen.add(value); return true; });
}
