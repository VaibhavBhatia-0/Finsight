import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Spinner } from '../components/Spinner';
import { usePortfolios } from '../hooks/usePortfolios';
import { useWatchlist } from '../hooks/useWatchlist';
import { useUserPreferences } from '../context/UserPreferencesContext';

interface Overview { indices: Array<{ code: string; name: string; currency: string; price: number; changePercent: number }> }
interface FinanceSummary { overview: { totalIncome: number; totalExpense: number; netSavings: number; estimatedInvestableSurplus: number } }

export default function DashboardPage() {
  const portfolios = usePortfolios();
  const watchlists = useWatchlist();
  const markets = useQuery({ queryKey: ['markets-overview'], queryFn: async () => (await api.get<Overview>('/api/v1/markets/overview')).data });
  const finance = useQuery({ queryKey: ['finance-summary'], queryFn: async () => (await api.get<FinanceSummary>('/api/v1/finance/summary')).data });
  const { preferences, setVisibility } = useUserPreferences();
  if ([portfolios, watchlists, markets, finance].some(query => query.isPending)) return <Spinner />;
  const error = portfolios.error || watchlists.error || markets.error || finance.error;
  if (error) return <p className="p-4 text-red-600">{error.message}</p>;
  const sections: Record<string, React.ReactNode> = {
    summary: <Section title="Portfolio summary"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Combined value" value={format(portfolios.data?.reduce((sum, item) => sum + item.summary.totalValue, 0) ?? 0, 'INR')} /><Metric label="Income" value={format(finance.data?.overview.totalIncome ?? 0, 'INR')} /><Metric label="Investable surplus" value={format(finance.data?.overview.estimatedInvestableSurplus ?? 0, 'INR')} /></div></Section>,
    indices: <Section title="Market indices"><p className="mb-2 text-xs text-orange-700">Synthetic development data</p><div className="grid gap-3 sm:grid-cols-2">{markets.data?.indices.map(index => <Metric key={index.code} label={index.name} value={`${index.currency} ${index.price.toLocaleString()} (${index.changePercent.toFixed(2)}%)`} />)}</div></Section>,
    watchlist: <Section title="Watchlist snapshot"><ul className="divide-y">{watchlists.data?.flatMap(list => list.items).slice(0, 5).map(item => <li key={item.stock_id} className="py-2"><Link className="font-mono text-gold-700" to={`/markets/${item.symbol}`}>{item.symbol}</Link> <span className="ml-3">{item.company_name}</span></li>)}</ul></Section>,
    labLaunch: <Section title="FinSight Lab"><div className="flex flex-wrap gap-2"><LinkButton to="/lab/single-investment">Single investment</LinkButton><LinkButton to="/lab/recurring-investment">Recurring investment</LinkButton><LinkButton to="/lab/portfolio-scenario">Portfolio scenario</LinkButton><LinkButton to="/lab/backtest">Backtest strategy</LinkButton></div></Section>,
  };
  return <section className="mx-auto max-w-5xl p-4"><h1 className="mb-6 text-3xl font-bold">Dashboard</h1>{preferences.order.filter(id => preferences.visible[id]).map(id => <div key={id} className="relative"><button onClick={() => setVisibility(id, false)} className="absolute right-0 top-0 text-xs text-gray-500">Hide</button>{sections[id]}</div>)}<div className="flex gap-2">{Object.entries(preferences.visible).filter(([,visible]) => !visible).map(([id]) => <button key={id} onClick={() => setVisibility(id,true)} className="rounded border px-3 py-1 text-sm">Show {id}</button>)}</div></section>;
}

function Section({title,children}:{title:string;children:React.ReactNode}) { return <section className="mb-8"><h2 className="mb-3 text-xl font-semibold">{title}</h2>{children}</section>; }
function Metric({label,value}:{label:string;value:string}) { return <div className="rounded border p-3"><p className="text-sm text-gray-500">{label}</p><p className="font-semibold">{value}</p></div>; }
function LinkButton({to,children}:{to:string;children:React.ReactNode}) { return <Link to={to} className="rounded border border-gold-600 px-3 py-2 text-gold-700">{children}</Link>; }
function format(value:number,currency:string) { return new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:2}).format(value); }
