// src/pages/ScreenerPage.tsx
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowUp, ArrowDown, Plus } from "lucide-react";
import api from "../api/client";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { useWatchlist } from "../hooks/useWatchlist";

interface Stock {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  sector: string;
  marketCap: number;
  price: number;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  revenue: number | null;
  profit: number | null;
  debt: number | null;
  rsi: number | null;
  movingAverage: number | null;
  volume: number | null;
  week52Low: number | null;
  week52High: number | null;
}

interface ScreenerResult {
  items: Stock[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const buildQueryParams = (filters: Record<string, any>) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== "" && v != null) params.append(k, String(v));
  });
  return params.toString();
};

export const ScreenerPage: React.FC = () => {
  const navigate = useNavigate();
  const watchlist = useWatchlist();

  // Filter state
  const [exchange, setExchange] = useState("");
  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("");
  const [marketCapMin, setMarketCapMin] = useState("");
  const [marketCapMax, setMarketCapMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [peMin, setPeMin] = useState("");
  const [peMax, setPeMax] = useState("");
  const [epsMin, setEpsMin] = useState("");
  const [epsMax, setEpsMax] = useState("");
  const [divYieldMin, setDivYieldMin] = useState("");
  const [divYieldMax, setDivYieldMax] = useState("");
  const [revenueMin, setRevenueMin] = useState("");
  const [revenueMax, setRevenueMax] = useState("");
  const [profitMin, setProfitMin] = useState("");
  const [profitMax, setProfitMax] = useState("");
  const [debtMin, setDebtMin] = useState("");
  const [debtMax, setDebtMax] = useState("");
  const [rsiMin, setRsiMin] = useState("");
  const [rsiMax, setRsiMax] = useState("");
  const [maRelation, setMaRelation] = useState("");

  // Sorting & pagination state
  const [sortField, setSortField] = useState<string>("symbol");
  const [sortDesc, setSortDesc] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  const filters = useMemo(() => ({
    exchange,
    country,
    sector,
    marketCapMin,
    marketCapMax,
    priceMin,
    priceMax,
    peMin,
    peMax,
    epsMin,
    epsMax,
    divYieldMin,
    divYieldMax,
    revenueMin,
    revenueMax,
    profitMin,
    profitMax,
    debtMin,
    debtMax,
    rsiMin,
    rsiMax,
    maRelation,
    sortBy: sortField,
    sortDesc: sortDesc ? "1" : "0",
    page,
    pageSize,
  }), [
    exchange,
    country,
    sector,
    marketCapMin,
    marketCapMax,
    priceMin,
    priceMax,
    peMin,
    peMax,
    epsMin,
    epsMax,
    divYieldMin,
    divYieldMax,
    revenueMin,
    revenueMax,
    profitMin,
    profitMax,
    debtMin,
    debtMax,
    rsiMin,
    rsiMax,
    maRelation,
    sortField,
    sortDesc,
    page,
  ]);

  const { data, isLoading, isError, error } = useQuery<ScreenerResult>({
    queryKey: ["stocks", filters],
    queryFn: async () => {
      const qs = buildQueryParams(filters);
      const resp = await api.get<ScreenerResult>(`/api/v1/markets/screener?${qs}`);
      return resp.data;
    },
  });

  const handleReset = () => {
    setExchange("");
    setCountry("");
    setSector("");
    setMarketCapMin("");
    setMarketCapMax("");
    setPriceMin("");
    setPriceMax("");
    setPeMin("");
    setPeMax("");
    setEpsMin("");
    setEpsMax("");
    setDivYieldMin("");
    setDivYieldMax("");
    setRevenueMin("");
    setRevenueMax("");
    setProfitMin("");
    setProfitMax("");
    setDebtMin("");
    setDebtMax("");
    setRsiMin("");
    setRsiMax("");
    setMaRelation("");
    setPage(1);
    setSortField("symbol");
    setSortDesc(false);
  };

  const toggleSort = (field: string) => {
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
        {/* Additional filters can be added here */}
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
      {isError && <p className="text-center text-red-600 py-8" role="alert">Error loading stocks: {(error as Error).message}</p>}
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
                <th className="px-4 py-2 text-left">Market Cap</th>
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
                  <td className="px-4 py-2"><FreshnessBadge freshness="Synthetic" /></td>
                  <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => watchlist.addToWatchlist(stock.id)} className="text-primary hover:text-primary-dark" aria-label={`Add ${stock.symbol} to watchlist`}>
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
