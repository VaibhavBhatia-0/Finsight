import { getDatabaseClient, type IDatabaseClient } from './db';

interface SecurityInput {
  symbol: string;
  displaySymbol: string;
  providerSymbol: string;
  companyName: string;
  exchange: 'NSE' | 'NASDAQ' | 'NYSE';
  currency: 'INR' | 'USD';
}

const SOURCES = {
  NSE: 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
  NASDAQ: 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',
  OTHER_US: 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt',
} as const;

export async function syncSecurityUniverse(client: IDatabaseClient = getDatabaseClient()): Promise<{ india: number; us: number; total: number }> {
  const [nseText, nasdaqText, otherUsText] = await Promise.all([
    download(SOURCES.NSE), download(SOURCES.NASDAQ), download(SOURCES.OTHER_US),
  ]);
  const securities = dedupe([...parseNse(nseText), ...parseNasdaq(nasdaqText), ...parseOtherUs(otherUsText)]);
  const exchangeRows = await client.query<{ id: string; code: string }>('SELECT id, code FROM exchanges WHERE code IN ($1, $2, $3)', ['NSE', 'NASDAQ', 'NYSE']);
  const exchangeIds = new Map(exchangeRows.rows.map(row => [row.code, row.id]));
  if (exchangeIds.size !== 3) throw new Error('NSE, NASDAQ, and NYSE exchanges must be seeded before syncing the security universe');

  await client.transaction(async executor => {
    for (const security of securities) {
      await executor.query(`
        INSERT INTO stocks (
          symbol, display_symbol, provider_symbol, exchange_id, exchange,
          company_name, currency, asset_type, is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'EQUITY',TRUE)
        ON CONFLICT (symbol, exchange_id) DO UPDATE SET
          display_symbol = EXCLUDED.display_symbol,
          provider_symbol = EXCLUDED.provider_symbol,
          company_name = EXCLUDED.company_name,
          currency = EXCLUDED.currency,
          asset_type = 'EQUITY',
          is_active = TRUE
      `, [
        security.symbol, security.displaySymbol, security.providerSymbol,
        exchangeIds.get(security.exchange), security.exchange, security.companyName, security.currency,
      ]);
    }
    await executor.query(
      'INSERT INTO security_universe_syncs (source, security_count, source_timestamp) VALUES ($1, $2, $3)',
      ['NSE_AND_NASDAQ_OFFICIAL_DIRECTORIES', securities.length, new Date().toISOString()],
    );
  });

  const india = securities.filter(item => item.exchange === 'NSE').length;
  const us = securities.length - india;
  return { india, us, total: securities.length };
}

async function download(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'text/csv,text/plain,*/*', 'User-Agent': 'FinSight/1.0 personal-research-workspace' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Security universe source failed with HTTP ${response.status}: ${new URL(url).hostname}`);
  return response.text();
}

function parseNse(text: string): SecurityInput[] {
  const rows = parseCsv(text);
  const header = rows.shift()?.map(value => value.trim().toUpperCase()) ?? [];
  const symbolIndex = header.indexOf('SYMBOL');
  const nameIndex = header.indexOf('NAME OF COMPANY');
  const seriesIndex = header.indexOf('SERIES');
  if (symbolIndex < 0 || nameIndex < 0) throw new Error('Unexpected NSE equity directory format');
  return rows.flatMap(row => {
    const symbol = cleanSymbol(row[symbolIndex]);
    const name = cleanName(row[nameIndex]);
    if (!symbol || !name || (seriesIndex >= 0 && row[seriesIndex]?.trim().toUpperCase() !== 'EQ')) return [];
    return [{ symbol, displaySymbol: symbol, providerSymbol: `${symbol}.NS`, companyName: name, exchange: 'NSE' as const, currency: 'INR' as const }];
  });
}

function parseNasdaq(text: string): SecurityInput[] {
  const rows = parsePipe(text);
  const header = rows.shift() ?? [];
  const symbolIndex = header.indexOf('Symbol');
  const nameIndex = header.indexOf('Security Name');
  const testIndex = header.indexOf('Test Issue');
  const etfIndex = header.indexOf('ETF');
  return rows.flatMap(row => {
    const symbol = cleanSymbol(row[symbolIndex]);
    const name = cleanName(row[nameIndex]);
    if (!symbol || !name || symbol.startsWith('File Creation Time') || row[testIndex] === 'Y' || row[etfIndex] === 'Y') return [];
    return [{ symbol, displaySymbol: symbol, providerSymbol: symbol.replace('.', '-'), companyName: name, exchange: 'NASDAQ' as const, currency: 'USD' as const }];
  });
}

function parseOtherUs(text: string): SecurityInput[] {
  const rows = parsePipe(text);
  const header = rows.shift() ?? [];
  const symbolIndex = header.indexOf('ACT Symbol');
  const nameIndex = header.indexOf('Security Name');
  const exchangeIndex = header.indexOf('Exchange');
  const testIndex = header.indexOf('Test Issue');
  const etfIndex = header.indexOf('ETF');
  return rows.flatMap(row => {
    const symbol = cleanSymbol(row[symbolIndex]);
    const name = cleanName(row[nameIndex]);
    if (!symbol || !name || symbol.startsWith('File Creation Time') || row[exchangeIndex] !== 'N' || row[testIndex] === 'Y' || row[etfIndex] === 'Y') return [];
    return [{ symbol, displaySymbol: symbol, providerSymbol: symbol.replace('.', '-'), companyName: name, exchange: 'NYSE' as const, currency: 'USD' as const }];
  });
}

function parsePipe(text: string): string[][] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(line => line.split('|').map(value => value.trim()));
}

function parseCsv(text: string): string[][] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(line => {
    const values: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { values.push(value.trim()); value = ''; }
      else value += char;
    }
    values.push(value.trim());
    return values;
  });
}

function cleanSymbol(value?: string): string {
  const symbol = (value || '').trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.&-]{0,19}$/.test(symbol) ? symbol : '';
}
function cleanName(value?: string): string { return (value || '').replace(/\s+-\s+(Common Stock|Ordinary Shares).*$/i, '').trim().slice(0, 255); }
function dedupe(items: SecurityInput[]): SecurityInput[] {
  const seen = new Set<string>();
  return items.filter(item => { const key = `${item.exchange}:${item.symbol}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

if (require.main === module) {
  syncSecurityUniverse()
    .then(result => { console.log(`[Universe] Synced ${result.total} real securities (${result.india} India, ${result.us} US)`); process.exit(0); })
    .catch(error => { console.error(`[Universe] ${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
}
