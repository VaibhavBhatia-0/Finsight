import { createHash } from 'crypto';

export type ExchangeCode = 'NSE' | 'NASDAQ' | 'NYSE';

export interface SecurityInput {
  symbol: string;
  displaySymbol: string;
  providerSymbol: string;
  companyName: string;
  exchange: ExchangeCode;
  currency: 'INR' | 'USD';
  assetType: 'EQUITY' | 'WARRANT' | 'RIGHT' | 'UNIT' | 'PREFERRED' | 'NOTE' | 'DEPOSITARY_RECEIPT' | 'UNCLASSIFIED';
}

export interface DirectoryDocuments {
  nse: string;
  nasdaq: string;
  otherUs: string;
}

export interface PreparedUniverse {
  securities: SecurityInput[];
  counts: Record<ExchangeCode, number>;
  skipped: number;
  rejected: number;
  sha256: string;
}

const SOURCES = {
  nse: 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
  nasdaq: 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',
  otherUs: 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt',
} as const;

// The verified 2026-09-21 local catalogue contained NSE 2317, NASDAQ 4340,
// NYSE 2479. Leave room for legitimate listings and delistings, but reject
// an obviously partial source response before touching the database.
export const MINIMUM_COUNTS: Record<ExchangeCode, number> = { NSE: 2000, NASDAQ: 3900, NYSE: 2200 };
export const MINIMUM_TOTAL = 9000;

export async function downloadDirectoryDocuments(): Promise<DirectoryDocuments> {
  const [nse, nasdaq, otherUs] = await Promise.all([
    download(SOURCES.nse), download(SOURCES.nasdaq), download(SOURCES.otherUs),
  ]);
  return { nse, nasdaq, otherUs };
}

export function prepareSecurityUniverse(
  documents: DirectoryDocuments,
  minimumCounts: Record<ExchangeCode, number> = MINIMUM_COUNTS,
  minimumTotal = MINIMUM_TOTAL,
): PreparedUniverse {
  const sha256 = createHash('sha256')
    .update(JSON.stringify([documents.nse, documents.nasdaq, documents.otherUs]))
    .digest('hex');
  const raw: SecurityInput[] = [];
  let skipped = 0;
  const rejected: string[] = [];

  const add = (input: SecurityInput | null, reason: string | null) => {
    if (reason) rejected.push(reason);
    else if (input) raw.push(input);
    else skipped += 1;
  };

  const nseRows = csvRows(documents.nse);
  const nseFields = fields(nseRows.shift(), ['SYMBOL', 'NAME OF COMPANY', 'SERIES', 'ISIN NUMBER'], 'NSE');
  for (const [index, row] of nseRows.entries()) {
    if (cell(row, nseFields, 'SERIES') !== 'EQ') { skipped += 1; continue; }
    const symbol = cell(row, nseFields, 'SYMBOL');
    if (!validSymbol(symbol)) { skipped += 1; continue; }
    const companyName = cleanName(rawCell(row, nseFields, 'NAME OF COMPANY'));
    const isin = cell(row, nseFields, 'ISIN NUMBER');
    // NSE's EQ series may also contain ETF units. The supported catalogue is
    // equities only; do not mislabel a fund unit as an ordinary share.
    if (isin.startsWith('INF') || /\bETF\b|exchange.traded fund/i.test(companyName)) { skipped += 1; continue; }
    add(companyName ? {
      symbol, displaySymbol: symbol, providerSymbol: `${symbol}.NS`, companyName, exchange: 'NSE', currency: 'INR', assetType: 'EQUITY',
    } : null, companyName ? null : `NSE row ${index + 2}: missing company name`);
  }

  const nasdaqRows = pipeRows(documents.nasdaq);
  const nasdaqFields = fields(nasdaqRows.shift(), ['Symbol', 'Security Name', 'Test Issue', 'ETF'], 'NASDAQ');
  for (const [index, row] of nasdaqRows.entries()) {
    if (row[0]?.startsWith('File Creation Time')) { skipped += 1; continue; }
    if (cell(row, nasdaqFields, 'Test Issue') === 'Y' || cell(row, nasdaqFields, 'ETF') === 'Y') { skipped += 1; continue; }
    const symbol = cell(row, nasdaqFields, 'Symbol');
    if (!validSymbol(symbol)) { skipped += 1; continue; }
    const rawName = rawCell(row, nasdaqFields, 'Security Name');
    const companyName = cleanName(rawName);
    add(companyName ? {
      symbol, displaySymbol: symbol, providerSymbol: symbol.replace(/\./g, '-'), companyName, exchange: 'NASDAQ', currency: 'USD', assetType: classifyUsAsset(rawName),
    } : null, companyName ? null : `NASDAQ row ${index + 2}: missing company name`);
  }

  const otherRows = pipeRows(documents.otherUs);
  const otherFields = fields(otherRows.shift(), ['ACT Symbol', 'Security Name', 'Exchange', 'Test Issue', 'ETF'], 'NYSE');
  for (const [index, row] of otherRows.entries()) {
    if (row[0]?.startsWith('File Creation Time')) { skipped += 1; continue; }
    if (cell(row, otherFields, 'Exchange') !== 'N'
      || cell(row, otherFields, 'Test Issue') === 'Y'
      || cell(row, otherFields, 'ETF') === 'Y') { skipped += 1; continue; }
    const symbol = cell(row, otherFields, 'ACT Symbol');
    if (!validSymbol(symbol)) { skipped += 1; continue; }
    const rawName = rawCell(row, otherFields, 'Security Name');
    const companyName = cleanName(rawName);
    add(companyName ? {
      symbol, displaySymbol: symbol, providerSymbol: symbol.replace(/\./g, '-'), companyName, exchange: 'NYSE', currency: 'USD', assetType: classifyUsAsset(rawName),
    } : null, companyName ? null : `NYSE row ${index + 2}: missing company name`);
  }

  const byKey = new Map<string, SecurityInput>();
  for (const security of raw) {
    const key = `${security.exchange}:${security.symbol}`;
    const previous = byKey.get(key);
    if (!previous) byKey.set(key, security);
    else if (JSON.stringify(previous) === JSON.stringify(security)) skipped += 1;
    else rejected.push(`${key}: conflicting duplicate records`);
  }
  const securities = [...byKey.values()];
  const counts: Record<ExchangeCode, number> = { NSE: 0, NASDAQ: 0, NYSE: 0 };
  for (const security of securities) counts[security.exchange] += 1;
  for (const exchange of ['NSE', 'NASDAQ', 'NYSE'] as const) {
    if (counts[exchange] < minimumCounts[exchange]) {
      rejected.push(`${exchange}: ${counts[exchange]} records is below the required ${minimumCounts[exchange]}`);
    }
  }
  if (securities.length < minimumTotal) {
    rejected.push(`TOTAL: ${securities.length} records is below the required ${minimumTotal}`);
  }
  if (rejected.length) {
    throw new Error(`Security universe validation failed (${rejected.length} rejection(s)): ${rejected.slice(0, 5).join('; ')}`);
  }
  return { securities, counts, skipped, rejected: 0, sha256 };
}

async function download(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'text/csv,text/plain,*/*', 'User-Agent': 'FinSight/1.0 personal-research-workspace' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Security directory ${new URL(url).hostname} returned HTTP ${response.status}`);
  const text = await response.text();
  if (!text || text.length > 2_000_000) throw new Error(`Security directory ${new URL(url).hostname} has an invalid size`);
  return text;
}

function fields(row: string[] | undefined, required: string[], source: string): Map<string, number> {
  const map = new Map((row || []).map((value, index) => [value.trim(), index]));
  for (const field of required) if (!map.has(field)) throw new Error(`${source} directory is missing ${field}`);
  return map;
}
function cell(row: string[], header: Map<string, number>, field: string): string {
  return rawCell(row, header, field).toUpperCase();
}
function rawCell(row: string[], header: Map<string, number>, field: string): string {
  return (row[header.get(field)!] || '').trim();
}
function cleanName(value: string): string {
  return value.replace(/\s+-\s+(Common Stock|Ordinary Shares).*$/i, '').trim().slice(0, 255);
}
function classifyUsAsset(name: string): SecurityInput['assetType'] {
  if (/\bwarrants?\b/i.test(name)) return 'WARRANT';
  if (/\brights?\b/i.test(name)) return 'RIGHT';
  if (/\bunits?\b/i.test(name)) return 'UNIT';
  if (/\bpreferred stock\b|\bpreference shares?\b|\bpreferred shares?\b/i.test(name)) return 'PREFERRED';
  if (/\bsenior notes?\b|\bnotes? due\b|\bETN\b/i.test(name)) return 'NOTE';
  if (/\bdepositary (shares?|receipts?)\b|\bADR\b|\bADS\b/i.test(name)) return 'DEPOSITARY_RECEIPT';
  if (/\bcommon stock\b|\bordinary shares?\b|\bcommon shares?\b/i.test(name)) return 'EQUITY';
  return 'UNCLASSIFIED';
}
function validSymbol(value: string): boolean { return /^[A-Z0-9][A-Z0-9.&-]{0,19}$/.test(value); }
function pipeRows(text: string): string[][] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(line => line.split('|').map(value => value.trim()));
}
function csvRows(text: string): string[][] {
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
