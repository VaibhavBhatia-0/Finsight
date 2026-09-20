import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '../api/client';
import type { MarketStock } from '../api/contracts';
import { endpoints } from '../api/endpoints';

interface StockSearchInputProps {
  label: string;
  value: string;
  onChange: (symbol: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}

export default function StockSearchInput({ label, value, onChange, onBlur, placeholder = 'Search symbol or company' }: StockSearchInputProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const query = useQuery({
    queryKey: ['lab-stock-search', value],
    queryFn: async () => (await api.get<MarketStock[]>(endpoints.markets.stocks, { params: { q: value.trim() } })).data,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <label className="stock-search-field block text-sm font-medium">
      {label}
      <span className="stock-search-control">
        <Search size={16} aria-hidden />
        <input
          value={value}
          onChange={event => { onChange(event.target.value.toUpperCase()); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { onBlur?.(); closeTimer.current = setTimeout(() => setOpen(false), 120); }}
          className="mt-1 w-full px-3 py-2"
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
      </span>
      {open && <span className="stock-search-menu" role="listbox">
        {query.isPending && <span className="stock-search-state">Searching catalogue…</span>}
        {query.error && <span className="stock-search-state error-banner">Stock search unavailable</span>}
        {query.data?.map(stock => (
          <button key={stock.id} type="button" role="option" aria-selected={stock.symbol === value} onMouseDown={event => event.preventDefault()} onClick={() => { onChange(stock.symbol); setOpen(false); }}>
            <span className="symbol-token">{stock.symbol.slice(0, 2)}</span>
            <span><strong>{stock.symbol}</strong><small>{stock.company_name}</small></span>
            <em>{stock.exchange_code} · {stock.currency}</em>
          </button>
        ))}
        {!query.isPending && query.data?.length === 0 && <span className="stock-search-state">No matching listed asset.</span>}
        <span className="stock-search-source">Development catalogue · quotes may be synthetic</span>
      </span>}
    </label>
  );
}
