import { ArrowUpRight, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import FreshnessBadge from '../components/FreshnessBadge';
import { useWatchlist } from '../hooks/useWatchlist';
import StockSearchInput from '../components/StockSearchInput';

export default function WatchlistPage() {
  const value = useWatchlist();
  const [search, setSearch] = useState('');
  if (value.isPending) return <Spinner />;
  if (value.error) return <p className="error-banner">{value.error.message}</p>;
  const itemCount = value.data?.reduce((sum, list) => sum + list.items.length, 0) ?? 0;
  return <main>
    <header className="page-heading"><div><p className="page-eyebrow">Invest</p><h1>Watchlist</h1><p className="page-subtitle">A focused research list using the same timestamped provider quotes as Markets and portfolio valuation.</p></div><Link className="btn-primary inline-flex items-center gap-2 px-4 py-2" to="/markets">Browse markets <ArrowUpRight size={15} /></Link></header>
    <div className="metric-grid mb-4"><article className="metric-card"><p className="metric-label">Tracked assets</p><p className="metric-value">{itemCount}</p><p className="metric-note">Across {value.data?.length ?? 0} lists</p></article></div>
    <section className="panel mb-4"><div className="max-w-xl"><StockSearchInput label="Add a listed security" value={search} onChange={setSearch} onSelect={security => { if (security) { value.addToWatchlist(security.id); setSearch(''); } }} /></div></section>
    {value.removeError && <p className="error-banner">{value.removeError.message}</p>}
    {value.data?.map(list => <section key={list.id} className="panel mb-4"><div className="panel-header"><div><h2 className="panel-title">{list.name}</h2><p className="panel-subtitle">{list.items.length} saved assets</p></div><span className="freshness-badge">Provider quotes</span></div>{list.items.length ? <div className="overflow-x-auto"><table><thead><tr><th className="text-left">Asset</th><th className="text-left">Exchange</th><th className="text-left">Sector</th><th className="text-right">Price</th><th className="text-right">Change</th><th>Freshness</th><th></th></tr></thead><tbody>{list.items.map(item => <tr key={item.stock_id}><td><Link to={`/markets/${item.symbol}`} className="flex items-center gap-3"><span className="symbol-token">{item.symbol.slice(0, 2)}</span><span><strong className="block font-mono">{item.symbol}</strong><span className="text-xs text-gray-500">{item.company_name}</span></span></Link></td><td>{item.exchange_code} · {item.country_code}</td><td>{item.sector ?? 'Unclassified'}</td><td className="text-right font-mono">{item.quote ? `${item.currency} ${item.quote.price.toFixed(2)}` : 'N/A'}</td><td className={`text-right font-mono ${movementClass(item.quote?.changePercent)}`}>{formatChange(item.quote?.changePercent)}</td><td>{item.quote ? <FreshnessBadge freshness={item.quote.freshnessLabel} timestamp={item.quote.marketTimestamp} /> : <FreshnessBadge freshness="UNAVAILABLE" />}</td><td className="text-right"><button onClick={() => value.removeFromWatchlist(list.id, item.stock_id)} className="text-sm text-red-600">Remove</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><Star className="mx-auto mb-3 text-gold-400" /><p>No stocks saved.</p></div>}</section>)}
  </main>;
}

function movementClass(value: number | null | undefined) { return value == null ? '' : value >= 0 ? 'movement-up' : 'movement-down'; }
function formatChange(value: number | null | undefined) { return value == null ? 'N/A' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
