import { YahooFinanceMarketDataProvider } from '../services/marketData/yahooProvider';

const samples = [
  { symbol: 'RELIANCE', exchange: 'NSE' },
  { symbol: 'RELIANCE', exchange: 'BSE' },
  { symbol: 'AAPL', exchange: 'NASDAQ' },
  { symbol: 'JPM', exchange: 'NYSE' },
] as const;

async function verify() {
  const rows = await Promise.all(samples.map(async sample => {
    try {
      const quote = await YahooFinanceMarketDataProvider.getQuote(sample.symbol, sample.exchange);
      return {
        symbol: quote.providerSymbol, provider: quote.provider, exchange: quote.exchange,
        currency: quote.currency, price: quote.price, marketTimestamp: quote.marketTimestamp,
        fetchedAt: quote.fetchedAt, freshnessSeconds: quote.freshnessSeconds,
        freshnessLabel: quote.freshnessLabel,
      };
    } catch (error) {
      return { symbol: `${sample.symbol}:${sample.exchange}`, provider: 'YAHOO_FINANCE_CHART', error: error instanceof Error ? error.message : String(error) };
    }
  }));
  console.table(rows);
  if (rows.every(row => 'error' in row)) process.exitCode = 1;
}

void verify();
