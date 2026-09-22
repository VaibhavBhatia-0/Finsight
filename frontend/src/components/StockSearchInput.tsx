import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import api from '../api/client';
import type { SecuritySearchItem, SecuritySearchResponse } from '../api/contracts';
import { endpoints } from '../api/endpoints';

interface StockSearchInputProps {
  label: string;
  value: string;
  onChange: (symbol: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  onSelect?: (security: SecuritySearchItem | null) => void;
}

export default function StockSearchInput({ label, value, onChange, onBlur, onSelect, placeholder = 'Search symbol, company, exchange, or market' }: StockSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<SecuritySearchItem | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const listboxId = useId();
  const debouncedValue = useDebouncedValue(value.trim(), 250);
  const query = useQuery({
    queryKey: ['security-search', debouncedValue],
    queryFn: async () => (await api.get<SecuritySearchResponse>(endpoints.markets.securitySearch, { params: { q: debouncedValue, page: 1, pageSize: 20 } })).data.items,
    enabled: open && debouncedValue.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => { if (!value) setSelected(null); }, [value]);
  useEffect(() => setActiveIndex(query.data?.length ? 0 : -1), [query.data]);

  function choose(security: SecuritySearchItem) {
    const symbol = security.providerSymbol ?? security.provider_symbol ?? security.symbol;
    setSelected(security); onChange(symbol); onSelect?.(security); setOpen(false);
  }
  function clear() { setSelected(null); onChange(''); onSelect?.(null); setOpen(true); }

  return (
    <div className="stock-search-field block text-sm font-medium">
      <label htmlFor={`${listboxId}-input`}>{label}</label>
      <span className="stock-search-control">
        <Search size={16} aria-hidden />
        <input
          id={`${listboxId}-input`}
          value={value}
          onChange={event => { setSelected(null); onSelect?.(null); onChange(event.target.value.toUpperCase()); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { onBlur?.(); closeTimer.current = setTimeout(() => setOpen(false), 120); }}
          onKeyDown={event => {
            const rows = query.data ?? [];
            if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex(index => Math.min(rows.length - 1, index + 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(0, index - 1)); }
            if (event.key === 'Enter' && open && activeIndex >= 0 && rows[activeIndex]) { event.preventDefault(); choose(rows[activeIndex]); }
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
          }}
          className="mt-1 w-full px-3 py-2"
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        />
        {value && <button type="button" className="stock-search-clear" aria-label={`Clear ${label}`} onMouseDown={event => event.preventDefault()} onClick={clear}><X size={14} /></button>}
      </span>
      {selected && <span className="stock-search-selection">Selected · {selected.exchange} · {selected.country} · {selected.currency}</span>}
      {open && value.trim() && <span id={listboxId} className="stock-search-menu" role="listbox">
        {query.isFetching && <span className="stock-search-state" role="status">Searching catalogue…</span>}
        {query.error && <span className="stock-search-state error-banner">Stock search unavailable</span>}
        {query.data?.map((stock, index) => (
          <button id={`${listboxId}-${index}`} key={stock.id} type="button" role="option" className={activeIndex === index ? 'active' : ''} aria-selected={selected?.id === stock.id} onMouseEnter={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(stock)}>
            <span className="symbol-token">{stock.symbol.slice(0, 2)}</span>
            <span><strong>{stock.providerSymbol ?? stock.provider_symbol ?? stock.symbol}</strong><small>{stock.name}</small></span>
            <em>{stock.exchange} · {stock.country} · {stock.currency}</em>
          </button>
        ))}
        {!query.isFetching && query.data?.length === 0 && <span className="stock-search-state">No matching listed security.</span>}
        <span className="stock-search-source">Full reference universe · quotes load only after selection</span>
      </span>}
    </div>
  );
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [delay, value]);
  return debounced;
}
