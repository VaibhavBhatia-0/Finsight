import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from 'lucide-react';
import api from '../api/client';
import type { ScreenerResponse, ScreenerStock } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import { FreshnessBadge } from '../components/FreshnessBadge';
import StockSearchInput from '../components/StockSearchInput';
import { useAuth } from '../hooks/useAuth';
import { useWatchlist } from '../hooks/useWatchlist';

interface UniverseStats {
  total: number;
  exchanges: Array<{ code: string; country_code: string; count: number }>;
  sectors: Array<{ sector: string; count: number }>;
}

type SortChoice = 'popular' | 'name' | 'symbol' | 'volatility';

const sortChoices: Array<{ value: SortChoice; label: string }> = [
  { value: 'popular', label: 'Popular companies first' },
  { value: 'name', label: 'Company name A–Z' },
  { value: 'symbol', label: 'Ticker A–Z' },
  { value: 'volatility', label: 'Calmest price history first' },
];

const popular = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'AAPL', 'MSFT', 'NVDA'];
const countryNames: Record<string, string> = { IN: 'India', US: 'United States' };
const pageSize = 20;

export default function ScreenerPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const watchlist = useWatchlist(Boolean(user));
  const [search, setSearch] = useState('');
  const [exchange, setExchange] = useState('');
  const [sectorText, setSectorText] = useState('');
  const [sort, setSort] = useState<SortChoice>('popular');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [maxVolatility, setMaxVolatility] = useState('');
  const [page, setPage] = useState(1);

  const stats = useQuery({
    queryKey: ['universe-stats'],
    queryFn: async () => (await api.get<UniverseStats>(endpoints.markets.universeStats)).data,
    staleTime: 10 * 60 * 1000,
  });

  // Sector matching is exact on the server, so only a sector picked from the suggestions is applied.
  const sector = stats.data?.sectors.find(row => row.sector.toLowerCase() === sectorText.trim().toLowerCase())?.sector ?? '';
  const sectorPending = Boolean(sectorText.trim()) && !sector;
  const sectorCoverage = stats.data?.sectors.reduce((sum, row) => sum + row.count, 0) ?? 0;
  // Indian markets first, then US, each alphabetically.
  const exchanges = (stats.data?.exchanges ?? []).slice().sort((a, b) => (a.country_code === 'IN' ? 0 : 1) - (b.country_code === 'IN' ? 0 : 1) || a.code.localeCompare(b.code));

  const params = useMemo(() => ({
    exchange: exchange || undefined,
    sector: sector || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    maxVolatility: maxVolatility || undefined,
    sortBy: sort,
    sortOrder: 'asc',
    page,
    limit: pageSize,
  }), [exchange, sector, minPrice, maxPrice, maxVolatility, sort, page]);

  const results = useQuery({
    queryKey: ['screener', params],
    queryFn: async () => (await api.get<ScreenerResponse>(endpoints.markets.screener, { params })).data,
    placeholderData: previous => previous,
  });

  const update = (apply: () => void) => { apply(); setPage(1); };
  const clearAll = () => update(() => { setExchange(''); setSectorText(''); setMinPrice(''); setMaxPrice(''); setMaxVolatility(''); setSort('name'); });
  const activeCount = [exchange, sector, minPrice, maxPrice, maxVolatility].filter(Boolean).length;
  const total = results.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, results.data?.pagination.totalPages ?? 1);
  const rows = results.data?.items ?? [];
  const firstQuote = rows.find(row => row.quote)?.quote;

  return (
    <main className="screener-page">
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">Invest</p>
          <h1>Stock screener</h1>
          <p className="page-subtitle">Pick a market and a sector to browse listed companies, or start typing a name to jump straight to a stock.</p>
        </div>
        {firstQuote && <FreshnessBadge freshness={firstQuote.freshnessLabel} timestamp={firstQuote.marketTimestamp} />}
      </header>

      <section className="panel screener-start">
        <StockSearchInput label="Find a stock" value={search} onChange={setSearch} placeholder="Try Reliance, TCS, Apple or NVDA" onSelect={security => { if (security) navigate(`/markets/${security.id}`); }} />
        <div className="suggestion-row" aria-label="Popular stocks">
          <span>Popular</span>
          {popular.map(symbol => <Link key={symbol} to={`/markets?q=${symbol}`} className="chip">{symbol}</Link>)}
        </div>
      </section>

      <section className="panel screener-filters" aria-label="Screener filters">
        <div className="screener-filter-block">
          <p className="filter-label">Market</p>
          <div className="chip-row" role="group" aria-label="Market">
            <button type="button" className={`chip${exchange ? '' : ' active'}`} aria-pressed={!exchange} onClick={() => update(() => setExchange(''))}>All markets{stats.data ? <small>{compact(stats.data.total)}</small> : null}</button>
            {exchanges.map(row => (
              <button type="button" key={row.code} className={`chip${exchange === row.code ? ' active' : ''}`} aria-pressed={exchange === row.code} onClick={() => update(() => setExchange(row.code))}>
                {row.code} · {countryNames[row.country_code] ?? row.country_code}<small>{compact(row.count)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="screener-filter-pair">
          <label className="filter-field" htmlFor="screener-sector">
            <span className="filter-label">Sector</span>
            <input id="screener-sector" list="screener-sectors" value={sectorText} onChange={event => update(() => setSectorText(event.target.value))} placeholder={stats.data?.sectors.length ? 'Any sector · start typing' : 'Sectors unavailable'} disabled={!stats.data?.sectors.length} />
            <datalist id="screener-sectors">{stats.data?.sectors.map(row => <option key={row.sector} value={row.sector}>{row.count} listings</option>)}</datalist>
            {sectorPending ? <small className="filter-hint">Choose a sector from the suggestions.</small> : stats.data && sectorCoverage < stats.data.total && <small className="filter-hint">Sector data covers {sectorCoverage.toLocaleString()} of {stats.data.total.toLocaleString()} listings; the official directories do not include it.</small>}
          </label>
          <label className="filter-field" htmlFor="screener-sort">
            <span className="filter-label">Sort by</span>
            <select id="screener-sort" value={sort} onChange={event => update(() => setSort(event.target.value as SortChoice))}>
              {sortChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select>
          </label>
        </div>

        <details className="screener-more">
          <summary><SlidersHorizontal size={14} aria-hidden /> More filters</summary>
          <div className="screener-filter-pair">
            <div className="filter-field">
              <span className="filter-label">Price range</span>
              <div className="range-inputs">
                <input aria-label="Minimum price" type="number" min="0" step="0.01" placeholder="From" value={minPrice} onChange={event => update(() => setMinPrice(event.target.value))} />
                <input aria-label="Maximum price" type="number" min="0" step="0.01" placeholder="To" value={maxPrice} onChange={event => update(() => setMaxPrice(event.target.value))} />
              </div>
            </div>
            <label className="filter-field" htmlFor="screener-volatility">
              <span className="filter-label">Price swings at most (yearly volatility %)</span>
              <input id="screener-volatility" type="number" min="0" step="1" placeholder="e.g. 25" value={maxVolatility} onChange={event => update(() => setMaxVolatility(event.target.value))} />
            </label>
          </div>
          <p className="filter-hint">These two use stored price history, so stocks without it are left out. Valuation filters (P/E, EPS, market cap, revenue, profit, debt) need a fundamentals provider and stay hidden until one is connected.</p>
        </details>

        {activeCount > 0 && <button type="button" className="clear-filters" onClick={clearAll}><X size={14} aria-hidden /> Clear {activeCount} filter{activeCount === 1 ? '' : 's'}</button>}
      </section>

      <section className="panel" aria-live="polite">
        <div className="panel-header">
          <div><h2 className="panel-title">{results.isPending ? 'Loading stocks…' : `${total.toLocaleString()} stock${total === 1 ? '' : 's'}`}</h2><p className="panel-subtitle">Prices are shown in the currency each stock trades in. Select a row to open the stock.</p></div>
        </div>
        {results.isError && <p className="error-banner" role="alert">Stocks could not be loaded: {results.error.message}</p>}
        {!results.isPending && !results.isError && !rows.length && <div className="empty-state"><p>No stocks match these filters.</p>{activeCount > 0 && <button type="button" className="btn-secondary mt-3 px-4" onClick={clearAll}>Clear filters</button>}</div>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="screener-table">
              <thead><tr><th className="text-left">Stock</th><th className="text-left">Market</th><th className="text-right">Price</th><th className="text-right">Today</th><th className="text-left">Data</th><th><span className="sr-only">Watchlist</span></th></tr></thead>
              <tbody>
                {rows.map(stock => (
                  <tr key={stock.id} className="screener-row" tabIndex={0} onClick={() => navigate(`/markets/${stock.id}`)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/markets/${stock.id}`); } }}>
                    <td><div className="flex items-center gap-3"><span className="symbol-token">{stock.symbol.slice(0, 2)}</span><div><strong>{stock.symbol}</strong><p className="screener-name">{stock.name}</p></div></div></td>
                    <td>{stock.exchangeCode ?? stock.exchange}<p className="screener-name">{countryNames[stock.countryCode] ?? stock.countryCode}</p></td>
                    <td className="text-right font-mono">{price(stock)}</td>
                    <td className="text-right">{stock.changePercent == null ? <span className="text-gray-500">—</span> : <span className={`change-pill ${stock.changePercent >= 0 ? 'up' : 'down'}`}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>}</td>
                    <td>{stock.quote ? <FreshnessBadge freshness={stock.quote.freshnessLabel} timestamp={stock.quote.marketTimestamp} /> : <FreshnessBadge freshness="UNAVAILABLE" />}</td>
                    <td className="text-right" onClick={event => event.stopPropagation()}>
                      <button type="button" className="icon-action" onClick={() => (user ? watchlist.addToWatchlist(stock.id) : navigate('/login'))} aria-label={`Add ${stock.symbol} to watchlist`} title="Add to watchlist"><Plus size={15} aria-hidden /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <nav className="table-pagination" aria-label="Pagination">
            <span>Showing {((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()}</span>
            <span className="flex gap-2">
              <button type="button" className="btn-secondary px-3" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={15} aria-hidden /> Previous</button>
              <button type="button" className="btn-secondary px-3" disabled={page >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Next <ChevronRight size={15} aria-hidden /></button>
            </span>
          </nav>
        )}
      </section>
    </main>
  );
}

function price(stock: ScreenerStock) {
  if (stock.price == null) return <span className="text-gray-500">—</span>;
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: stock.currency, maximumFractionDigits: 2 }).format(stock.price); } catch { return `${stock.currency} ${stock.price.toFixed(2)}`; }
}
function compact(value: number) { return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
