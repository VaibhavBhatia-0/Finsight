import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import type { IDatabaseClient, IDatabaseExecutor } from '../../src/database/db';
import { prepareSecurityUniverse, type DirectoryDocuments } from '../../src/database/securityUniverseCatalog';
import { syncSecurityUniverse } from '../../src/database/syncSecurityUniverse';

const documents: DirectoryDocuments = {
  nse: 'SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nRELIANCE,Reliance Industries Limited,EQ,INE002A01018\nCOLLIDE,Indian Example Ltd.,EQ,INE123456789\nFUND,Example Nifty ETF,EQ,INF123456789\nIGNORED,Other Series Ltd.,BE,INE987654321\n',
  nasdaq: 'Symbol|Security Name|Test Issue|ETF\nAAPL|Apple Inc. - Common Stock|N|N\nCOLLIDE|US Example Inc.|N|N\nAACIW|Example Acquisition - Warrant|N|N\nETFTEST|Example Fund|N|Y\nFile Creation Time: 12:00||||\n',
  otherUs: 'ACT Symbol|Security Name|Exchange|Test Issue|ETF\nBRK.B|Berkshire Hathaway Inc.|N|N|N\nOTC|Other Exchange Inc.|A|N|N\nFile Creation Time: 12:00||||\n',
};
const minimumCounts = { NSE: 2, NASDAQ: 2, NYSE: 1 };

describe('complete catalogue import against isolated PostgreSQL', () => {
  let pg: PGlite;
  let client: IDatabaseClient;

  beforeAll(async () => {
    pg = new PGlite();
    client = {
      query: async (sql, params) => {
        const result = await pg.query(sql, params);
        return { rows: result.rows, rowCount: result.rows.length };
      },
      exec: sql => pg.exec(sql),
      close: () => pg.close(),
      getDriverName: () => 'isolated PGlite',
      transaction: callback => pg.transaction(async transaction => callback({
        query: async (sql, params) => {
          const result = await transaction.query(sql, params);
          return { rows: result.rows, rowCount: result.rows.length };
        },
        exec: sql => transaction.exec(sql),
      } as IDatabaseExecutor)),
    } as IDatabaseClient;
    const directory = path.resolve(__dirname, '../../../database/migrations');
    for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
      await pg.exec(fs.readFileSync(path.join(directory, file), 'utf8'));
    }
  });

  afterAll(async () => { if (pg) await pg.close(); });

  it('imports all supported records, preserves exchange collisions, and changes no observations', async () => {
    const prepared = prepareSecurityUniverse(documents, minimumCounts, 6);
    expect(prepared).toMatchObject({ counts: { NSE: 2, NASDAQ: 3, NYSE: 1 }, rejected: 0 });
    expect(prepared.securities.some(row => row.symbol === 'FUND')).toBe(false);
    expect(prepared.securities.find(row => row.symbol === 'AACIW')?.assetType).toBe('WARRANT');
    expect(prepared.securities.find(row => row.symbol === 'BRK.B')?.assetType).toBe('UNCLASSIFIED');
    const before = await pg.query<{ id: string }>("SELECT id FROM stocks WHERE symbol='AAPL'");
    await pg.exec(`
      INSERT INTO users (id, email, password_hash) VALUES ('11111111-1111-4111-8111-111111111111', 'catalogue-test@example.invalid', 'test-only');
      INSERT INTO portfolios (user_id, name) VALUES ('11111111-1111-4111-8111-111111111111', 'Existing portfolio');
      INSERT INTO watchlists (user_id, name) VALUES ('11111111-1111-4111-8111-111111111111', 'Existing watchlist');
      INSERT INTO portfolio_transactions (portfolio_id, stock_id, transaction_type, transaction_date, quantity, price, amount, currency)
        SELECT p.id, s.id, 'BUY', '2024-01-15', 2, 100, 200, 'USD' FROM portfolios p CROSS JOIN stocks s
        WHERE p.name = 'Existing portfolio' AND s.symbol = 'AAPL';
      INSERT INTO watchlist_items (watchlist_id, stock_id)
        SELECT w.id, s.id FROM watchlists w CROSS JOIN stocks s
        WHERE w.name = 'Existing watchlist' AND s.symbol = 'AAPL';
    `);
    const result = await syncSecurityUniverse(client, { documents, minimumCounts, minimumTotal: 6, expectedSha256: prepared.sha256 });
    expect(result).toMatchObject({ total: 6, inserted: 4, updated: 1, skipped: 1, rejected: 0 });
    const collisions = await pg.query<{ exchange: string }>("SELECT exchange FROM stocks WHERE symbol='COLLIDE' ORDER BY exchange");
    expect(collisions.rows.map(row => row.exchange)).toEqual(['NASDAQ', 'NSE']);
    const after = await pg.query<{ id: string }>("SELECT id FROM stocks WHERE symbol='AAPL'");
    expect(after.rows[0].id).toBe(before.rows[0].id);
    const references = await pg.query<{ transaction_stock_id: string; watchlist_stock_id: string }>(`
      SELECT t.stock_id AS transaction_stock_id, w.stock_id AS watchlist_stock_id
      FROM portfolio_transactions t CROSS JOIN watchlist_items w
    `);
    expect(references.rows).toEqual([{ transaction_stock_id: before.rows[0].id, watchlist_stock_id: before.rows[0].id }]);
    const observations = await pg.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM price_history');
    expect(observations.rows[0].count).toBe(0);
  });

  it('is idempotent and records the verified source count', async () => {
    const prepared = prepareSecurityUniverse(documents, minimumCounts, 6);
    const second = await syncSecurityUniverse(client, { documents, minimumCounts, minimumTotal: 6, expectedSha256: prepared.sha256 });
    expect(second).toMatchObject({ total: 6, inserted: 0, updated: 0, skipped: 6, rejected: 0 });
    const duplicates = await pg.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM (
        SELECT symbol, exchange_id FROM stocks GROUP BY symbol, exchange_id HAVING COUNT(*) > 1
      ) repeated
    `);
    expect(duplicates.rows[0].count).toBe(0);
    const syncs = await pg.query<{ security_count: number }>('SELECT security_count FROM security_universe_syncs');
    expect(syncs.rows.map(row => row.security_count)).toEqual([6, 6]);
  });

  it('rejects changed or incomplete sources before modifying the database', async () => {
    const before = await pg.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM stocks');
    await expect(syncSecurityUniverse(client, {
      documents, minimumCounts, minimumTotal: 6, expectedSha256: 'wrong-fingerprint',
    })).rejects.toThrow('fingerprint differs');
    const incomplete = { ...documents, nasdaq: 'Symbol|Security Name|Test Issue|ETF\nAAPL|Apple Inc.|N|N\n' };
    await expect(syncSecurityUniverse(client, {
      documents: incomplete, minimumCounts, minimumTotal: 6, expectedSha256: 'wrong-fingerprint',
    })).rejects.toThrow('validation failed');
    const after = await pg.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM stocks');
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });
});
