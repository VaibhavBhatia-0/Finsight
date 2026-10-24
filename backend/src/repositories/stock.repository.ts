import { db } from '../database/db';
import type { ScreenerFilters } from '../validators/market.validator';

/**
 * Widely held large caps across the four markets, listed first when browsing so the opening page shows companies
 * with deep, reliable price history rather than whichever tickers sort first alphabetically.
 */
export const FEATURED_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'RELIANCE', 'TCS', 'HDFCBANK', 'TSLA',
  'INFY', 'ICICIBANK', 'JPM', 'V', 'UNH', 'BHARTIARTL', 'AVGO', 'SBIN', 'LLY', 'WMT',
  'ITC', 'MA', 'LT', 'XOM', 'HINDUNILVR', 'JNJ', 'COST', 'KOTAKBANK', 'NFLX', 'AXISBANK', 'BAJFINANCE',
];

/** Everyday names people search for that appear in neither the ticker nor the listed company name. */
const SEARCH_ALIASES: Record<string, string> = {
  UHG: 'UNH', UNITEDHEALTHCARE: 'UNH', GOOGLE: 'GOOGL', ALPHABET: 'GOOGL', FACEBOOK: 'META',
  HDFC: 'HDFCBANK', SBI: 'SBIN', AIRTEL: 'BHARTIARTL', 'L&T': 'LT', HUL: 'HINDUNILVR', KOTAK: 'KOTAKBANK',
};

/** The search text in the forms the queries compare against: as typed, without spaces, and any ticker alias. */
function searchTerms(raw: string) {
  const query = raw.trim().toUpperCase();
  const compact = query.replace(/[\s.,'-]+/g, '');
  const alias = SEARCH_ALIASES[compact]
    ?? Object.entries(SEARCH_ALIASES).find(([name]) => name.length >= 6 && compact.startsWith(name))?.[1]
    ?? '';
  return { query, compact, alias };
}

/** Sort key that lists featured companies first (primary listings before their BSE duplicates). `$n` holds FEATURED_SYMBOLS. */
function featuredRank(param: string) {
  return `COALESCE(array_position(${param}::text[], UPPER(s.symbol)), 100000) + CASE WHEN e.code = 'BSE' THEN 50000 ELSE 0 END`;
}

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
  sortBy?: 'popular' | 'symbol' | 'company';
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
    const terms = filters.q?.trim() ? searchTerms(filters.q) : null;
    if (terms) {
      params.push(`%${terms.query}%`, `%${terms.compact}%`, terms.alias);
      const [like, compact, alias] = [params.length - 2, params.length - 1, params.length];
      clauses.push(`(UPPER(s.symbol) LIKE $${like} OR UPPER(s.company_name) LIKE $${like} OR UPPER(s.display_symbol) LIKE $${like}
        OR REPLACE(UPPER(s.company_name), ' ', '') LIKE $${compact} OR UPPER(s.symbol) = $${alias})`);
    }
    if (filters.exchange) { params.push(filters.exchange.toUpperCase()); clauses.push(`UPPER(e.code) = $${params.length}`); }
    if (filters.country) { params.push(filters.country.toUpperCase()); clauses.push(`UPPER(e.country_code) = $${params.length}`); }
    if (filters.sector) { params.push(filters.sector.toUpperCase()); clauses.push(`UPPER(s.sector) = $${params.length}`); }
    const where = clauses.join(' AND ');
    const count = await db.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM stocks s JOIN exchanges e ON s.exchange_id = e.id WHERE ${where}`, params);
    const total = Number(count.rows[0]?.total || 0);
    const sortOrder = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';
    let ordering = `${filters.sortBy === 'company' ? 's.company_name' : 's.symbol'} ${sortOrder}`;
    if (filters.sortBy === 'popular') {
      // An exact ticker (or alias) match leads a search; otherwise featured companies come first, then A to Z.
      let exact = '';
      if (terms) {
        params.push(terms.query, terms.alias);
        exact = `CASE WHEN UPPER(s.symbol) IN ($${params.length - 1}, $${params.length}) THEN 0 ELSE 1 END, `;
      }
      params.push(FEATURED_SYMBOLS);
      ordering = `${exact}${featuredRank(`$${params.length}`)}, s.symbol ASC`;
    }
    params.push(limit, (page - 1) * limit);
    const result = await db.query<StockRow>(`
      SELECT s.*, e.code AS exchange_code, e.name AS exchange_name, e.country_code
      FROM stocks s JOIN exchanges e ON s.exchange_id = e.id
      WHERE ${where}
      ORDER BY ${ordering}, s.id ASC
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
      WHERE UPPER(s.symbol) = UPPER($1)
         OR UPPER(s.display_symbol) = UPPER($1)
         OR UPPER(s.provider_symbol) = UPPER($1)
      ORDER BY CASE WHEN UPPER(s.provider_symbol) = UPPER($1) THEN 0 ELSE 1 END, s.id
      LIMIT 1;
    `, [symbol]);
    return res.rows[0] || null;
  }

  static async searchSecurities(filters: { q: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(50, filters.pageSize || 20));
    const { query, compact, alias } = searchTerms(filters.q);
    if (!query) return { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
    const contains = `%${query}%`;
    const prefix = `${query}%`;
    // $1 and $2 are shared by the count and the page query; $6 onward are only used for ordering.
    const where = `s.is_active = TRUE AND (
      UPPER(s.symbol) LIKE $1 OR UPPER(s.display_symbol) LIKE $1 OR UPPER(s.provider_symbol) LIKE $1
      OR UPPER(s.company_name) LIKE $1 OR UPPER(e.code) LIKE $1 OR UPPER(e.name) LIKE $1
      OR UPPER(e.country_code) LIKE $1
      OR REPLACE(UPPER(s.company_name), ' ', '') LIKE $2 OR UPPER(s.symbol) = $3
    )`;
    const shared = [contains, `%${compact}%`, alias];
    const count = await db.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM stocks s JOIN exchanges e ON e.id = s.exchange_id WHERE ${where}`, shared);
    const total = Number(count.rows[0]?.total || 0);
    const result = await db.query(`
      SELECT s.id, s.symbol, s.display_symbol, s.provider_symbol, s.company_name AS name,
             e.code AS exchange, e.country_code AS country, s.currency, s.asset_type
      FROM stocks s JOIN exchanges e ON e.id = s.exchange_id
      WHERE ${where}
      ORDER BY CASE
        WHEN UPPER(s.provider_symbol) = $4 OR UPPER(s.symbol) = $4 OR UPPER(s.display_symbol) = $4 OR UPPER(s.symbol) = $3 THEN 0
        WHEN UPPER(s.provider_symbol) LIKE $5 OR UPPER(s.symbol) LIKE $5 OR UPPER(s.display_symbol) LIKE $5 THEN 1
        WHEN UPPER(s.company_name) LIKE $5 THEN 2 ELSE 3 END,
        ${featuredRank('$8')}, s.symbol, e.code, s.id
      LIMIT $6 OFFSET $7
    `, [...shared, query, prefix, pageSize, (page - 1) * pageSize, FEATURED_SYMBOLS]);
    return { items: result.rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  static async universeStats() {
    const result = await db.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE s.is_active)::int AS active,
             COUNT(*) FILTER (WHERE e.code = 'NSE' AND s.is_active)::int AS nse,
             COUNT(*) FILTER (WHERE e.country_code = 'US' AND s.is_active)::int AS us,
             COUNT(*) FILTER (WHERE e.country_code NOT IN ('IN','US') AND s.is_active)::int AS other
      FROM stocks s JOIN exchanges e ON e.id = s.exchange_id
    `);
    const exchanges = await db.query(`SELECT e.code, e.country_code, COUNT(*)::int AS count FROM stocks s JOIN exchanges e ON e.id=s.exchange_id WHERE s.is_active GROUP BY e.code,e.country_code ORDER BY e.code`);
    const assetTypes = await db.query(`SELECT asset_type, COUNT(*)::int AS count FROM stocks WHERE is_active GROUP BY asset_type ORDER BY asset_type`);
    // Feeds the screener's sector suggestions; only sectors that actually have listings are offered.
    const sectors = await db.query(`SELECT sector, COUNT(*)::int AS count FROM stocks WHERE is_active AND sector IS NOT NULL AND TRIM(sector) <> '' GROUP BY sector ORDER BY count DESC, sector LIMIT 60`);
    return { ...result.rows[0], exchanges: exchanges.rows, assetTypes: assetTypes.rows, sectors: sectors.rows };
  }

  static async screen(filters: ScreenerFilters) {
    const clauses = ['s.is_active = TRUE'];
    const params: unknown[] = [];
    const addText = (column: string, value?: string) => { if (value) { params.push(value.toUpperCase()); clauses.push(`UPPER(${column}) = $${params.length}`); } };
    const addNumber = (column: string, value: number | undefined, operator: '>=' | '<=') => { if (value !== undefined) { params.push(value); clauses.push(`${column} ${operator} $${params.length}`); } };
    addText('e.code', filters.exchange);
    addText('e.country_code', filters.country);
    addText('s.sector', filters.sector);
    addNumber('lp.close_price', filters.minPrice, '>='); addNumber('lp.close_price', filters.maxPrice, '<=');
    addNumber('f.pe_ratio', filters.minPe, '>='); addNumber('f.pe_ratio', filters.maxPe, '<=');
    addNumber('f.eps', filters.minEps, '>='); addNumber('f.eps', filters.maxEps, '<=');
    addNumber('f.dividend_yield', filters.minDivYield, '>='); addNumber('f.dividend_yield', filters.maxDivYield, '<=');
    addNumber('f.market_cap', filters.minMarketCap, '>='); addNumber('f.market_cap', filters.maxMarketCap, '<=');
    addNumber('f.revenue', filters.minRevenue, '>='); addNumber('f.revenue', filters.maxRevenue, '<=');
    addNumber('f.net_income', filters.minProfit, '>='); addNumber('f.net_income', filters.maxProfit, '<=');
    addNumber('f.total_debt', filters.minDebt, '>='); addNumber('f.total_debt', filters.maxDebt, '<=');
    addNumber('lp.volume', filters.minVolume, '>='); addNumber('lp.volume', filters.maxVolume, '<=');
    addNumber('pm.annualized_volatility', filters.maxVolatility, '<=');
    if (filters.minRsi !== undefined || filters.maxRsi !== undefined || filters.minYearPosition !== undefined || filters.maxYearPosition !== undefined || filters.movingAverageRelation) clauses.push('FALSE');
    const sortColumns: Record<ScreenerFilters['sortBy'], string> = {
      popular: 'NULL', symbol: 's.symbol', name: 's.company_name', price: 'lp.close_price', marketCap: 'f.market_cap', peRatio: 'f.pe_ratio', eps: 'f.eps',
      dividendYield: 'f.dividend_yield', revenue: 'f.revenue', profit: 'f.net_income', debt: 'f.total_debt', volume: 'lp.volume', volatility: 'pm.annualized_volatility', rsi14: 'NULL', yearPosition: 'NULL',
    };
    const where = clauses.join(' AND ');
    const ctes = `WITH latest_fundamentals AS (
      SELECT DISTINCT ON (stock_id) * FROM fundamentals ORDER BY stock_id, period_end DESC, id DESC
    ), latest_prices AS (
      SELECT DISTINCT ON (stock_id) * FROM price_history ORDER BY stock_id, trading_date DESC, id DESC
    ), price_returns AS (
      SELECT stock_id, close_price / NULLIF(LAG(close_price) OVER (PARTITION BY stock_id ORDER BY trading_date), 0) - 1 AS daily_return
      FROM price_history WHERE trading_date >= CURRENT_DATE - INTERVAL '400 days'
    ), price_metrics AS (
      SELECT stock_id, STDDEV_SAMP(daily_return) * SQRT(252) * 100 AS annualized_volatility
      FROM price_returns WHERE daily_return IS NOT NULL GROUP BY stock_id
    )`;
    const joins = `FROM stocks s JOIN exchanges e ON e.id=s.exchange_id LEFT JOIN latest_fundamentals f ON f.stock_id=s.id LEFT JOIN latest_prices lp ON lp.stock_id=s.id LEFT JOIN price_metrics pm ON pm.stock_id=s.id`;
    const count = await db.query<{ total: string }>(`${ctes} SELECT COUNT(*)::text AS total ${joins} WHERE ${where}`, params);
    const page = filters.page;
    const limit = filters.limit;
    const total = Number(count.rows[0]?.total || 0);
    params.push(limit, (page - 1) * limit);
    const order = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    // Postgres rejects a constant ORDER BY term, so sorts with no stored column fall straight through to the featured order.
    const primarySort = sortColumns[filters.sortBy] === 'NULL' ? '' : `${sortColumns[filters.sortBy]} ${order} NULLS LAST, `;
    const result = await db.query(`
      ${ctes}
      SELECT s.*, e.code AS exchange_code, e.name AS exchange_name, e.country_code,
             lp.close_price AS screened_price, lp.volume AS screened_volume,
             f.market_cap, f.pe_ratio, f.eps, f.dividend_yield, f.revenue, f.net_income, f.total_debt,
             pm.annualized_volatility,
             f.source AS fundamentals_source, f.source_timestamp AS fundamentals_timestamp
      ${joins} WHERE ${where}
      ORDER BY ${primarySort}${featuredRank(`$${params.length + 1}`)}, s.symbol ASC, s.id ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, [...params, FEATURED_SYMBOLS]);
    return { items: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) };
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
