import { PriceBar } from '../../repositories/priceHistory.repository';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  freshness: 'Synthetic';
  timestamp: string;
}

export interface StockFundamentalData {
  marketCap: number;
  peRatio: number;
  eps: number;
  dividendYield: number;
  revenue: number;
  profit: number;
  totalDebt: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  rsi14: number;
  sma50: number;
  sma200: number;
}

export class MockMarketDataProvider {
  private static baselineProfiles: Record<string, { basePrice: number; beta: number; currency: string; name: string; sector: string }> = {
    'RELIANCE': { basePrice: 2950.0, beta: 1.05, currency: 'INR', name: 'Reliance Industries Ltd.', sector: 'Energy' },
    'TCS': { basePrice: 4200.0, beta: 0.85, currency: 'INR', name: 'Tata Consultancy Services Ltd.', sector: 'Technology' },
    'HDFCBANK': { basePrice: 1650.0, beta: 1.10, currency: 'INR', name: 'HDFC Bank Ltd.', sector: 'Financial Services' },
    'INFY': { basePrice: 1850.0, beta: 0.95, currency: 'INR', name: 'Infosys Ltd.', sector: 'Technology' },
    'NVDA': { basePrice: 125.0, beta: 1.75, currency: 'USD', name: 'NVIDIA Corporation', sector: 'Technology' },
    'AAPL': { basePrice: 220.0, beta: 1.02, currency: 'USD', name: 'Apple Inc.', sector: 'Technology' },
    'MSFT': { basePrice: 425.0, beta: 0.98, currency: 'USD', name: 'Microsoft Corporation', sector: 'Technology' },
    'GOOGL': { basePrice: 160.0, beta: 1.12, currency: 'USD', name: 'Alphabet Inc.', sector: 'Technology' },
    'NIFTY_50': { basePrice: 24800.0, beta: 1.0, currency: 'INR', name: 'NIFTY 50', sector: 'Index' },
    'SENSEX': { basePrice: 81200.0, beta: 1.0, currency: 'INR', name: 'BSE SENSEX', sector: 'Index' },
    'SP500': { basePrice: 5500.0, beta: 1.0, currency: 'USD', name: 'S&P 500', sector: 'Index' },
    'NASDAQ_COMP': { basePrice: 17500.0, beta: 1.0, currency: 'USD', name: 'NASDAQ Composite', sector: 'Index' },
  };

  public static getQuote(symbol: string): StockQuote {
    const sym = symbol.toUpperCase();
    const profile = this.baselineProfiles[sym] || { basePrice: 100.0, beta: 1.0, currency: 'USD', name: sym, sector: 'Equities' };

    // Deterministic pseudo-variation based on date & symbol hash
    const dateStr = new Date().toISOString().slice(0, 10);
    const hash = this.hashString(`${sym}_${dateStr}`);
    const variationPct = ((hash % 40) - 20) / 1000.0; // +/- 2%
    const currentPrice = round2(profile.basePrice * (1 + variationPct));
    const prevClose = profile.basePrice;
    const change = round2(currentPrice - prevClose);
    const changePercent = round2((change / prevClose) * 100);

    return {
      symbol: sym,
      price: currentPrice,
      change,
      changePercent,
      open: round2(prevClose * 0.998),
      high: round2(Math.max(currentPrice, prevClose) * 1.008),
      low: round2(Math.min(currentPrice, prevClose) * 0.992),
      previousClose: prevClose,
      volume: 1500000 + (hash % 1000000),
      freshness: 'Synthetic',
      timestamp: new Date().toISOString(),
    };
  }

  public static generateHistoricalPrices(symbol: string, days: number = 1825): PriceBar[] {
    const sym = symbol.toUpperCase();
    const profile = this.baselineProfiles[sym] || { basePrice: 100.0, beta: 1.0, currency: 'USD', name: sym, sector: 'Equities' };

    const bars: PriceBar[] = [];
    const today = new Date();
    let price = profile.basePrice * 0.45; // 5 years ago baseline price

    for (let i = days; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);

      // Skip weekends (Saturday=6, Sunday=0)
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = d.toISOString().slice(0, 10);
      const hash = this.hashString(`${sym}_${dateStr}`);
      const dailyReturn = (((hash % 50) - 24) / 1000.0) * profile.beta;
      price = Math.max(1.0, price * (1 + dailyReturn));

      const open = round2(price * (1 + ((hash % 10) - 5) / 1000.0));
      const high = round2(Math.max(open, price) * (1 + (hash % 8) / 1000.0));
      const low = round2(Math.min(open, price) * (1 - (hash % 8) / 1000.0));
      const close = round2(price);
      const volume = 500000 + (hash % 2000000);

      bars.push({
        date: dateStr,
        open,
        high,
        low,
        close,
        adjusted_close: close,
        volume,
      });
    }

    return bars;
  }

  public static getFundamentals(symbol: string): StockFundamentalData {
    const sym = symbol.toUpperCase();
    const quote = this.getQuote(sym);
    const hash = this.hashString(sym);

    const pe = 15.0 + (hash % 40);
    const eps = round2(quote.price / pe);
    const divYield = (hash % 35) / 10.0; // 0.0% to 3.5%
    const marketCap = quote.price * (10000000 + (hash % 50000000));
    const revenue = marketCap / (2.5 + (hash % 4));
    const profit = revenue * (0.12 + (hash % 15) / 100.0);
    const totalDebt = revenue * (0.3 + (hash % 50) / 100.0);

    return {
      marketCap: round2(marketCap),
      peRatio: round2(pe),
      eps,
      dividendYield: round2(divYield),
      revenue: round2(revenue),
      profit: round2(profit),
      totalDebt: round2(totalDebt),
      fiftyTwoWeekHigh: round2(quote.price * 1.25),
      fiftyTwoWeekLow: round2(quote.price * 0.72),
      rsi14: 45.0 + (hash % 30),
      sma50: round2(quote.price * 0.98),
      sma200: round2(quote.price * 0.92),
    };
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}
