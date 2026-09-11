import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import type { StockDetail } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import FreshnessBadge from '../components/FreshnessBadge';
import { Spinner } from '../components/Spinner';

export default function StockDetailPage() {
  const { symbol = '' } = useParams();
  const query = useQuery({
    queryKey: ['stock', symbol],
    queryFn: async () => (await api.get<StockDetail>(endpoints.markets.stock(symbol))).data,
    enabled: Boolean(symbol),
  });
  if (query.isPending) return <Spinner />;
  if (query.error) return <p role="alert" className="p-4 text-red-600">{query.error.message}</p>;
  if (!query.data) return null;
  const { stock, quote, fundamentals } = query.data;
  return <section className="mx-auto max-w-5xl p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{stock.company_name}</h1><p className="font-mono">{stock.symbol} · {stock.sector ?? 'Unclassified'}</p></div><FreshnessBadge freshness="Synthetic" timestamp={quote.timestamp} /></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Price" value={`${stock.currency} ${quote.price.toFixed(2)}`} /><Metric label="Daily change" value={`${quote.changePercent.toFixed(2)}%`} /><Metric label="P/E" value={fundamentals.peRatio.toFixed(2)} /><Metric label="Dividend yield" value={`${fundamentals.dividendYield.toFixed(2)}%`} /></div><p className="mt-6 rounded border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">Quote and fundamentals are deterministic synthetic development data.</p></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded border p-4"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}
