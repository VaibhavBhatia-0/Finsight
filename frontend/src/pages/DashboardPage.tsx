import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { FinanceSummary, MarketOverview } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import { Spinner } from '../components/Spinner';
import { usePortfolios } from '../hooks/usePortfolios';
import { useWatchlist } from '../hooks/useWatchlist';
import { useUserPreferences, type DashboardSectionId } from '../context/UserPreferencesContext';
import { useInsights } from '../hooks/useInsights';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const portfolios = usePortfolios();
  const watchlists = useWatchlist();
  const markets = useQuery({ queryKey: ['markets-overview'], queryFn: async () => (await api.get<MarketOverview>(endpoints.markets.overview)).data });
  const finance = useQuery({ queryKey: ['finance-summary'], queryFn: async () => (await api.get<FinanceSummary>(endpoints.finance.summary)).data });
  const insights = useInsights();
  const { user } = useAuth();
  const { preferences, setVisibility } = useUserPreferences();
  if ([portfolios, watchlists, markets, finance, insights].some(query => query.isPending)) return <Spinner />;
  const error = portfolios.error || watchlists.error || markets.error || finance.error || insights.error;
  if (error) return <p className="p-4 text-red-600">{error.message}</p>;
  const currencies = new Set(portfolios.data?.map(item => item.portfolio.baseCurrency));
  const combinedPortfolioValue = currencies.size <= 1 ? portfolios.data?.reduce((sum, item) => sum + item.summary.totalValue, 0) ?? 0 : null;
  const portfolioCurrency = currencies.values().next().value ?? preferences.defaultCurrency;
  const sections: Record<DashboardSectionId, React.ReactNode> = {
    summary: <Section title="Portfolio summary"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Combined value" value={combinedPortfolioValue === null ? 'Multiple currencies' : format(combinedPortfolioValue, portfolioCurrency)} /><Metric label="Income" value={format(finance.data?.overview.totalIncome ?? 0, finance.data?.currency ?? preferences.defaultCurrency)} /><Metric label="Investable surplus" value={format(finance.data?.overview.estimatedInvestableSurplus ?? 0, finance.data?.currency ?? preferences.defaultCurrency)} /></div></Section>,
    indices: <Section title="Market indices"><p className="mb-2 text-xs text-orange-700">Synthetic development data</p><div className="grid gap-3 sm:grid-cols-2">{markets.data?.indices.filter(index => preferences.selectedMarketIndices.includes(index.code)).map(index => <Metric key={index.code} label={index.name} value={`${index.currency} ${index.price.toLocaleString()} (${index.changePercent.toFixed(2)}%)`} />)}</div></Section>,
    watchlist: <Section title="Watchlist snapshot"><ul className="divide-y">{watchlists.data?.flatMap(list => list.items).slice(0, 5).map(item => <li key={item.stock_id} className="py-2"><Link className="font-mono text-gold-700" to={`/markets/${item.symbol}`}>{item.symbol}</Link> <span className="ml-3">{item.company_name}</span></li>)}</ul></Section>,
    labLaunch: <Section title="FinSight Lab"><div className="flex flex-wrap gap-2"><LinkButton to="/lab/single-investment">Single investment</LinkButton><LinkButton to="/lab/recurring-investment">Recurring investment</LinkButton><LinkButton to="/lab/portfolio-scenario">Portfolio scenario</LinkButton><LinkButton to="/lab/backtest">Backtest strategy</LinkButton></div></Section>,
    insights: <Section title="Insights"><div className="space-y-2">{insights.data?.insights.slice(0, 3).map(item => <div key={item.id} className="rounded border p-3"><p className="font-medium">{item.title}</p><p className="text-sm text-gray-600">{item.message}</p></div>)}{insights.data?.insights.length === 0 && <p className="text-sm text-gray-600">Add finance or portfolio data to generate deterministic observations.</p>}</div><Link className="mt-2 inline-block text-gold-700" to="/insights">View all insights</Link></Section>,
  };
  return <section className="mx-auto max-w-5xl p-4"><h1 className="mb-6 text-3xl font-bold">Dashboard</h1>{user && !user.emailVerified && <p className="mb-5 rounded border border-orange-400 bg-orange-50 p-3 text-sm text-orange-900">Your email is not verified. <Link className="underline" to="/verify-email">Request a verification link.</Link></p>}{preferences.order.filter(id => preferences.visible[id]).map(id => <div key={id} className="relative"><button onClick={() => { void setVisibility(id, false).catch(() => undefined); }} className="absolute right-0 top-0 text-xs text-gray-500">Hide</button>{sections[id]}</div>)}<div className="flex gap-2">{preferences.order.filter(id => !preferences.visible[id]).map(id => <button key={id} onClick={() => { void setVisibility(id, true).catch(() => undefined); }} className="rounded border px-3 py-1 text-sm">Show {id}</button>)}</div></section>;
}

function Section({title,children}:{title:string;children:React.ReactNode}) { return <section className="mb-8"><h2 className="mb-3 text-xl font-semibold">{title}</h2>{children}</section>; }
function Metric({label,value}:{label:string;value:string}) { return <div className="rounded border p-3"><p className="text-sm text-gray-500">{label}</p><p className="font-semibold">{value}</p></div>; }
function LinkButton({to,children}:{to:string;children:React.ReactNode}) { return <Link to={to} className="rounded border border-gold-600 px-3 py-2 text-gold-700">{children}</Link>; }
function format(value:number,currency:string) { return new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:2}).format(value); }
