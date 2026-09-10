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

  static async addItem(watchlistId: string | number, stockId: string | number, userId: string): Promise<boolean> {
    const result = await db.query<{ owned: boolean }>(`
      WITH owned AS (
        SELECT id FROM watchlists WHERE id = $1 AND user_id = $3
      ), inserted AS (
        INSERT INTO watchlist_items (watchlist_id, stock_id)
        SELECT id, $2 FROM owned
        ON CONFLICT (watchlist_id, stock_id) DO NOTHING
        RETURNING 1
      )
      SELECT EXISTS(SELECT 1 FROM owned) AS owned;
    `, [watchlistId, stockId, userId]);
    return Boolean(result.rows[0]?.owned);
  }

  static async removeItem(watchlistId: string | number, stockId: string | number, userId: string): Promise<boolean> {
    const result = await db.query<{ owned: boolean }>(`
      WITH owned AS (
        SELECT id FROM watchlists WHERE id = $1 AND user_id = $3
      ), deleted AS (
        DELETE FROM watchlist_items
        WHERE watchlist_id IN (SELECT id FROM owned) AND stock_id = $2
        RETURNING 1
      )
      SELECT EXISTS(SELECT 1 FROM owned) AS owned;
    `, [watchlistId, stockId, userId]);
    return Boolean(result.rows[0]?.owned);
  }

  static async delete(id: string | number, userId: string): Promise<void> {
    await db.query(`
      DELETE FROM watchlists
      WHERE id = $1 AND user_id = $2;
    `, [id, userId]);
  }
}
