import { db } from '../database/db';

export interface ExchangeRateRow {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate_date: string;
  rate: number;
  source: string | null;
  observed_at: string | null;
  freshness: string | null;
}

export class ExchangeRateRepository {
  static async getRate(base: string, quote: string, date: string): Promise<number | null> {
    if (base === quote) return 1.0;

    // Look for direct pair on or immediately before target date
    const directRes = await db.query<{ rate: string }>(`
      SELECT rate FROM exchange_rates
      WHERE base_currency = $1 AND quote_currency = $2 AND rate_date <= $3
      ORDER BY rate_date DESC
      LIMIT 1;
    `, [base, quote, date]);

    if (directRes.rows.length > 0) {
      return parseFloat(directRes.rows[0].rate);
    }

    // Look for inverse pair
    const inverseRes = await db.query<{ rate: string }>(`
      SELECT rate FROM exchange_rates
      WHERE base_currency = $1 AND quote_currency = $2 AND rate_date <= $3
      ORDER BY rate_date DESC
      LIMIT 1;
    `, [quote, base, date]);

    if (inverseRes.rows.length > 0) {
      const invRate = parseFloat(inverseRes.rows[0].rate);
      return invRate > 0 ? 1.0 / invRate : null;
    }

    return null;
  }

  static async getLatestRate(base: string, quote: string): Promise<{ rate: number; freshness: string; observed_at: string } | null> {
    if (base === quote) {
      return { rate: 1.0, freshness: 'Live', observed_at: new Date().toISOString() };
    }

    const res = await db.query<{ rate: string; freshness: string; observed_at: string }>(`
      SELECT rate, freshness, observed_at FROM exchange_rates
      WHERE base_currency = $1 AND quote_currency = $2
      ORDER BY rate_date DESC
      LIMIT 1;
    `, [base, quote]);

    if (res.rows.length > 0) {
      return {
        rate: parseFloat(res.rows[0].rate),
        freshness: res.rows[0].freshness || 'End-of-day',
        observed_at: res.rows[0].observed_at || new Date().toISOString(),
      };
    }

    const invRes = await db.query<{ rate: string; freshness: string; observed_at: string }>(`
      SELECT rate, freshness, observed_at FROM exchange_rates
      WHERE base_currency = $1 AND quote_currency = $2
      ORDER BY rate_date DESC
      LIMIT 1;
    `, [quote, base]);

    if (invRes.rows.length > 0) {
      const val = parseFloat(invRes.rows[0].rate);
      return {
        rate: val > 0 ? 1.0 / val : 1.0,
        freshness: invRes.rows[0].freshness || 'End-of-day',
        observed_at: invRes.rows[0].observed_at || new Date().toISOString(),
      };
    }

    return null;
  }

  static async saveRate(
    base: string,
    quote: string,
    date: string,
    rate: number,
    source: string = 'FINSIGHT_MARKET_FEED',
    freshness: string = 'End-of-day'
  ): Promise<void> {
    await db.query(`
      INSERT INTO exchange_rates (
        base_currency, quote_currency, rate_date, rate, source, freshness, observed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (base_currency, quote_currency, rate_date) DO UPDATE
      SET rate = EXCLUDED.rate,
          source = EXCLUDED.source,
          freshness = EXCLUDED.freshness,
          observed_at = CURRENT_TIMESTAMP;
    `, [base, quote, date, rate, source, freshness]);
  }
}

