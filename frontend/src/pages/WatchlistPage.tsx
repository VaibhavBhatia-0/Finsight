import { Link } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { useWatchlist } from '../hooks/useWatchlist';

export default function WatchlistPage() {
  const value = useWatchlist();
  if (value.isPending) return <Spinner />;
  if (value.error) return <p className="p-4 text-red-600">{value.error.message}</p>;
  return <section className="p-4"><h1 className="text-2xl font-bold">Watchlists</h1>{value.removeError && <p className="text-red-600">{value.removeError.message}</p>}{value.data?.map(list => <div key={list.id} className="mt-6"><h2 className="text-xl font-semibold">{list.name}</h2>{list.items.length ? <ul className="mt-2 divide-y rounded border">{list.items.map(item => <li key={item.stock_id} className="flex items-center justify-between p-3"><Link to={`/markets/${item.symbol}`} className="font-mono text-gold-700">{item.symbol}</Link><span className="flex-1 px-4">{item.company_name}</span><button onClick={() => value.removeFromWatchlist(list.id, item.stock_id)} className="text-sm text-red-600">Remove</button></li>)}</ul> : <p className="mt-2">No stocks saved.</p>}</div>)}</section>;
}
