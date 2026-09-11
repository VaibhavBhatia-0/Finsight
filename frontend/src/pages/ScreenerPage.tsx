// src/pages/ScreenerPage.tsx
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowUp, ArrowDown, Plus } from "lucide-react";
import api from "../api/client";
import type { ScreenerResponse } from "../api/contracts";
import { endpoints } from "../api/endpoints";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { useWatchlist } from "../hooks/useWatchlist";
import { useAuth } from "../hooks/useAuth";

type NumericFilterKey = 'minMarketCap' | 'maxMarketCap' | 'minPrice' | 'maxPrice' | 'minPe' | 'maxPe' | 'minEps' | 'maxEps' | 'minDivYield' | 'maxDivYield' | 'minRevenue' | 'maxRevenue' | 'minProfit' | 'maxProfit' | 'minDebt' | 'maxDebt' | 'minVolume' | 'maxVolume' | 'minRsi' | 'maxRsi' | 'minYearPosition' | 'maxYearPosition';
type ScreenerSort = 'symbol' | 'price' | 'marketCap' | 'peRatio' | 'eps' | 'dividendYield' | 'volume' | 'rsi14' | 'yearPosition';

const numericDefaults: Record<NumericFilterKey, string> = {
  minMarketCap: '', maxMarketCap: '', minPrice: '', maxPrice: '', minPe: '', maxPe: '',
  minEps: '', maxEps: '', minDivYield: '', maxDivYield: '', minRevenue: '', maxRevenue: '',
  minProfit: '', maxProfit: '', minDebt: '', maxDebt: '', minVolume: '', maxVolume: '',
  minRsi: '', maxRsi: '', minYearPosition: '', maxYearPosition: '',
};

const rangeFields: Array<{ label: string; min: NumericFilterKey; max: NumericFilterKey; step?: string; minValue?: number; maxValue?: number }> = [
  { label: 'Price', min: 'minPrice', max: 'maxPrice', step: '0.01', minValue: 0 },
  { label: 'Market cap', min: 'minMarketCap', max: 'maxMarketCap', minValue: 0 },
  { label: 'P/E ratio', min: 'minPe', max: 'maxPe', step: '0.01' },
  { label: 'EPS', min: 'minEps', max: 'maxEps', step: '0.01' },
  { label: 'Dividend yield (%)', min: 'minDivYield', max: 'maxDivYield', step: '0.01' },
  { label: 'Revenue', min: 'minRevenue', max: 'maxRevenue', minValue: 0 },
  { label: 'Profit', min: 'minProfit', max: 'maxProfit' },
  { label: 'Debt', min: 'minDebt', max: 'maxDebt', minValue: 0 },
  { label: 'Volume', min: 'minVolume', max: 'maxVolume', minValue: 0 },
  { label: 'RSI', min: 'minRsi', max: 'maxRsi', step: '0.01', minValue: 0, maxValue: 100 },
  { label: '52-week position (%)', min: 'minYearPosition', max: 'maxYearPosition', step: '0.01', minValue: 0, maxValue: 100 },
];

export const ScreenerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const watchlist = useWatchlist(Boolean(user));

  // Filter state
  const [exchange, setExchange] = useState("");
  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("");
  const [numericFilters, setNumericFilters] = useState(numericDefaults);
  const [movingAverageRelation, setMovingAverageRelation] = useState('');

  // Sorting & pagination state
  const [sortField, setSortField] = useState<ScreenerSort>("symbol");
  const [sortDesc, setSortDesc] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  const filters = useMemo(() => ({
    exchange,
    country,
    sector,
    ...numericFilters,
    movingAverageRelation,
    sortBy: sortField,
    sortOrder: sortDesc ? 'desc' : 'asc',
    page,
    limit: pageSize,
  }), [
    exchange,
    country,
    sector,
    numericFilters,
    movingAverageRelation,
    sortField,
    sortDesc,
    page,
  ]);

  const { data, isLoading, isError, error } = useQuery<ScreenerResponse>({
    queryKey: ["stocks", filters],
    queryFn: async () => {
      const resp = await api.get<ScreenerResponse>(endpoints.markets.screener, { params: filters });
      return resp.data;
    },
  });

  const handleReset = () => {
    setExchange("");
    setCountry("");
    setSector("");
    setNumericFilters(numericDefaults);
    setMovingAverageRelation('');
    setPage(1);
    setSortField("symbol");
    setSortDesc(false);
  };

  const toggleSort = (field: ScreenerSort) => {
    if (sortField === field) setSortDesc(!sortDesc);
    else {
      setSortField(field);
      setSortDesc(false);
    }
  };

  const totalPages = data?.pagination.totalPages ?? 1;
  const displayedStocks = data?.items ?? [];

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center">
        <Search className="mr-2" aria-hidden="true" /> Stock Screener
      </h1>
      <section
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 border rounded bg-white dark:bg-gray-800"
        aria-label="Filter panel"
      >
        <div className="flex flex-col">
          <label htmlFor="exchange" className="text-sm font-medium mb-1">Exchange</label>
          <input
            id="exchange"
            type="text"
            value={exchange}
            onChange={e => setExchange(e.target.value)}
            className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. NYSE"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="country" className="text-sm font-medium mb-1">Country</label>
          <input
            id="country"
            type="text"
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. US"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="sector" className="text-sm font-medium mb-1">Sector</label>
          <input
            id="sector"
            type="text"
            value={sector}
            onChange={e => setSector(e.target.value)}
            className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. Technology"
          />
        </div>
        {rangeFields.map(field => (
          <fieldset key={field.label} className="rounded border p-2">
            <legend className="px-1 text-sm font-medium">{field.label}</legend>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label={`Minimum ${field.label}`} type="number" placeholder="Min" value={numericFilters[field.min]} min={field.minValue} max={field.maxValue} step={field.step ?? '1'} onChange={event => setNumericFilters(current => ({ ...current, [field.min]: event.target.value }))} className="min-w-0 rounded border px-2 py-1" />
              <input aria-label={`Maximum ${field.label}`} type="number" placeholder="Max" value={numericFilters[field.max]} min={field.minValue} max={field.maxValue} step={field.step ?? '1'} onChange={event => setNumericFilters(current => ({ ...current, [field.max]: event.target.value }))} className="min-w-0 rounded border px-2 py-1" />
            </div>
          </fieldset>
        ))}
        <div className="flex flex-col">
          <label htmlFor="moving-average" className="text-sm font-medium mb-1">Moving-average relation</label>
          <select id="moving-average" value={movingAverageRelation} onChange={event => setMovingAverageRelation(event.target.value)} className="rounded border px-2 py-1">
            <option value="">Any</option>
            <option value="ABOVE_50">Price above SMA 50</option>
            <option value="BELOW_50">Price below SMA 50</option>
            <option value="ABOVE_200">Price above SMA 200</option>
            <option value="BELOW_200">Price below SMA 200</option>
            <option value="GOLDEN_CROSS">SMA 50 above SMA 200</option>
            <option value="DEATH_CROSS">SMA 50 below SMA 200</option>
          </select>
        </div>
      </section>
      <div className="flex space-x-2 mb-4">
        <button
          onClick={handleReset}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X className="mr-2" aria-hidden="true" /> Reset Filters
        </button>
      </div>
      {isLoading && <p className="text-center py-8" role="status">Loading stocks…</p>}
      {isError && <p className="text-center text-red-600 py-8" role="alert">Error loading stocks: {error.message}</p>}
      {!isLoading && data && data.items.length === 0 && <p className="text-center py-8" role="status">No stocks match the current filters.</p>}
      {!isLoading && data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" role="table">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => toggleSort("symbol")}>Symbol {sortField === "symbol" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => toggleSort("price")}>Price {sortField === "price" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</th>
                <th className="px-4 py-2 text-left">Exchange</th>
                <th className="px-4 py-2 text-left">Sector</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => toggleSort("marketCap")}>Market Cap {sortField === "marketCap" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => toggleSort("peRatio")}>P/E {sortField === "peRatio" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => toggleSort("eps")}>EPS {sortField === "eps" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => toggleSort("dividendYield")}>Yield {sortField === "dividendYield" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => toggleSort("rsi14")}>RSI {sortField === "rsi14" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => toggleSort("yearPosition")}>52-week position {sortField === "yearPosition" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}</th>
                <th className="px-4 py-2 text-left">Freshness</th>
                <th className="px-4 py-2 text-left">Watchlist</th>
              </tr>
            </thead>
            <tbody>
              {displayedStocks.map(stock => (
                <tr key={stock.symbol} className="border-t dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer" onClick={() => navigate(`/markets/${stock.symbol}`)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") navigate(`/markets/${stock.symbol}`); }}>
                  <td className="px-4 py-2 font-mono">{stock.symbol}</td>
                  <td className="px-4 py-2">{stock.name}</td>
                  <td className="px-4 py-2">{stock.price.toFixed(2)}</td>
                  <td className="px-4 py-2">{stock.exchange}</td>
                  <td className="px-4 py-2">{stock.sector}</td>
                  <td className="px-4 py-2">{Intl.NumberFormat("en-US", { notation: "compact" }).format(stock.marketCap)}</td>
                  <td className="px-4 py-2">{stock.peRatio.toFixed(2)}</td>
                  <td className="px-4 py-2">{stock.eps.toFixed(2)}</td>
                  <td className="px-4 py-2">{stock.dividendYield.toFixed(2)}%</td>
                  <td className="px-4 py-2">{stock.rsi14.toFixed(2)}</td>
                  <td className="px-4 py-2">{stock.yearPosition.toFixed(2)}%</td>
                  <td className="px-4 py-2"><FreshnessBadge freshness="Synthetic" /></td>
                  <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => user ? watchlist.addToWatchlist(stock.id) : navigate('/login')} className="text-primary hover:text-primary-dark" aria-label={`Add ${stock.symbol} to watchlist`}>
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.items.length > 0 && (
        <nav className="flex items-center justify-between mt-4" aria-label="Pagination">
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(p - 1, 1))} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </nav>
      )}
    </div>
  );
};

export default ScreenerPage;
