import { db } from '../database/db';

export class WatchlistRepository {
  static async getByUserId(userId: string): Promise<any[]> {
    const res = await db.query(`
      SELECT * FROM watchlists
      WHERE user_id = $1
      ORDER BY created_at ASC;
    `, [userId]);
    return res.rows;
  }

  static async getItems(watchlistId: string | number): Promise<any[]> {
    const res = await db.query(`
      SELECT 
        wi.watchlist_id,
        wi.stock_id,
        wi.added_at,
        s.symbol,
        s.company_name,
        s.currency,
        s.sector,
        e.code as exchange_code,
        e.country_code
      FROM watchlist_items wi
      JOIN stocks s ON wi.stock_id = s.id
      JOIN exchanges e ON s.exchange_id = e.id
      WHERE wi.watchlist_id = $1
      ORDER BY wi.added_at DESC;
    `, [watchlistId]);
    return res.rows;
  }

  static async create(userId: string, name: string): Promise<any> {
    const res = await db.query(`
      INSERT INTO watchlists (user_id, name)
      VALUES ($1, $2)
      RETURNING *;
    `, [userId, name]);
    return res.rows[0];
  }

  static async addItem(watchlistId: string | number, stockId: string | number): Promise<void> {
    await db.query(`
      INSERT INTO watchlist_items (watchlist_id, stock_id)
      VALUES ($1, $2)
      ON CONFLICT (watchlist_id, stock_id) DO NOTHING;
    `, [watchlistId, stockId]);
  }

  static async removeItem(watchlistId: string | number, stockId: string | number): Promise<void> {
    await db.query(`
      DELETE FROM watchlist_items
      WHERE watchlist_id = $1 AND stock_id = $2;
    `, [watchlistId, stockId]);
  }

  static async delete(id: string | number, userId: string): Promise<void> {
    await db.query(`
      DELETE FROM watchlists
      WHERE id = $1 AND user_id = $2;
    `, [id, userId]);
  }
}

