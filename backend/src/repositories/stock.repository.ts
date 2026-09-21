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
  display_symbol: string;
  provider_symbol: string;
  asset_type: string;
  is_active: boolean;
  created_at: string;
}

export interface StockListFilters {
  q?: string;
  exchange?: string;
  country?: string;
  sector?: string;
  page?: number;
  limit?: number;
  sortBy?: 'symbol' | 'company';
  sortOrder?: 'asc' | 'desc';
}

export class StockRepository {
  static async findAll(): Promise<StockRow[]> {
    const res = await db.query<StockRow>(`
      SELECT s.*, e.code as exchange_code, e.name as exchange_name, e.country_code
      FROM stocks s
      JOIN exchanges e ON s.exchange_id = e.id
      WHERE s.is_active = TRUE
      ORDER BY s.symbol ASC;
    `);
    return res.rows;
  }

  static async list(filters: StockListFilters): Promise<{ items: StockRow[]; page: number; limit: number; total: number; totalPages: number }> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const clauses = ['s.is_active = TRUE'];
    const params: unknown[] = [];
    if (filters.q?.trim()) {
      const value = `%${filters.q.trim().toUpperCase()}%`;
      params.push(value, value, value);
      clauses.push(`(UPPER(s.symbol) LIKE $${params.length - 2} OR UPPER(s.company_name) LIKE $${params.length - 1} OR UPPER(s.display_symbol) LIKE $${params.length})`);
    }
    if (filters.exchange) { params.push(filters.exchange.toUpperCase()); clauses.push(`UPPER(e.code) = $${params.length}`); }
    if (filters.country) { params.push(filters.country.toUpperCase()); clauses.push(`UPPER(e.country_code) = $${params.length}`); }
    if (filters.sector) { params.push(filters.sector.toUpperCase()); clauses.push(`UPPER(s.sector) = $${params.length}`); }
    const where = clauses.join(' AND ');
    const count = await db.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM stocks s JOIN exchanges e ON s.exchange_id = e.id WHERE ${where}`, params);
    const total = Number(count.rows[0]?.total || 0);
    const sortColumn = filters.sortBy === 'company' ? 's.company_name' : 's.symbol';
    const sortOrder = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';
    params.push(limit, (page - 1) * limit);
    const result = await db.query<StockRow>(`
      SELECT s.*, e.code AS exchange_code, e.name AS exchange_name, e.country_code
      FROM stocks s JOIN exchanges e ON s.exchange_id = e.id
      WHERE ${where}
      ORDER BY ${sortColumn} ${sortOrder}, s.id ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    return { items: result.rows, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
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
