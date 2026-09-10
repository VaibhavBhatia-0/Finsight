import { ExchangeRateRepository } from '../repositories/exchangeRate.repository';
import { AppError } from '../middleware/errorHandler';

export class FXService {
  private static syntheticRate(base: string, quote: string): number {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('No historical FX observation is available', 503, 'FX_DATA_UNAVAILABLE');
    }
    return this.getEstimatedRate(base, quote);
  }

  public static async getRateInfo(baseCurrency: string, quoteCurrency: string, date: string) {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    const observation = await ExchangeRateRepository.getRateObservation(base, quote, date);
    if (observation) return observation;
    return { rate: this.syntheticRate(base, quote), freshness: 'Synthetic', source: 'FINSIGHT_DEVELOPMENT_FIXTURE' };
  }

  /**
   * Resolves exchange rate on or before target date.
   */
  public static async getRate(baseCurrency: string, quoteCurrency: string, date: string): Promise<number> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();

    return (await this.getRateInfo(base, quote, date)).rate;
  }

  /**
   * Resolves current latest available FX rate with freshness metadata.
   */
  public static async getLatestRate(baseCurrency: string, quoteCurrency: string) {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();

    if (base === quote) {
      return { rate: 1.0, freshness: 'Live' as const, observed_at: new Date().toISOString() };
    }

    let latest = await ExchangeRateRepository.getLatestRate(base, quote);
    if (latest) {
      return latest;
    }

    return {
      rate: this.syntheticRate(base, quote),
      freshness: 'Synthetic' as const,
      observed_at: new Date().toISOString(),
      source: 'FINSIGHT_DEVELOPMENT_FIXTURE',
    };
  }

  /**
   * Converts an amount from sourceCurrency to targetCurrency at given date.
   */
  public static async convertAmount(
    amount: number,
    sourceCurrency: string,
    targetCurrency: string,
    date?: string
  ): Promise<{ convertedAmount: number; rate: number; freshness: string }> {
    const src = sourceCurrency.toUpperCase();
    const tgt = targetCurrency.toUpperCase();

    if (src === tgt) {
      return { convertedAmount: amount, rate: 1.0, freshness: 'Live' };
    }

    if (date) {
      const info = await this.getRateInfo(src, tgt, date);
      return {
        convertedAmount: round2(amount * info.rate),
        rate: info.rate,
        freshness: info.freshness,
      };
    } else {
      const latest = await this.getLatestRate(src, tgt);
      return {
        convertedAmount: round2(amount * latest.rate),
        rate: latest.rate,
        freshness: latest.freshness,
      };
    }
  }

  private static getEstimatedRate(base: string, quote: string): number {
    const ratesAgainstUSD: Record<string, number> = {
      'USD': 1.0,
      'INR': 88.25,
      'EUR': 0.92,
      'GBP': 0.78,
    };

    const baseToUsd = ratesAgainstUSD[base] || 1.0;
    const quoteToUsd = ratesAgainstUSD[quote] || 1.0;

    // Rate = quote / base
    return round6(quoteToUsd / baseToUsd);
  }
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function round6(val: number): number {
  return Math.round(val * 1000000) / 1000000;
}
