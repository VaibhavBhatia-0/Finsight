import { db, IDatabaseExecutor } from '../database/db';

export interface PortfolioRow {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  benchmark_id: string | null;
  created_at: string;
  updated_at: string;
  allocation_targets: Record<string, number>;
}

export interface PortfolioTxRow {
  id: string;
  portfolio_id: string;
  stock_id: string | null;
  transaction_type: 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'TAX';
  transaction_date: string | Date;
  quantity: number | null;
  price: number | null;
  amount: number;
  currency: string;
  fee_amount: number;
  fx_rate: number | null;
  notes: string | null;
  created_at: string;
  symbol?: string | null;
  company_name?: string | null;
  asset_currency?: string | null;
  sector?: string | null;
  industry?: string | null;
  exchange_code?: string | null;
  country_code?: string | null;
}

export class PortfolioRepository {
  static async create(userId: string, data: {
    name: string;
    baseCurrency?: string;
    benchmarkId?: string | number | null;
  }): Promise<PortfolioRow> {
    const res = await db.query<PortfolioRow>(`
      INSERT INTO portfolios (user_id, name, base_currency, benchmark_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [
      userId,
      data.name,
      data.baseCurrency || 'INR',
      data.benchmarkId || null,
    ]);
    return res.rows[0];
  }

  static async findByUserId(userId: string): Promise<any[]> {
    const res = await db.query(`
      SELECT p.*, b.code as benchmark_code, b.name as benchmark_name
      FROM portfolios p
      LEFT JOIN benchmarks b ON p.benchmark_id = b.id
      WHERE p.user_id = $1
      ORDER BY p.created_at ASC;
    `, [userId]);
    return res.rows;
  }

  static async findById(id: string | number, userId: string): Promise<any | null> {
    const res = await db.query(`
      SELECT p.*, b.code as benchmark_code, b.name as benchmark_name,
             b.currency as benchmark_currency, e.code as benchmark_exchange
      FROM portfolios p
      LEFT JOIN benchmarks b ON p.benchmark_id = b.id
      LEFT JOIN exchanges e ON b.exchange_id = e.id
      WHERE p.id = $1 AND p.user_id = $2;
    `, [id, userId]);
    return res.rows[0] || null;
  }

  static async update(id: string | number, userId: string, data: {
    name?: string;
    benchmarkId?: string | number | null;
    allocationTargets?: Record<string, number>;
  }): Promise<any | null> {
    const result = await db.query(`
      UPDATE portfolios
      SET name = COALESCE($3, name),
          benchmark_id = CASE WHEN $4::boolean THEN $5 ELSE benchmark_id END,
          allocation_targets = COALESCE($6::jsonb, allocation_targets),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `, [
      id, userId, data.name ?? null,
      Object.prototype.hasOwnProperty.call(data, 'benchmarkId'), data.benchmarkId ?? null,
      data.allocationTargets ? JSON.stringify(data.allocationTargets) : null,
    ]);
    return result.rows[0] || null;
  }

  static async listBenchmarks(): Promise<any[]> {
    const result = await db.query(`
      SELECT b.id, b.code, b.name, b.currency, e.code AS exchange
      FROM benchmarks b
      LEFT JOIN exchanges e ON b.exchange_id = e.id
      WHERE b.code IN ('NIFTY_50', 'SENSEX', 'SP500', 'NASDAQ_COMP')
      ORDER BY b.id;
    `);
    return result.rows;
  }

  static async delete(id: string | number, userId: string): Promise<void> {
    await db.query(`
      DELETE FROM portfolios
      WHERE id = $1 AND user_id = $2;
    `, [id, userId]);
  }

  static async getTransactions(portfolioId: string | number, executor: IDatabaseExecutor = db): Promise<PortfolioTxRow[]> {
    const res = await executor.query<PortfolioTxRow>(`
      SELECT 
        pt.*,
        s.symbol,
        s.company_name,
        s.currency AS asset_currency,
        s.sector,
        s.industry,
        e.code AS exchange_code,
        e.country_code
      FROM portfolio_transactions pt
      LEFT JOIN stocks s ON pt.stock_id = s.id
      LEFT JOIN exchanges e ON s.exchange_id = e.id
      WHERE pt.portfolio_id = $1
      ORDER BY pt.transaction_date ASC, pt.created_at ASC;
    `, [portfolioId]);
    return res.rows;
  }

  static async addTransaction(data: {
    portfolioId: string | number;
    stockId?: string | number | null;
    transactionType: string;
    transactionDate: string;
    quantity?: number | null;
    price?: number | null;
    amount: number;
    currency: string;
    feeAmount?: number;
    fxRate?: number | null;
    notes?: string | null;
  }, executor: IDatabaseExecutor = db): Promise<PortfolioTxRow> {
    const res = await executor.query<PortfolioTxRow>(`
      INSERT INTO portfolio_transactions (
        portfolio_id, stock_id, transaction_type, transaction_date,
        quantity, price, amount, currency, fee_amount, fx_rate, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `, [
      data.portfolioId,
      data.stockId || null,
      data.transactionType,
      data.transactionDate,
      data.quantity ?? null,
      data.price ?? null,
      data.amount,
      data.currency,
      data.feeAmount || 0,
      data.fxRate || null,
      data.notes || null,
    ]);
    return res.rows[0];
  }

  static async getHoldings(portfolioId: string | number): Promise<any[]> {
    const res = await db.query(`
      SELECT 
        ph.*,
        s.symbol,
        s.company_name,
        s.currency as asset_currency,
        s.sector,
        e.code as exchange_code
      FROM portfolio_holdings ph
      JOIN stocks s ON ph.stock_id = s.id
      JOIN exchanges e ON s.exchange_id = e.id
      WHERE ph.portfolio_id = $1
      ORDER BY s.symbol ASC;
    `, [portfolioId]);
    return res.rows;
  }

  static async syncHoldings(portfolioId: string | number, holdingsMap: Map<string | number, { quantity: number; avgCost: number }>, executor: IDatabaseExecutor = db): Promise<void> {
    // Delete existing holdings
    await executor.query(`DELETE FROM portfolio_holdings WHERE portfolio_id = $1;`, [portfolioId]);

    // Insert active holdings (quantity > 0)
    for (const [stockId, data] of holdingsMap.entries()) {
      if (data.quantity > 0.00000001) {
        await executor.query(`
          INSERT INTO portfolio_holdings (portfolio_id, stock_id, quantity, average_cost)
          VALUES ($1, $2, $3, $4);
        `, [portfolioId, stockId, data.quantity, data.avgCost]);
      }
    }
  }
}
