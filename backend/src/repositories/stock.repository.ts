import { db } from '../database/db';

export interface StockRow {
  id: string;
  symbol: string;
  exchange_id: string;
  exchange: string;
  company_name: string;
  currency: string;
  sector: string | null;
  industry: string | null;
  created_at: string;
}

export class StockRepository {
  static async findAll(): Promise<StockRow[]> {
    const res = await db.query<StockRow>(`
      SELECT s.*, e.code as exchange_code, e.name as exchange_name, e.country_code
      FROM stocks s
      JOIN exchanges e ON s.exchange_id = e.id
      ORDER BY s.symbol ASC;
    `);
    return res.rows;
  }

  static async findById(id: string | number): Promise<any | null> {
    const res = await db.query(`
      SELECT s.*, e.code as exchange_code, e.name as exchange_name, e.country_code
      FROM stocks s
      JOIN exchanges e ON s.exchange_id = e.id
      WHERE s.id = $1;
    `, [id]);
    return res.rows[0] || null;
  }

  static async findBySymbol(symbol: string): Promise<any | null> {
    const res = await db.query(`
      SELECT s.*, e.code as exchange_code, e.name as exchange_name, e.country_code
      FROM stocks s
      JOIN exchanges e ON s.exchange_id = e.id
      WHERE UPPER(s.symbol) = UPPER($1);
    `, [symbol]);
    return res.rows[0] || null;
  }

  static async search(query: string): Promise<any[]> {
    const q = `%${query.toUpperCase()}%`;
    const res = await db.query(`
      SELECT s.*, e.code as exchange_code, e.country_code
      FROM stocks s
      JOIN exchanges e ON s.exchange_id = e.id
      WHERE UPPER(s.symbol) LIKE $1 OR UPPER(s.company_name) LIKE $1
      ORDER BY s.symbol ASC
      LIMIT 20;
    `, [q]);
    return res.rows;
  }

  static async getFundamentals(stockId: string | number): Promise<any | null> {
    const res = await db.query(`
      SELECT * FROM fundamentals
      WHERE stock_id = $1
      ORDER BY period_end DESC
      LIMIT 1;
    `, [stockId]);
    return res.rows[0] || null;
  }

  static async getDividends(stockId: string | number): Promise<any[]> {
    const res = await db.query(`
      SELECT * FROM dividends
      WHERE stock_id = $1
      ORDER BY ex_date DESC;
    `, [stockId]);
    return res.rows;
  }

  static async getCorporateActions(stockId: string | number): Promise<any[]> {
    const res = await db.query(`
      SELECT * FROM corporate_actions
      WHERE stock_id = $1
      ORDER BY action_date DESC;
    `, [stockId]);
    return res.rows;
  }
}

