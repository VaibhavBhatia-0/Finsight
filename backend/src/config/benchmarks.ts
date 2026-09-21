export const BENCHMARKS_BY_SYMBOL = {
  '^NSEI': { code: 'NIFTY_50', name: 'NIFTY 50', exchange: 'NSE', currency: 'INR' },
  '^BSESN': { code: 'SENSEX', name: 'BSE SENSEX', exchange: 'BSE', currency: 'INR' },
  '^GSPC': { code: 'SP500', name: 'S&P 500 Index', exchange: 'NYSE', currency: 'USD' },
  '^IXIC': { code: 'NASDAQ_COMP', name: 'NASDAQ Composite', exchange: 'NASDAQ', currency: 'USD' },
} as const;

export type BenchmarkSymbol = keyof typeof BENCHMARKS_BY_SYMBOL;

export const BENCHMARK_SYMBOL_BY_CODE = Object.fromEntries(
  Object.entries(BENCHMARKS_BY_SYMBOL).map(([symbol, value]) => [value.code, symbol]),
) as Record<string, BenchmarkSymbol>;
