import { MockMarketDataProvider, StockQuote, StockFundamentalData } from './marketData/mockProvider';
import { StockRepository, StockRow } from '../repositories/stock.repository';
import { PriceHistoryRepository, PriceBar } from '../repositories/priceHistory.repository';
import { AppError } from '../middleware/errorHandler';
import type { ScreenerFilters } from '../validators/market.validator';

export class MarketDataService {
  private static assertMockIsAllowed(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('No licensed production market-data provider is configured', 503, 'MARKET_DATA_UNAVAILABLE');
    }
  }
  /**
   * Retrieves real-time or delayed quote for a symbol.
   * Checks database cache or delegates to the active provider adapter.
   */
  public static async getQuote(symbol: string): Promise<StockQuote> {
    this.assertMockIsAllowed();
    return MockMarketDataProvider.getQuote(symbol);
  }

  /**
   * Retrieves historical OHLCV price series.
   * Looks up in PostgreSQL price_history. If empty, populates from provider and caches into PostgreSQL.
   */
  public static async getPriceHistory(
    stockId: string | number,
    symbol: string,
    startDate?: string,
    endDate?: string
  ): Promise<PriceBar[]> {
    let prices = await PriceHistoryRepository.getPrices(stockId, startDate, endDate);

    if (prices.length === 0) {
      this.assertMockIsAllowed();
      // Development-only synthetic history is never persisted as an observation.
      const generated = MockMarketDataProvider.generateHistoricalPrices(symbol, 1825); // 5 years
      prices = generated.filter((bar) => (!startDate || bar.date >= startDate) && (!endDate || bar.date <= endDate));
    }

    return prices;
  }

  /**
   * Retrieves comprehensive fundamental and technical indicators.
   */
  public static async getStockFundamentals(symbol: string): Promise<StockFundamentalData> {
    this.assertMockIsAllowed();
    return MockMarketDataProvider.getFundamentals(symbol);
  }

  /**
   * Market overview covering Indian and US market indices.
   */
  public static async getMarketOverview() {
    this.assertMockIsAllowed();
    const indices = [
      { code: 'NIFTY_50', name: 'NIFTY 50', country: 'IN', currency: 'INR' },
      { code: 'SENSEX', name: 'BSE SENSEX', country: 'IN', currency: 'INR' },
      { code: 'SP500', name: 'S&P 500', country: 'US', currency: 'USD' },
      { code: 'NASDAQ_COMP', name: 'NASDAQ Composite', country: 'US', currency: 'USD' },
    ];

    const quotes = indices.map((idx) => {
      const q = MockMarketDataProvider.getQuote(idx.code);
      return {
        ...idx,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        freshness: q.freshness,
        timestamp: q.timestamp,
      };
    });

    return {
      indices: quotes,
      india: quotes.filter(q => q.country === 'IN'),
      us: quotes.filter(q => q.country === 'US'),
    };
  }

  /**
   * Stock Screener with AND-combined filtering, sorting, and pagination.
   */
  public static async screenStocks(filters: ScreenerFilters) {
    this.assertMockIsAllowed();
    const allStocks = await StockRepository.findAll();
    let screened = allStocks.map((stock) => {
      const quote = MockMarketDataProvider.getQuote(stock.symbol);
      const fund = MockMarketDataProvider.getFundamentals(stock.symbol);
      return {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.company_name,
        exchange: stock.exchange,
        exchangeCode: (stock as any).exchange_code,
        countryCode: (stock as any).country_code,
        currency: stock.currency,
        sector: stock.sector,
        price: quote.price,
        changePercent: quote.changePercent,
        volume: quote.volume,
        marketCap: fund.marketCap,
        peRatio: fund.peRatio,
        eps: fund.eps,
        dividendYield: fund.dividendYield,
        revenue: fund.revenue,
        profit: fund.profit,
        debt: fund.totalDebt,
        rsi14: fund.rsi14,
        sma50: fund.sma50,
        sma200: fund.sma200,
        fiftyTwoWeekHigh: fund.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: fund.fiftyTwoWeekLow,
        yearPosition: yearPosition(quote.price, fund.fiftyTwoWeekLow, fund.fiftyTwoWeekHigh),
      };
    });

    // AND-Combined Filtering
    if (filters.exchange) {
      screened = screened.filter(s => s.exchange.toLowerCase() === filters.exchange!.toLowerCase() || s.exchangeCode?.toLowerCase() === filters.exchange!.toLowerCase());
    }
    if (filters.country) {
      screened = screened.filter(s => s.countryCode?.toLowerCase() === filters.country!.toLowerCase());
    }
    if (filters.sector) {
      screened = screened.filter(s => s.sector?.toLowerCase() === filters.sector!.toLowerCase());
    }
    if (filters.minPrice !== undefined) {
      screened = screened.filter(s => s.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      screened = screened.filter(s => s.price <= filters.maxPrice!);
    }
    if (filters.minPe !== undefined) {
      screened = screened.filter(s => s.peRatio >= filters.minPe!);
    }
    if (filters.maxPe !== undefined) {
      screened = screened.filter(s => s.peRatio <= filters.maxPe!);
    }
    if (filters.minEps !== undefined) screened = screened.filter(s => s.eps >= filters.minEps!);
    if (filters.maxEps !== undefined) screened = screened.filter(s => s.eps <= filters.maxEps!);
    if (filters.minDivYield !== undefined) {
      screened = screened.filter(s => s.dividendYield >= filters.minDivYield!);
    }
    if (filters.maxDivYield !== undefined) screened = screened.filter(s => s.dividendYield <= filters.maxDivYield!);
    if (filters.minMarketCap !== undefined) {
      screened = screened.filter(s => s.marketCap >= filters.minMarketCap!);
    }
    if (filters.maxMarketCap !== undefined) screened = screened.filter(s => s.marketCap <= filters.maxMarketCap!);
    if (filters.minRevenue !== undefined) screened = screened.filter(s => s.revenue >= filters.minRevenue!);
    if (filters.maxRevenue !== undefined) screened = screened.filter(s => s.revenue <= filters.maxRevenue!);
    if (filters.minProfit !== undefined) screened = screened.filter(s => s.profit >= filters.minProfit!);
    if (filters.maxProfit !== undefined) screened = screened.filter(s => s.profit <= filters.maxProfit!);
    if (filters.minDebt !== undefined) screened = screened.filter(s => s.debt >= filters.minDebt!);
    if (filters.maxDebt !== undefined) screened = screened.filter(s => s.debt <= filters.maxDebt!);
    if (filters.minVolume !== undefined) screened = screened.filter(s => s.volume >= filters.minVolume!);
    if (filters.maxVolume !== undefined) screened = screened.filter(s => s.volume <= filters.maxVolume!);
    if (filters.minRsi !== undefined) {
      screened = screened.filter(s => s.rsi14 >= filters.minRsi!);
    }
    if (filters.maxRsi !== undefined) {
      screened = screened.filter(s => s.rsi14 <= filters.maxRsi!);
    }
    if (filters.minYearPosition !== undefined) screened = screened.filter(s => s.yearPosition >= filters.minYearPosition!);
    if (filters.maxYearPosition !== undefined) screened = screened.filter(s => s.yearPosition <= filters.maxYearPosition!);
    if (filters.movingAverageRelation) {
      screened = screened.filter(s => matchesMovingAverage(s, filters.movingAverageRelation!));
    }

    // Sorting
    const sortBy = filters.sortBy || 'marketCap';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    screened.sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * sortOrder;
      return (Number(valA) - Number(valB)) * sortOrder;
    });

    // Pagination
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const total = screened.length;
    const items = screened.slice((page - 1) * limit, page * limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

function yearPosition(price: number, low: number, high: number): number {
  if (high <= low) return 0;
  return Math.round(((price - low) / (high - low)) * 10000) / 100;
}

function matchesMovingAverage(
  stock: { price: number; sma50: number; sma200: number },
  relation: NonNullable<ScreenerFilters['movingAverageRelation']>,
): boolean {
  switch (relation) {
    case 'ABOVE_50': return stock.price > stock.sma50;
    case 'BELOW_50': return stock.price < stock.sma50;
    case 'ABOVE_200': return stock.price > stock.sma200;
    case 'BELOW_200': return stock.price < stock.sma200;
    case 'GOLDEN_CROSS': return stock.sma50 > stock.sma200;
    case 'DEATH_CROSS': return stock.sma50 < stock.sma200;
  }
}
