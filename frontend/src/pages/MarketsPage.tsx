import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, Plus, Search, Scale } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import type { ApiId, MarketOverview, MarketStock, MarketStocksResponse } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import FreshnessBadge from '../components/FreshnessBadge';
import { IndexPerformanceChart, MarketMoversChart } from '../components/MarketInsightCharts';
import StockAnalyticsPanel from '../components/StockAnalyticsPanel';
import { Spinner } from '../components/Spinner';
import StockSearchInput from '../components/StockSearchInput';
import { useAuth } from '../hooks/useAuth';
import { useWatchlist } from '../hooks/useWatchlist';

export default function MarketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [securityJump, setSecurityJump] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [country, setCountry] = useState('');
  const [exchange, setExchange] = useState('');
  const [sector, setSector] = useState('');
  const [sortBy, setSortBy] = useState<'symbol' | 'company' | 'price' | 'change' | 'volume'>('symbol');
  const [displayCurrency, setDisplayCurrency] = useState('NATIVE');
  const [expanded, setExpanded] = useState<ApiId | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const watchlist = useWatchlist(Boolean(user));

  useEffect(() => setSearch(searchParams.get('q') ?? ''), [searchParams]);
  const stocks = useQuery({
    queryKey: ['markets', deferredSearch, country, exchange, sector, page, pageSize, sortBy],
    queryFn: async () => (await api.get<MarketStocksResponse>(endpoints.markets.stocks, { params: { q: deferredSearch || undefined, country: country || undefined, exchange: exchange || undefined, sector: sector || undefined, page, limit: pageSize, sortBy: sortBy === 'company' ? 'company' : 'symbol' } })).data,
    staleTime: 30_000,
  });
  const overview = useQuery({ queryKey: ['markets-overview'], queryFn: async () => (await api.get<MarketOverview>(endpoints.markets.overview)).data, staleTime: 30_000, refetchInterval: 60_000 });
  const items = useMemo(() => {
    const rows = [...(stocks.data?.items ?? [])];
    if (sortBy === 'price') rows.sort((left, right) => (right.quote?.price ?? -Infinity) - (left.quote?.price ?? -Infinity));
    if (sortBy === 'change') rows.sort((left, right) => (right.quote?.changePercent ?? -Infinity) - (left.quote?.changePercent ?? -Infinity));
    if (sortBy === 'volume') rows.sort((left, right) => (right.quote?.volume ?? -Infinity) - (left.quote?.volume ?? -Infinity));
    return rows;
  }, [sortBy, stocks.data?.items]);
  const quoteCurrencies = useMemo(() => [...new Set(items.filter(stock => stock.quote).map(stock => stock.currency))], [items]);
  const fxQueries = useQueries({ queries: quoteCurrencies.map(from => ({ queryKey: ['market-display-fx', from, displayCurrency], queryFn: async () => (await api.get<{ from: string; to: string; rate: number; date: string }>(endpoints.markets.fx, { params: { from, to: displayCurrency } })).data, enabled: displayCurrency !== 'NATIVE' && from !== displayCurrency, staleTime: 60_000 })) });
  const fxRates = useMemo(() => new Map(quoteCurrencies.map((currency, index) => [currency, currency === displayCurrency || displayCurrency === 'NATIVE' ? 1 : fxQueries[index]?.data?.rate])), [displayCurrency, fxQueries, quoteCurrencies]);
  const freshness = aggregateFreshness(items);
  const comparisonCandidates = useMemo(() => {
    const candidates: Array<Pick<MarketStock, 'id' | 'symbol' | 'quote'>> = [...items];
    for (const item of watchlist.data?.flatMap(list => list.items) ?? []) {
      if (!candidates.some(candidate => String(candidate.id) === String(item.stock_id))) candidates.push({ id: item.stock_id, symbol: item.symbol, quote: item.quote });
    }
    return candidates;
  }, [items, watchlist.data]);

  function resetPage() { setPage(1); setExpanded(null); }
  function add(stockId: ApiId) { if (!user) navigate('/login'); else watchlist.addToWatchlist(stockId); }
  function toggle(stockId: ApiId) { setExpanded(value => value === stockId ? null : stockId); }

  return (
    <main>
      <header className="page-heading">
        <div><p className="page-eyebrow">Invest</p><h1>Markets</h1><p className="page-subtitle">Search the official NSE and US listing universe. BSE symbols support provider quotes, while BSE directory coverage remains limited to verified stored listings. Quotes load only for the visible page.</p></div>
        <div className="flex flex-wrap gap-2"><Link to="/markets/compare" className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"><Scale size={15} /> Compare securities</Link><Link to="/screener" className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">Advanced screener <ArrowRight size={15} /></Link></div>
      </header>

      <section className="panel mb-4">
        <div className="mb-4 max-w-xl"><StockSearchInput label="Open a listed security" value={securityJump} onChange={setSecurityJump} onSelect={security => { if (security) navigate(`/markets/${encodeURIComponent(security.providerSymbol ?? security.provider_symbol ?? security.symbol)}`); }} /></div>
        <div className="market-search-row">
          <label className="market-search"><Search size={18} aria-hidden /><span className="sr-only">Search markets</span><input value={search} onChange={event => { const value = event.target.value; setSearch(value); resetPage(); setSearchParams(value ? { q: value } : {}, { replace: true }); }} placeholder="Ticker or company" /></label>
          <div className="market-display-controls"><label>Display prices<select value={displayCurrency} onChange={event => setDisplayCurrency(event.target.value)}><option value="NATIVE">Native currency</option><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></label><FreshnessBadge freshness={freshness} /></div>
        </div>
        <div className="market-filter-row">
          <label>Country<select value={country} onChange={event => { setCountry(event.target.value); setExchange(''); resetPage(); }}><option value="">All</option><option value="IN">India</option><option value="US">United States</option></select></label>
          <label>Exchange<select value={exchange} onChange={event => { setExchange(event.target.value); resetPage(); }}><option value="">All</option><option value="NSE">NSE</option><option value="BSE">BSE · limited listings</option><option value="NASDAQ">NASDAQ</option><option value="NYSE">NYSE</option></select></label>
          <label>Sector<input value={sector} onChange={event => { setSector(event.target.value); resetPage(); }} placeholder="e.g. Technology" /></label>
          <label>Sort<select value={sortBy} onChange={event => { setSortBy(event.target.value as typeof sortBy); resetPage(); }}><option value="symbol">Symbol</option><option value="company">Company</option><option value="price">Visible-page price</option><option value="change">Visible-page change</option><option value="volume">Visible-page volume</option></select></label>
          <label>Rows<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); resetPage(); }}><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
        </div>
      </section>

      <div className="market-analytics-grid mb-4">
        <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Market pulse</h2><p className="panel-subtitle">Provider-timestamped benchmark session change</p></div>{overview.data?.indices[0] && <FreshnessBadge freshness={overview.data.indices[0].freshnessLabel} timestamp={overview.data.indices[0].marketTimestamp} />}</div>{overview.isPending ? <Spinner /> : overview.error ? <p role="alert" className="error-banner">Market pulse is currently unavailable.</p> : overview.data ? <IndexPerformanceChart indices={overview.data.indices} /> : null}</section>
        <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Visible movers</h2><p className="panel-subtitle">Largest changes among this page’s quoted securities</p></div></div>{stocks.isPending ? <Spinner /> : stocks.error ? <p role="alert" className="error-banner">Market quotes are currently unavailable.</p> : <MarketMoversChart stocks={items} />}</section>
      </div>

      {stocks.isPending && <Spinner />}
      {stocks.error && <p role="alert" className="error-banner">Unable to load the security universe.</p>}
      {watchlist.addError && <p role="alert" className="error-banner">{watchlist.addError.message}</p>}
      {stocks.data && (
        <section className="panel">
          <div className="panel-header"><div><h2 className="panel-title">Listed equities</h2><p className="panel-subtitle">{stocks.data.pagination.total.toLocaleString()} securities · only {items.length} visible quotes requested</p></div></div>
          <div className="overflow-x-auto">
            <table className="market-table">
              <thead><tr><th aria-label="Expand" /><th className="text-left">Asset</th><th className="text-left">Exchange</th><th className="text-left">Sector</th><th className="text-right">Price</th><th className="text-right">Change</th><th className="text-center">Freshness</th><th className="text-center">Watch</th></tr></thead>
              <tbody>{items.map(stock => <MarketRow key={stock.id} stock={stock} open={expanded === stock.id} toggle={() => toggle(stock.id)} displayCurrency={displayCurrency} rate={fxRates.get(stock.currency)} add={() => add(stock.id)} candidates={comparisonCandidates} />)}</tbody>
            </table>
          </div>
          <nav className="table-pagination" aria-label="Pagination"><button className="btn-secondary px-3 py-2" disabled={page === 1} onClick={() => { setPage(value => value - 1); setExpanded(null); }}>Previous</button><span>Page {stocks.data.pagination.page} of {stocks.data.pagination.totalPages}</span><button className="btn-secondary px-3 py-2" disabled={page >= stocks.data.pagination.totalPages} onClick={() => { setPage(value => value + 1); setExpanded(null); }}>Next</button></nav>
        </section>
      )}
    </main>
  );
}

function MarketRow({ stock, open, toggle, displayCurrency, rate, add, candidates }: { stock: MarketStock; open: boolean; toggle: () => void; displayCurrency: string; rate?: number; add: () => void; candidates: Array<Pick<MarketStock, 'id' | 'symbol' | 'quote'>> }) {
  const quote = stock.quote;
  return <>
    <tr className={`market-data-row${open ? ' expanded' : ''}`} onClick={toggle} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }} aria-expanded={open}>
      <td><ChevronDown className="row-chevron" size={15} aria-hidden /></td>
      <td><span className="flex items-center gap-3"><span className="symbol-token">{stock.symbol.slice(0, 2)}</span><span><strong className="block font-mono">{stock.display_symbol || stock.symbol}</strong><span className="text-xs text-gray-500">{stock.company_name}</span></span></span></td>
      <td>{stock.exchange_code} · {stock.country_code}</td><td>{stock.sector ?? 'N/A'}</td>
      <td className="text-right font-mono">{quote ? formatPrice(stock, displayCurrency, rate) : 'N/A'}</td>
      <td className={`text-right font-mono ${movementClass(quote?.changePercent)}`}>{formatChange(quote?.changePercent)}</td>
      <td className="text-center">{quote ? <FreshnessBadge freshness={quote.freshnessLabel} timestamp={quote.marketTimestamp} /> : <FreshnessBadge freshness="UNAVAILABLE" />}</td>
      <td className="text-center"><button className="icon-action" onClick={event => { event.stopPropagation(); add(); }} aria-label={`Add ${stock.symbol} to watchlist`}><Plus size={15} /></button></td>
    </tr>
    {open && <tr className="market-expanded-row"><td colSpan={8}><StockAnalyticsPanel stock={stock} comparisonCandidates={candidates} /><Link className="stock-detail-link" to={`/markets/${encodeURIComponent(stock.symbol)}`}>Open full company view <ArrowRight size={14} /></Link></td></tr>}
  </>;
}

function aggregateFreshness(stocks: MarketStock[]) {
  const values = stocks.flatMap(stock => stock.quote ? [stock.quote.freshnessLabel] : []);
  if (!values.length) return 'UNAVAILABLE';
  return (['STALE', 'SYNTHETIC', 'LAST CLOSE', 'DELAYED', 'LIVE'] as const).find(value => values.includes(value)) || 'UNAVAILABLE';
}
function formatPrice(stock: MarketStock, displayCurrency: string, rate?: number) {
  const currency = displayCurrency === 'NATIVE' ? stock.currency : displayCurrency;
  if (!stock.quote || (displayCurrency !== 'NATIVE' && rate === undefined)) return 'N/A';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(stock.quote.price * (rate ?? 1));
}
function movementClass(value: number | null | undefined) { return value == null ? '' : value >= 0 ? 'movement-up' : 'movement-down'; }
function formatChange(value: number | null | undefined) { return value == null ? 'N/A' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
