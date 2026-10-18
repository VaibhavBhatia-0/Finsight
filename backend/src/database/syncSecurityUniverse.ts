import { getDatabaseClient, type IDatabaseClient } from './db';
import {
  downloadDirectoryDocuments, prepareSecurityUniverse,
  type DirectoryDocuments, type ExchangeCode, type PreparedUniverse, type SecurityInput,
} from './securityUniverseCatalog';

interface ExistingSecurity {
  id: string;
  symbol: string;
  exchange: ExchangeCode;
  display_symbol: string;
  provider_symbol: string;
  company_name: string;
  currency: string;
  asset_type: string;
  is_active: boolean;
}

export interface UniverseSyncResult {
  source: 'NSE_AND_NASDAQ_OFFICIAL_DIRECTORIES';
  sha256: string;
  sourceCounts: Record<ExchangeCode, number>;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  rejected: number;
  databaseCounts: Record<ExchangeCode, number>;
}

export async function syncSecurityUniverse(
  client: IDatabaseClient = getDatabaseClient(),
  options: { documents?: DirectoryDocuments; expectedSha256?: string; minimumCounts?: Record<ExchangeCode, number>; minimumTotal?: number } = {},
): Promise<UniverseSyncResult> {
  const prepared = prepareSecurityUniverse(
    options.documents || await downloadDirectoryDocuments(), options.minimumCounts, options.minimumTotal,
  );
  if (!options.expectedSha256 || options.expectedSha256 !== prepared.sha256) {
    throw new Error('Directory fingerprint differs from the approved dry run; no securities were imported');
  }

  return client.transaction(async executor => {
    const exchanges = await executor.query<{ id: string; code: ExchangeCode }>(
      "SELECT id, code FROM exchanges WHERE code IN ('NSE', 'NASDAQ', 'NYSE')",
    );
    if (exchanges.rows.length !== 3) throw new Error('NSE, NASDAQ, and NYSE reference exchanges are required before import');

    const existing = await executor.query<ExistingSecurity>(`
      SELECT s.id, s.symbol, e.code AS exchange, s.display_symbol, s.provider_symbol,
             s.company_name, s.currency, s.asset_type, s.is_active
      FROM stocks s JOIN exchanges e ON e.id = s.exchange_id
      WHERE e.code IN ('NSE', 'NASDAQ', 'NYSE')
    `);
    const byKey = new Map(existing.rows.map(row => [`${row.exchange}:${row.symbol}`, row]));
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (let offset = 0; offset < prepared.securities.length; offset += 250) {
      const batch = prepared.securities.slice(offset, offset + 250);
      const changed = batch.filter(security => {
        const previous = byKey.get(`${security.exchange}:${security.symbol}`);
        if (!previous) return true;
        const same = previous.display_symbol === security.displaySymbol
          && previous.provider_symbol === security.providerSymbol
          && previous.company_name === security.companyName
          && previous.currency.trim() === security.currency
          && previous.asset_type === security.assetType && previous.is_active;
        if (same) skipped += 1;
        return !same;
      });
      if (!changed.length) continue;
      const response = await executor.query<{ symbol: string; exchange: ExchangeCode }>(`
        INSERT INTO stocks (
          symbol, display_symbol, provider_symbol, exchange_id, exchange,
          company_name, currency, asset_type, is_active
        )
        SELECT incoming.symbol, incoming.display_symbol, incoming.provider_symbol,
               e.id, e.code, incoming.company_name, incoming.currency, incoming.asset_type, TRUE
        FROM jsonb_to_recordset($1::jsonb) AS incoming (
          symbol text, display_symbol text, provider_symbol text,
          company_name text, exchange text, currency text, asset_type text
        )
        JOIN exchanges e ON e.code = incoming.exchange
        ON CONFLICT (symbol, exchange_id) DO UPDATE SET
          display_symbol = EXCLUDED.display_symbol,
          provider_symbol = EXCLUDED.provider_symbol,
          company_name = EXCLUDED.company_name,
          currency = EXCLUDED.currency,
          asset_type = EXCLUDED.asset_type,
          is_active = TRUE
        RETURNING symbol, exchange
      `, [JSON.stringify(changed.map(databaseInput))]);
      if (response.rows.length !== changed.length) throw new Error('Security import wrote fewer records than validated');
      for (const row of response.rows) {
        if (byKey.has(`${row.exchange}:${row.symbol}`)) updated += 1;
        else inserted += 1;
      }
    }

    const verified = await verifyImported(executor, prepared);
    await executor.query(
      'INSERT INTO security_universe_syncs (source, security_count, source_timestamp) VALUES ($1, $2, $3)',
      ['NSE_AND_NASDAQ_OFFICIAL_DIRECTORIES', prepared.securities.length, new Date().toISOString()],
    );
    return {
      source: 'NSE_AND_NASDAQ_OFFICIAL_DIRECTORIES', sha256: prepared.sha256,
      sourceCounts: prepared.counts, total: prepared.securities.length,
      inserted, updated, skipped, rejected: prepared.rejected,
      databaseCounts: verified,
    };
  });
}

function databaseInput(input: SecurityInput) {
  return {
    symbol: input.symbol, display_symbol: input.displaySymbol,
    provider_symbol: input.providerSymbol, company_name: input.companyName,
    exchange: input.exchange, currency: input.currency, asset_type: input.assetType,
  };
}

async function verifyImported(
  executor: Pick<IDatabaseClient, 'query'>,
  prepared: PreparedUniverse,
): Promise<Record<ExchangeCode, number>> {
  for (let offset = 0; offset < prepared.securities.length; offset += 250) {
    const batch = prepared.securities.slice(offset, offset + 250);
    const result = await executor.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM jsonb_to_recordset($1::jsonb) AS incoming (
        symbol text, display_symbol text, provider_symbol text,
        company_name text, exchange text, currency text, asset_type text
      )
      JOIN exchanges e ON e.code = incoming.exchange
      JOIN stocks s ON s.symbol = incoming.symbol AND s.exchange_id = e.id
      WHERE s.display_symbol = incoming.display_symbol
        AND s.provider_symbol = incoming.provider_symbol
        AND s.company_name = incoming.company_name
        AND s.currency = incoming.currency
        AND s.asset_type = incoming.asset_type AND s.is_active
    `, [JSON.stringify(batch.map(databaseInput))]);
    if (result.rows[0]?.count !== batch.length) throw new Error('Security import verification failed; transaction rolled back');
  }
  const counts: Record<ExchangeCode, number> = { NSE: 0, NASDAQ: 0, NYSE: 0 };
  const result = await executor.query<{ code: ExchangeCode; count: number }>(`
    SELECT e.code, COUNT(*)::int AS count FROM stocks s
    JOIN exchanges e ON e.id = s.exchange_id
    WHERE s.is_active AND e.code IN ('NSE', 'NASDAQ', 'NYSE')
    GROUP BY e.code
  `);
  for (const row of result.rows) counts[row.code] = row.count;
  for (const exchange of ['NSE', 'NASDAQ', 'NYSE'] as const) {
    if (counts[exchange] < prepared.counts[exchange]) throw new Error('Security catalogue count verification failed');
  }
  return counts;
}

async function runCli() {
  const args = process.argv.slice(2);
  const dryRun = args.length === 1 && args[0] === '--dry-run';
  const apply = args[0] === '--apply' && args.length === 2 && args[1].startsWith('--expect-sha256=');
  if (!dryRun && !apply) {
    throw new Error('Run --dry-run first; then use --apply --expect-sha256=<sha256> after reviewing the result');
  }
  const documents = await downloadDirectoryDocuments();
  const prepared = prepareSecurityUniverse(documents);
  if (dryRun) {
    console.log(JSON.stringify({ mode: 'dry-run', total: prepared.securities.length, sourceCounts: prepared.counts,
      skipped: prepared.skipped, rejected: prepared.rejected, sha256: prepared.sha256 }));
    return;
  }
  const client = getDatabaseClient();
  try {
    const result = await syncSecurityUniverse(client, {
      documents, expectedSha256: args[1].slice('--expect-sha256='.length),
    });
    console.log(JSON.stringify({ mode: 'apply', ...result }));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  runCli().catch(error => {
    console.error(`[Universe] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
