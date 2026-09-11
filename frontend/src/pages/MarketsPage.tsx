import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, SearchIcon } from 'lucide-react';
import api from '../api/client';
import type { ApiId, MarketStock } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import FreshnessBadge from '../components/FreshnessBadge';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useWatchlist } from '../hooks/useWatchlist';

export default function MarketsPage() {
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const watchlist = useWatchlist(Boolean(user));
  const stocks = useQuery({
    queryKey: ['markets', search],
    queryFn: async () => (await api.get<MarketStock[]>(endpoints.markets.stocks, { params: { q: search } })).data,
    staleTime: 5 * 60 * 1000,
  });

  const displayed = useMemo(
    () => stocks.data?.slice((page - 1) * pageSize, page * pageSize) ?? [],
    [page, stocks.data],
  );
  const totalPages = Math.max(1, Math.ceil((stocks.data?.length ?? 0) / pageSize));

  function add(stockId: ApiId) {
    if (!user) { navigate('/login'); return; }
    watchlist.addToWatchlist(stockId);
  }

  return (
    <section className="p-4">
      <h1 className="text-2xl font-bold mb-4">Markets</h1>
      <label className="relative mb-4 block max-w-xl">
        <span className="sr-only">Search markets</span>
        <SearchIcon className="absolute left-3 top-2.5 text-gray-500" size={20} aria-hidden="true" />
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="w-full rounded border py-2 pl-10 pr-4" placeholder="Search by symbol or company" />
      </label>
      <div className="mb-4 rounded border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900" role="note">
        Market values in this development build are synthetic and must not be used for investment decisions.
      </div>
      {stocks.isPending && <Spinner />}
      {stocks.error && <p role="alert" className="text-red-600">{stocks.error.message}</p>}
      {watchlist.addError && <p role="alert" className="text-red-600">{watchlist.addError.message}</p>}
      {stocks.data && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead><tr className="bg-gray-100 dark:bg-gray-800"><th className="px-4 py-2 text-left">Symbol</th><th className="px-4 py-2 text-left">Company</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-right">Change</th><th className="px-4 py-2">Source</th><th className="px-4 py-2">Watch</th></tr></thead>
              <tbody>{displayed.map((stock) => <tr key={stock.id} className="border-b"><td className="px-4 py-2 font-mono"><Link className="text-gold-700 hover:underline" to={`/markets/${stock.symbol}`}>{stock.symbol}</Link></td><td className="px-4 py-2">{stock.company_name}</td><td className="px-4 py-2 text-right">{stock.currency} {stock.quote.price.toFixed(2)}</td><td className={`px-4 py-2 text-right ${stock.quote.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.quote.changePercent.toFixed(2)}%</td><td className="px-4 py-2 text-center"><FreshnessBadge freshness="Synthetic" timestamp={stock.quote.timestamp} /></td><td className="px-4 py-2 text-center"><button onClick={() => add(stock.id)} aria-label={`Add ${stock.symbol} to watchlist`}><PlusIcon size={16} /></button></td></tr>)}</tbody>
            </table>
          </div>
          <nav className="mt-4 flex items-center justify-between" aria-label="Pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav>
        </>
      )}
    </section>
  );
}
