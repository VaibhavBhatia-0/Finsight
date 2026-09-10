import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { SearchIcon, FilterIcon, PlusIcon } from 'lucide-react';
import FreshnessBadge from '../components/FreshnessBadge';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/Spinner';
import { useWatchlist } from '../hooks/useWatchlist';

interface MarketSummary {
  symbol: string;
  companyName: string;
  price: number;
  changePercent: number;
  freshness: 'Live' | 'Delayed' | 'End-of-day' | 'Historical';
  lastUpdated: string; // ISO string
}

/**
 * Hook to fetch markets list with pagination and optional filters.
 * This placeholder uses a mock fetch; replace with real API call.
 */
const fetchMarkets = async ({ queryKey }: any): Promise<{ data: MarketSummary[]; total: number }> => {
  const [_key, { page, pageSize, search, filters }] = queryKey;
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    search: search || '',
    ...filters,
  });
  const res = await fetch(`/api/v1/markets?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch markets');
  return res.json();
};

const useMarkets = (page: number, pageSize: number, search: string, filters: Record<string, string>) => {
  return useQuery(['markets', { page, pageSize, search, filters }], fetchMarkets, {
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  });
};

const MarketsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data, isLoading, isError, error } = useMarkets(page, pageSize, search, filters);
  const { user } = useAuth();
  const { addToWatchlist } = useWatchlist();

  const handleAddWatchlist = (symbol: string) => {
    if (!user) {
      // redirect to login
      window.location.href = '/login';
      return;
    }
    addToWatchlist(symbol);
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Markets</h1>

      <div className="flex items-center mb-4 space-x-2">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Search by symbol or company"
            className="w-full pl-10 pr-4 py-2 border rounded focus-visible:outline-none focus-visible:ring-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search markets"
          />
          <SearchIcon className="absolute left-3 top-2.5 text-gray-500" size={20} aria-hidden="true" />
        </div>
        <button
          className="p-2 rounded bg-gray-100 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2"
          aria-label="Open filter panel"
        >
          <FilterIcon size={20} />
        </button>
      </div>

      {isLoading && <Spinner />}
      {isError && <div className="text-red-600">Error: {(error as Error).message}</div>}

      {data && (
        <>
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-4 py-2 text-left">Symbol</th>
                <th className="px-4 py-2 text-left">Company</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">% Change</th>
                <th className="px-4 py-2 text-center">Freshness</th>
                <th className="px-4 py-2 text-center">Watch</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((m) => (
                <tr key={m.symbol} className="border-b odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800">
                  <td className="px-4 py-2 font-mono">
                    <Link to={`/markets/${m.symbol}`} className="text-blue-600 hover:underline" aria-label={`View details for ${m.symbol}`}>
                      {m.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{m.companyName}</td>
                  <td className="px-4 py-2 text-right">{m.price.toFixed(2)}</td>
                  <td className={`px-4 py-2 text-right ${m.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.changePercent.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-center">
                    <FreshnessBadge freshness={m.freshness} timestamp={m.lastUpdated} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleAddWatchlist(m.symbol)}
                      className="p-1 rounded hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2"
                      aria-label="Add to watchlist"
                    >
                      <PlusIcon size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination controls */}
          <div className="flex justify-between items-center mt-4">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setPage((old) => Math.max(old - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((old) => Math.min(old + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketsPage;

