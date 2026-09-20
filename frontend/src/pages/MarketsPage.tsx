import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus, Search } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import type { ApiId, MarketOverview, MarketStock } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import FreshnessBadge from '../components/FreshnessBadge';
import { IndexPerformanceChart, MarketMoversChart } from '../components/MarketInsightCharts';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useWatchlist } from '../hooks/useWatchlist';

export default function MarketsPage() {
  const pageSize = 20;
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [displayCurrency, setDisplayCurrency] = useState('NATIVE');
  const navigate = useNavigate();
  const { user } = useAuth();
  const watchlist = useWatchlist(Boolean(user));

  useEffect(() => setSearch(searchParams.get('q') ?? ''), [searchParams]);
  const stocks = useQuery({ queryKey: ['markets', search], queryFn: async () => (await api.get<MarketStock[]>(endpoints.markets.stocks, { params: { q: search } })).data, staleTime: 5 * 60 * 1000 });
  const overview = useQuery({ queryKey: ['markets-overview'], queryFn: async () => (await api.get<MarketOverview>(endpoints.markets.overview)).data, staleTime: 5 * 60 * 1000 });
  const quoteCurrencies = useMemo(() => [...new Set((stocks.data ?? []).map(stock => stock.currency))], [stocks.data]);
  const fxQueries = useQueries({ queries: quoteCurrencies.map(from => ({ queryKey: ['market-display-fx', from, displayCurrency], queryFn: async () => (await api.get<{ from: string; to: string; rate: number; date: string }>(endpoints.markets.fx, { params: { from, to: displayCurrency } })).data, enabled: displayCurrency !== 'NATIVE' && from !== displayCurrency, staleTime: 5 * 60 * 1000 })) });
  const fxRates = useMemo(() => new Map(quoteCurrencies.map((currency, index) => [currency, currency === displayCurrency || displayCurrency === 'NATIVE' ? 1 : fxQueries[index]?.data?.rate])), [displayCurrency, fxQueries, quoteCurrencies]);
  const displayed = useMemo(() => stocks.data?.slice((page - 1) * pageSize, page * pageSize) ?? [], [page, stocks.data]);
  const totalPages = Math.max(1, Math.ceil((stocks.data?.length ?? 0) / pageSize));
  const quoteFreshness = stocks.data?.some(stock => stock.quote.freshness === 'Synthetic') ? 'Synthetic' : (stocks.data?.[0]?.quote.freshness ?? 'Synthetic');

  function add(stockId: ApiId) {
    if (!user) { navigate('/login'); return; }
    watchlist.addToWatchlist(stockId);
  }

  return (
    <main>
      <header className="page-heading">
        <div><p className="page-eyebrow">Invest</p><h1>Markets</h1><p className="page-subtitle">Search the development market catalogue, inspect fundamentals, and build a personal research list.</p></div>
        <Link to="/screener" className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">Advanced screener <ArrowRight size={15} /></Link>
      </header>

      <section className="panel mb-4">
        <div className="market-search-row">
          <label className="market-search"><Search size={18} aria-hidden /><span className="sr-only">Search markets</span><input value={search} onChange={event => { const value = event.target.value; setSearch(value); setPage(1); setSearchParams(value ? { q: value } : {}, { replace: true }); }} placeholder="Symbol, company, exchange or sector" /></label>
          <div className="market-display-controls"><label>Display prices<select value={displayCurrency} onChange={event => setDisplayCurrency(event.target.value)}><option value="NATIVE">Native currency</option><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></label><FreshnessBadge freshness={quoteFreshness} /></div>
        </div>
      </section>

      <div className="market-analytics-grid mb-4">
        <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Market pulse</h2><p className="panel-subtitle">Session change across tracked indices</p></div><span className="freshness-badge">Synthetic</span></div>{overview.isPending ? <Spinner /> : overview.error ? <p role="alert" className="error-banner">Unable to load market pulse: {overview.error.message}</p> : overview.data ? <IndexPerformanceChart indices={overview.data.indices} /> : <p className="empty-copy">No index data is available.</p>}</section>
        <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Market movers</h2><p className="panel-subtitle">Largest absolute changes in the current result set</p></div></div>{stocks.isPending ? <Spinner /> : stocks.error ? <p role="alert" className="error-banner">Unable to load market movers: {stocks.error.message}</p> : stocks.data ? <MarketMoversChart stocks={stocks.data} /> : <p className="empty-copy">No quote data is available.</p>}</section>
      </div>

      {stocks.isPending && <Spinner />}
      {stocks.error && <p role="alert" className="error-banner">{stocks.error.message}</p>}
      {watchlist.addError && <p role="alert" className="error-banner">{watchlist.addError.message}</p>}
      {stocks.data && (
        <section className="panel">
          <div className="panel-header"><div><h2 className="panel-title">Listed assets</h2><p className="panel-subtitle">{stocks.data.length} results · {quoteFreshness === 'Synthetic' ? 'development fixture quotes' : `${quoteFreshness.toLowerCase()} provider quotes`}{displayCurrency === 'NATIVE' ? '' : ` · converted to ${displayCurrency}`}</p></div></div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th className="text-left">Asset</th><th className="text-left">Exchange</th><th className="text-left">Sector</th><th className="text-right">Price</th><th className="text-right">Change</th><th className="text-center">Freshness</th><th className="text-center">Watch</th></tr></thead>
              <tbody>{displayed.map(stock => <tr key={stock.id}>
                <td><Link className="flex items-center gap-3" to={`/markets/${stock.symbol}`}><span className="symbol-token">{stock.symbol.slice(0, 2)}</span><span><strong className="block font-mono">{stock.symbol}</strong><span className="text-xs text-gray-500">{stock.company_name}</span></span></Link></td>
                <td>{stock.exchange_code} · {stock.country_code}</td><td>{stock.sector ?? 'Unclassified'}</td><td className="text-right font-mono">{formatPrice(stock, displayCurrency, fxRates.get(stock.currency))}</td><td className={`text-right font-mono ${stock.quote.changePercent >= 0 ? 'movement-up' : 'movement-down'}`}>{stock.quote.changePercent >= 0 ? '+' : ''}{stock.quote.changePercent.toFixed(2)}%</td><td className="text-center"><FreshnessBadge freshness={stock.quote.freshness} timestamp={stock.quote.timestamp} /></td><td className="text-center"><button className="icon-action" onClick={() => add(stock.id)} aria-label={`Add ${stock.symbol} to watchlist`}><Plus size={15} /></button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <nav className="table-pagination" aria-label="Pagination"><button className="btn-secondary px-3 py-2" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="btn-secondary px-3 py-2" disabled={page === totalPages} onClick={() => setPage(value => value + 1)}>Next</button></nav>
        </section>
      )}
    </main>
  );
}

function formatPrice(stock: MarketStock, displayCurrency: string, rate?: number) {
  const currency = displayCurrency === 'NATIVE' ? stock.currency : displayCurrency;
  if (displayCurrency !== 'NATIVE' && rate === undefined) return `${currency} —`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(stock.quote.price * (rate ?? 1));
}
