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
  static async getRateObservation(base: string, quote: string, date: string): Promise<{ rate: number; freshness: string; source: string | null; observed_at: string | null; rate_date: string } | null> {
    if (base === quote) return { rate: 1, freshness: 'LIVE', source: 'IDENTITY', observed_at: new Date().toISOString(), rate_date: date };
    const direct = await db.query<{ rate: string; freshness: string; source: string | null; observed_at: string | null; rate_date: string }>(`
      SELECT rate, freshness, source, observed_at, rate_date::text FROM exchange_rates
      WHERE base_currency = $1 AND quote_currency = $2 AND rate_date <= $3
      ORDER BY rate_date DESC LIMIT 1;
    `, [base, quote, date]);
    if (direct.rows[0]) return { ...direct.rows[0], rate: parseFloat(direct.rows[0].rate), freshness: direct.rows[0].source?.startsWith('FINSIGHT_') ? 'SYNTHETIC' : (direct.rows[0].freshness || 'Historical') };
    const inverse = await db.query<{ rate: string; freshness: string; source: string | null; observed_at: string | null; rate_date: string }>(`
      SELECT rate, freshness, source, observed_at, rate_date::text FROM exchange_rates
      WHERE base_currency = $1 AND quote_currency = $2 AND rate_date <= $3
      ORDER BY rate_date DESC LIMIT 1;
    `, [quote, base, date]);
    if (!inverse.rows[0]) return null;
    const rate = parseFloat(inverse.rows[0].rate);
    return rate > 0 ? { ...inverse.rows[0], rate: 1 / rate, freshness: inverse.rows[0].source?.startsWith('FINSIGHT_') ? 'SYNTHETIC' : (inverse.rows[0].freshness || 'Historical') } : null;
  }

  static async getRate(base: string, quote: string, date: string): Promise<number | null> {
    return (await this.getRateObservation(base, quote, date))?.rate ?? null;
  }

  static async getLatestRate(base: string, quote: string): Promise<{ rate: number; freshness: string; observed_at: string; source: string | null } | null> {
    if (base === quote) {
      return { rate: 1.0, freshness: 'LIVE', observed_at: new Date().toISOString(), source: 'IDENTITY' };
    }

    const res = await db.query<{ rate: string; freshness: string; observed_at: string; source: string | null }>(`
      SELECT rate, freshness, observed_at, source FROM exchange_rates
      WHERE base_currency = $1 AND quote_currency = $2
      ORDER BY rate_date DESC
      LIMIT 1;
    `, [base, quote]);

    if (res.rows.length > 0) {
      return {
        rate: parseFloat(res.rows[0].rate),
        freshness: res.rows[0].freshness || 'End-of-day',
        observed_at: res.rows[0].observed_at || new Date().toISOString(),
        source: res.rows[0].source,
      };
    }

    const invRes = await db.query<{ rate: string; freshness: string; observed_at: string; source: string | null }>(`
      SELECT rate, freshness, observed_at, source FROM exchange_rates
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
        source: invRes.rows[0].source,
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
