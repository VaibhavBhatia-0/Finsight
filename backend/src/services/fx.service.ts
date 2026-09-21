import { AppError } from '../middleware/errorHandler';
import { ExchangeRateRepository } from '../repositories/exchangeRate.repository';
import { YahooFinanceMarketDataProvider } from './marketData/yahooProvider';

interface FxRateInfo {
  rate: number;
  freshness: string;
  source: string;
  observedAt: string;
  rateDate: string;
}

export class FXService {
  static async getRateSeries(baseCurrency: string, quoteCurrency: string, dates: string[]): Promise<Array<{ date: string; rate: number; source: string; rateDate: string }>> {
    const orderedDates = [...new Set(dates.map(value => value.slice(0, 10)))].sort();
    if (!orderedDates.length) return [];
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    if (base === quote || process.env.NODE_ENV === 'test') {
      return Promise.all(orderedDates.map(async date => {
        const info = await this.getRateInfo(base, quote, date);
        return { date, rate: info.rate, source: info.source, rateDate: info.rateDate };
      }));
    }

    const start = new Date(`${orderedDates[0]}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 10);
    const end = new Date(`${orderedDates[orderedDates.length - 1]}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    try {
      const history = await YahooFinanceMarketDataProvider.getHistoryBetween(`${base}${quote}=X`, undefined, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
      const bars = [...history.bars].sort((left, right) => left.date.localeCompare(right.date));
      const results = orderedDates.map(date => {
        const bar = [...bars].reverse().find(item => item.date.slice(0, 10) <= date);
        if (!bar?.close || bar.close <= 0) throw new AppError(`Historical FX observation is unavailable for ${date}`, 503, 'FX_DATA_UNAVAILABLE');
        return { date, rate: bar.close, source: history.provider, rateDate: bar.date.slice(0, 10) };
      });
      const uniqueRates = new Map(results.map(value => [value.rateDate, value.rate]));
      await Promise.all([...uniqueRates].map(([rateDate, rate]) => ExchangeRateRepository.saveRate(base, quote, rateDate, rate, history.provider, 'Historical')));
      return results;
    } catch (error) {
      const cached = await Promise.all(orderedDates.map(date => ExchangeRateRepository.getRateObservation(base, quote, date)));
      if (cached.every(Boolean)) return cached.map((value, index) => ({ date: orderedDates[index], rate: value!.rate, source: value!.source || 'DATABASE', rateDate: value!.rate_date }));
      throw error instanceof AppError ? error : new AppError('Historical FX data is unavailable', 503, 'FX_DATA_UNAVAILABLE');
    }
  }

  static async getRateInfo(baseCurrency: string, quoteCurrency: string, date: string): Promise<FxRateInfo> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    if (base === quote) return { rate: 1, freshness: 'LIVE', source: 'IDENTITY', observedAt: new Date().toISOString(), rateDate: date };

    const cached = await ExchangeRateRepository.getRateObservation(base, quote, date);
    if (process.env.NODE_ENV === 'test') {
      if (cached) return fromObservation(cached);
      return { rate: fixtureRate(base, quote), freshness: 'SYNTHETIC', source: 'FINSIGHT_TEST_FIXTURE', observedAt: new Date().toISOString(), rateDate: date };
    }

    try {
      const start = new Date(`${date}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 10);
      const end = new Date(`${date}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      const history = await YahooFinanceMarketDataProvider.getHistoryBetween(`${base}${quote}=X`, undefined, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
      const bar = [...history.bars].reverse().find(item => item.date.slice(0, 10) <= date);
      if (!bar?.close || bar.close <= 0) throw new AppError('Historical FX observation is unavailable', 503, 'FX_DATA_UNAVAILABLE');
      const rateDate = bar.date.slice(0, 10);
      await ExchangeRateRepository.saveRate(base, quote, rateDate, bar.close, history.provider, 'Historical');
      return { rate: bar.close, freshness: 'Historical', source: history.provider, observedAt: history.fetchedAt, rateDate };
    } catch (error) {
      if (cached && !cached.source?.startsWith('FINSIGHT_')) return { ...fromObservation(cached), freshness: 'STALE' };
      throw error instanceof AppError ? error : new AppError('Historical FX data is unavailable', 503, 'FX_DATA_UNAVAILABLE');
    }
  }

  static async getRate(baseCurrency: string, quoteCurrency: string, date: string): Promise<number> {
    return (await this.getRateInfo(baseCurrency, quoteCurrency, date)).rate;
  }

  static async getLatestRate(baseCurrency: string, quoteCurrency: string): Promise<FxRateInfo> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    const today = new Date().toISOString().slice(0, 10);
    if (base === quote) return { rate: 1, freshness: 'LIVE', source: 'IDENTITY', observedAt: new Date().toISOString(), rateDate: today };
    const cached = await ExchangeRateRepository.getLatestRate(base, quote);
    if (process.env.NODE_ENV === 'test') {
      if (cached) return { rate: cached.rate, freshness: cached.freshness, source: cached.source || 'DATABASE', observedAt: cached.observed_at, rateDate: today };
      return { rate: fixtureRate(base, quote), freshness: 'SYNTHETIC', source: 'FINSIGHT_TEST_FIXTURE', observedAt: new Date().toISOString(), rateDate: today };
    }
    try {
      const quoteResult = await YahooFinanceMarketDataProvider.getQuote(`${base}${quote}=X`);
      await ExchangeRateRepository.saveRate(base, quote, quoteResult.marketTimestamp.slice(0, 10), quoteResult.price, quoteResult.source, quoteResult.freshnessLabel);
      return { rate: quoteResult.price, freshness: quoteResult.freshnessLabel, source: quoteResult.source, observedAt: quoteResult.marketTimestamp, rateDate: quoteResult.marketTimestamp.slice(0, 10) };
    } catch (error) {
      if (cached && !cached.source?.startsWith('FINSIGHT_')) return { rate: cached.rate, freshness: 'STALE', source: cached.source || 'DATABASE', observedAt: cached.observed_at, rateDate: today };
      throw error instanceof AppError ? error : new AppError('Current FX data is unavailable', 503, 'FX_DATA_UNAVAILABLE');
    }
  }

  static async convertAmount(amount: number, sourceCurrency: string, targetCurrency: string, date?: string) {
    const info = date
      ? await this.getRateInfo(sourceCurrency, targetCurrency, date)
      : await this.getLatestRate(sourceCurrency, targetCurrency);
    return { convertedAmount: round2(amount * info.rate), ...info };
  }
}

function fromObservation(value: { rate: number; freshness: string; source: string | null; observed_at: string | null; rate_date: string }): FxRateInfo {
  return { rate: value.rate, freshness: value.freshness, source: value.source || 'DATABASE', observedAt: value.observed_at || new Date(`${value.rate_date}T00:00:00Z`).toISOString(), rateDate: value.rate_date };
}
function fixtureRate(base: string, quote: string): number {
  const values: Record<string, number> = { USD: 1, INR: 88.25, EUR: .92, GBP: .78 };
  if (!values[base] || !values[quote]) throw new AppError(`No test FX fixture for ${base}/${quote}`, 503, 'FX_DATA_UNAVAILABLE');
  return Math.round(values[quote] / values[base] * 1e6) / 1e6;
}
function round2(value: number): number { return Math.round(value * 100) / 100; }
