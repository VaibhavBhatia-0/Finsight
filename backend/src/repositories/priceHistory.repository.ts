import { db } from '../database/db';

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close?: number;
  volume: number;
}

export class PriceHistoryRepository {
  static async getPrices(
    stockId: string | number,
    startDate?: string,
    endDate?: string
  ): Promise<PriceBar[]> {
    let sql = `
      SELECT 
        to_char(trading_date, 'YYYY-MM-DD') as date,
        open_price::float as open,
        high_price::float as high,
        low_price::float as low,
        close_price::float as close,
        adjusted_close::float as adjusted_close,
        volume
      FROM price_history
      WHERE stock_id = $1
    `;
    const params: any[] = [stockId];

    if (startDate) {
      params.push(startDate);
      sql += ` AND trading_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND trading_date <= $${params.length}`;
    }

    sql += ` ORDER BY trading_date ASC;`;

    const res = await db.query(sql, params);
    return res.rows;
  }

  static async savePriceBar(stockId: string | number, bar: PriceBar): Promise<void> {
    await db.query(`
      INSERT INTO price_history (
        stock_id, trading_date, open_price, high_price, low_price, close_price, adjusted_close, volume
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (stock_id, trading_date) DO UPDATE
      SET open_price = EXCLUDED.open_price,
          high_price = EXCLUDED.high_price,
          low_price = EXCLUDED.low_price,
          close_price = EXCLUDED.close_price,
          adjusted_close = EXCLUDED.adjusted_close,
          volume = EXCLUDED.volume;
    `, [
      stockId,
      bar.date,
      bar.open,
      bar.high,
      bar.low,
      bar.close,
      bar.adjusted_close || bar.close,
      bar.volume,
    ]);
  }
}

