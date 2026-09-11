import { db, IDatabaseExecutor } from '../database/db';

export interface UserPreferencesRow {
  id: string;
  user_id: string;
  theme: string;
  default_currency: string;
  default_benchmark_id: string | null;
  dashboard_layout: { sections?: Array<{ id: string; order: number; visible: boolean }> };
  selected_market_indices: string[];
  watchlist_preferences: { sortBy?: 'symbol' | 'company_name' | 'added_at'; sortOrder?: 'asc' | 'desc' };
  tax_residency: 'IN' | 'US' | null;
  tax_status: string | null;
  created_at: string;
  updated_at: string;
}

export class UserPreferencesRepository {
  static async createDefault(userId: string, defaultCurrency: string = 'INR', executor: IDatabaseExecutor = db): Promise<UserPreferencesRow> {
    // Look up default benchmark (e.g. NIFTY_50 for INR, SP500 for USD)
    const benchmarkRes = await executor.query(
      `SELECT id FROM benchmarks WHERE code = $1 LIMIT 1;`,
      [defaultCurrency === 'USD' ? 'SP500' : 'NIFTY_50']
    );
    const benchmarkId = benchmarkRes.rows[0]?.id || null;

    const defaultLayout = {
      sections: [
        { id: 'summary', order: 1, visible: true },
        { id: 'watchlist', order: 2, visible: true },
        { id: 'indices', order: 3, visible: true },
        { id: 'insights', order: 4, visible: true },
        { id: 'labLaunch', order: 5, visible: true },
      ],
    };

    const defaultIndices = ['NIFTY_50', 'SENSEX', 'SP500', 'NASDAQ_COMP'];

    const res = await executor.query<UserPreferencesRow>(
      `INSERT INTO user_preferences (
        user_id, theme, default_currency, default_benchmark_id,
        dashboard_layout, selected_market_indices, watchlist_preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;`,
      [
        userId,
        'system',
        defaultCurrency,
        benchmarkId,
        JSON.stringify(defaultLayout),
        JSON.stringify(defaultIndices),
        JSON.stringify({ sortBy: 'symbol', sortOrder: 'asc' }),
      ]
    );

    return res.rows[0];
  }

  static async getByUserId(userId: string): Promise<UserPreferencesRow | null> {
    const res = await db.query<UserPreferencesRow>(
      `SELECT * FROM user_preferences WHERE user_id = $1;`,
      [userId]
    );
    return res.rows[0] || null;
  }

  static async update(
    userId: string,
    updates: Partial<{
      theme: string;
      default_currency: string;
      default_benchmark_id: string | null;
      dashboard_layout: UserPreferencesRow['dashboard_layout'];
      selected_market_indices: UserPreferencesRow['selected_market_indices'];
      watchlist_preferences: UserPreferencesRow['watchlist_preferences'];
      tax_residency: UserPreferencesRow['tax_residency'];
      tax_status: UserPreferencesRow['tax_status'];
    }>
  ): Promise<UserPreferencesRow> {
    const current = await this.getByUserId(userId);
    if (!current) {
      throw new Error(`Preferences for user ${userId} not found`);
    }

    const theme = updates.theme ?? current.theme;
    const defaultCurrency = updates.default_currency ?? current.default_currency;
    const defaultBenchmarkId = updates.default_benchmark_id !== undefined ? updates.default_benchmark_id : current.default_benchmark_id;
    const dashboardLayout = updates.dashboard_layout ? JSON.stringify(updates.dashboard_layout) : current.dashboard_layout;
    const selectedIndices = updates.selected_market_indices ? JSON.stringify(updates.selected_market_indices) : current.selected_market_indices;
    const watchlistPrefs = updates.watchlist_preferences ? JSON.stringify(updates.watchlist_preferences) : current.watchlist_preferences;
    const taxResidency = updates.tax_residency !== undefined ? updates.tax_residency : current.tax_residency;
    const taxStatus = updates.tax_status !== undefined ? updates.tax_status : current.tax_status;

    const res = await db.query<UserPreferencesRow>(
      `UPDATE user_preferences
       SET theme = $1,
           default_currency = $2,
           default_benchmark_id = $3,
           dashboard_layout = $4,
           selected_market_indices = $5,
           watchlist_preferences = $6,
           tax_residency = $7,
           tax_status = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $9
       RETURNING *;`,
      [
        theme,
        defaultCurrency,
        defaultBenchmarkId,
        dashboardLayout,
        selectedIndices,
        watchlistPrefs,
        taxResidency,
        taxStatus,
        userId,
      ]
    );

    return res.rows[0];
  }
}
