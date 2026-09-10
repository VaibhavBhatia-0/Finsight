import { Link, useParams } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { usePortfolio } from '../hooks/usePortfolios';

export default function PortfolioDetailPage() {
  const { id } = useParams(); const query = usePortfolio(id);
  if (query.isPending) return <Spinner />; if (query.error) return <p className="p-4 text-red-600">{query.error.message}</p>; if (!query.data) return null;
  const value = query.data;
  return <section className="p-4"><Link to="/portfolios" className="text-gold-700 hover:underline">← Portfolios</Link><h1 className="mt-3 text-2xl font-bold">{value.portfolio.name}</h1><div className="mt-5 grid gap-3 sm:grid-cols-3"><Card label="Total value" value={`${value.portfolio.baseCurrency} ${value.summary.totalValue.toLocaleString()}`} /><Card label="Cash" value={`${value.portfolio.baseCurrency} ${value.summary.cashBalance.toLocaleString()}`} /><Card label="Return" value={`${value.summary.totalReturnPercentage.toFixed(2)}%`} /></div><h2 className="mt-8 text-xl font-semibold">Holdings</h2>{value.holdings.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-full"><thead><tr><th className="text-left">Symbol</th><th className="text-right">Quantity</th><th className="text-right">Value</th><th className="text-right">P&amp;L</th><th className="text-right">Weight</th></tr></thead><tbody>{value.holdings.map(row => <tr key={row.stockId} className="border-t"><td className="py-2">{row.symbol}</td><td className="text-right">{row.quantity}</td><td className="text-right">{row.marketValue.toLocaleString()}</td><td className="text-right">{row.unrealizedPnL.toLocaleString()}</td><td className="text-right">{row.weight.toFixed(2)}%</td></tr>)}</tbody></table></div> : <p className="mt-3">No holdings yet.</p>} {value.risk.status && <p className="mt-6 text-sm text-gray-600">Risk metrics unavailable: {value.risk.status.replace(/_/g, ' ').toLowerCase()}.</p>}</section>;
}
function Card({label,value}:{label:string;value:string}) { return <div className="rounded border p-4"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }
