import { db } from '../database/db';

export class MarketAlertRepository {
  static async list(userId: string, stockId?: string | number) {
    const result = await db.query(`
      SELECT a.*, s.symbol, s.display_symbol, s.provider_symbol, s.company_name, s.currency,
             e.code AS exchange_code, e.country_code
      FROM user_market_alerts a
      JOIN stocks s ON s.id = a.stock_id
      JOIN exchanges e ON e.id = s.exchange_id
      WHERE a.user_id = $1 AND ($2::bigint IS NULL OR a.stock_id = $2)
      ORDER BY a.created_at DESC, a.id DESC
    `, [userId, stockId ?? null]);
    return result.rows;
  }

  static async create(userId: string, data: { stockId: string | number; condition: string; threshold: number; enabled?: boolean }) {
    const result = await db.query(`
      INSERT INTO user_market_alerts (user_id, stock_id, condition, threshold, enabled)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `, [userId, data.stockId, data.condition, data.threshold, data.enabled ?? true]);
    return result.rows[0];
  }

  static async update(id: string | number, userId: string, data: { condition?: string; threshold?: number; enabled?: boolean }) {
    const result = await db.query(`
      UPDATE user_market_alerts
      SET condition = COALESCE($3, condition), threshold = COALESCE($4, threshold),
          enabled = COALESCE($5, enabled), updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId, data.condition ?? null, data.threshold ?? null, data.enabled ?? null]);
    return result.rows[0] || null;
  }

  static async delete(id: string | number, userId: string): Promise<boolean> {
    const result = await db.query('DELETE FROM user_market_alerts WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    return result.rows.length > 0;
  }
}
