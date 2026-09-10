import { db } from '../database/db';

export interface PortfolioRow {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  benchmark_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioTxRow {
  id: string;
  portfolio_id: string;
  stock_id: string | null;
  transaction_type: 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE';
  transaction_date: string;
  quantity: number | null;
  price: number | null;
  amount: number;
  currency: string;
  fee_amount: number;
  fx_rate: number | null;
  notes: string | null;
  created_at: string;
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
      SELECT p.*, b.code as benchmark_code, b.name as benchmark_name
      FROM portfolios p
      LEFT JOIN benchmarks b ON p.benchmark_id = b.id
      WHERE p.id = $1 AND p.user_id = $2;
    `, [id, userId]);
    return res.rows[0] || null;
  }

  static async delete(id: string | number, userId: string): Promise<void> {
    await db.query(`
      DELETE FROM portfolios
      WHERE id = $1 AND user_id = $2;
    `, [id, userId]);
  }

  static async getTransactions(portfolioId: string | number): Promise<PortfolioTxRow[]> {
    const res = await db.query<PortfolioTxRow>(`
      SELECT 
        pt.*,
        s.symbol,
        s.company_name
      FROM portfolio_transactions pt
      LEFT JOIN stocks s ON pt.stock_id = s.id
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
  }): Promise<PortfolioTxRow> {
    const res = await db.query<PortfolioTxRow>(`
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

  static async syncHoldings(portfolioId: string | number, holdingsMap: Map<string | number, { quantity: number; avgCost: number }>): Promise<void> {
    // Delete existing holdings
    await db.query(`DELETE FROM portfolio_holdings WHERE portfolio_id = $1;`, [portfolioId]);

    // Insert active holdings (quantity > 0)
    for (const [stockId, data] of holdingsMap.entries()) {
      if (data.quantity > 0.00000001) {
        await db.query(`
          INSERT INTO portfolio_holdings (portfolio_id, stock_id, quantity, average_cost)
          VALUES ($1, $2, $3, $4);
        `, [portfolioId, stockId, data.quantity, data.avgCost]);
      }
    }
  }
}

