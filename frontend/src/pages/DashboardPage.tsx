import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BarChart3, BriefcaseBusiness, FlaskConical, Landmark, Repeat2, Sparkles, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { FinanceSummary, MarketOverview } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import { AllocationDonut, PositionPerformanceChart } from '../components/DashboardCharts';
import { Spinner } from '../components/Spinner';
import { useUserPreferences, type DashboardSectionId } from '../context/UserPreferencesContext';
import { useAuth } from '../hooks/useAuth';
import { useInsights } from '../hooks/useInsights';
import { usePortfolios, usePortfolioTransactions } from '../hooks/usePortfolios';
import { useWatchlist } from '../hooks/useWatchlist';

export default function DashboardPage() {
  const portfolios = usePortfolios();
  const watchlists = useWatchlist();
  const markets = useQuery({ queryKey: ['markets-overview'], queryFn: async () => (await api.get<MarketOverview>(endpoints.markets.overview)).data });
  const finance = useQuery({ queryKey: ['finance-summary'], queryFn: async () => (await api.get<FinanceSummary>(endpoints.finance.summary)).data });
  const insights = useInsights();
  const { user } = useAuth();
  const { preferences, setVisibility } = useUserPreferences();
  const focusPortfolio = portfolios.data?.[0];
  const portfolioTransactions = usePortfolioTransactions(focusPortfolio?.portfolio.id);

  if ([portfolios, watchlists, markets, finance, insights].some(query => query.isPending) || (focusPortfolio && portfolioTransactions.isPending)) return <Spinner />;

  const currencies = new Set(portfolios.data?.map(item => item.portfolio.baseCurrency));
  const combinedValue = currencies.size <= 1 ? portfolios.data?.reduce((sum, item) => sum + item.summary.totalValue, 0) ?? 0 : null;
  const portfolioCurrency = currencies.values().next().value ?? preferences.defaultCurrency;
  const financeCurrency = finance.data?.currency ?? preferences.defaultCurrency;
  const allWatchItems = watchlists.data?.flatMap(list => list.items) ?? [];
  const focusHoldings = focusPortfolio?.holdings ?? [];
  const rankedHoldings = focusHoldings.slice().sort((a, b) => b.unrealizedPnLPct - a.unrealizedPnLPct);
  const bestHolding = rankedHoldings[0];
  const worstHolding = rankedHoldings[rankedHoldings.length - 1];
  const cashWeight = focusPortfolio?.summary.totalValue ? Math.max(0, focusPortfolio.summary.cashBalance / focusPortfolio.summary.totalValue * 100) : 0;

  const sections: Record<DashboardSectionId, React.ReactNode> = {
    summary: (
      <div className="dashboard-overview">
        <div className="metric-grid">
          <Metric label="Net portfolio value" value={combinedValue === null ? 'Multi-currency' : money(combinedValue, portfolioCurrency)} note={`${portfolios.data?.length ?? 0} portfolios`} />
          <Metric label="Cost basis" value={focusPortfolio ? money(focusPortfolio.summary.costBasis, focusPortfolio.portfolio.baseCurrency) : '—'} note={focusPortfolio?.portfolio.name ?? 'No focus portfolio'} />
          <Metric label="Best performer" value={bestHolding?.symbol ?? '—'} tone={bestHolding && bestHolding.unrealizedPnLPct >= 0 ? 'up' : undefined} note={bestHolding ? `${signed(bestHolding.unrealizedPnLPct)}% unrealized` : 'No holdings yet'} />
          <Metric label="Worst performer" value={worstHolding?.symbol ?? '—'} tone={worstHolding && worstHolding.unrealizedPnLPct < 0 ? 'down' : undefined} note={worstHolding ? `${signed(worstHolding.unrealizedPnLPct)}% unrealized` : 'No holdings yet'} />
        </div>

        <div className="portfolio-analytics-grid">
          <section className="panel performance-panel">
            <div className="panel-header"><div><p className="page-eyebrow">Portfolio telemetry</p><h2 className="panel-title">Position performance</h2><p className="panel-subtitle">Allocation weight vs unrealized return · {focusPortfolio?.portfolio.name ?? 'No portfolio selected'}</p></div>{focusPortfolio && <span className="freshness-badge">Current valuation</span>}</div>
            <PositionPerformanceChart holdings={focusHoldings} />
          </section>
          <section className="panel allocation-panel">
            <div className="panel-header"><div><h2 className="panel-title">Asset allocation</h2><p className="panel-subtitle">Including available cash</p></div></div>
            <AllocationDonut holdings={focusHoldings} cashWeight={cashWeight} />
            <div className="allocation-legend">{focusHoldings.slice().sort((a, b) => b.weight - a.weight).slice(0, 4).map(row => <div key={row.stockId}><span><i />{row.symbol}</span><strong>{row.weight.toFixed(1)}%</strong></div>)}</div>
          </section>
        </div>

        <section className="panel dashboard-ledger">
          <div className="panel-header"><div><h2 className="panel-title">Recent portfolio activity</h2><p className="panel-subtitle">Latest entries from the authoritative ledger</p></div>{focusPortfolio && <Link to={`/portfolios/${focusPortfolio.portfolio.id}`}>Open portfolio <ArrowUpRight size={13} /></Link>}</div>
          {portfolioTransactions.error ? <p className="error-banner" role="alert">Portfolio activity is temporarily unavailable.</p> : portfolioTransactions.data?.length ? <div className="overflow-x-auto"><table><thead><tr><th className="text-left">Asset</th><th className="text-left">Type</th><th className="text-right">Units</th><th className="text-right">Total value</th><th className="text-right">Date</th></tr></thead><tbody>{portfolioTransactions.data.slice(0, 5).map(row => <tr key={row.id}><td><strong>{row.symbol ?? 'Cash'}</strong>{row.company_name && <span className="ml-2 text-xs text-gray-500">{row.company_name}</span>}</td><td><span className={`ledger-pill ${row.transaction_type.toLowerCase()}`}>{row.transaction_type}</span></td><td className="text-right font-mono">{row.quantity == null ? '—' : Number(row.quantity).toLocaleString()}</td><td className="text-right font-mono">{row.currency} {Number(row.amount).toLocaleString()}</td><td className="text-right">{row.transaction_date.slice(0, 10)}</td></tr>)}</tbody></table></div> : <Empty text="Portfolio activity appears here after your first ledger entry." link="/portfolios" label="Open portfolios" />}
        </section>

        <section className="finance-snapshot" aria-label="Personal finance snapshot">
          <MiniMetric label="Income" value={money(finance.data?.overview.totalIncome ?? 0, financeCurrency)} />
          <MiniMetric label="Expenses" value={money(finance.data?.overview.totalExpense ?? 0, financeCurrency)} tone="down" />
          <MiniMetric label="Net savings" value={money(finance.data?.overview.netSavings ?? 0, financeCurrency)} tone={(finance.data?.overview.netSavings ?? 0) >= 0 ? 'up' : 'down'} />
          <MiniMetric label="Investable surplus" value={money(finance.data?.overview.estimatedInvestableSurplus ?? 0, financeCurrency)} />
        </section>
      </div>
    ),
    indices: (
      <Panel title="Market pulse" subtitle="Timestamped provider feed" action={<Link to="/markets">View markets <ArrowUpRight size={13} /></Link>}>
        {markets.error ? <p className="error-banner" role="alert">Market data is temporarily unavailable; the rest of your dashboard remains usable.</p> : <div className="data-list">
          {markets.data?.indices.filter(index => preferences.selectedMarketIndices.includes(index.code)).map(index => (
            <div className="data-row" key={index.code}>
              <div><strong>{index.name}</strong><p>{index.country} · {index.currency}</p></div>
              <div className="text-right"><strong className="font-mono">{index.price.toLocaleString()}</strong><p className={movementClass(index.changePercent)}>{formatChange(index.changePercent)}</p></div>
            </div>
          ))}
        </div>}
      </Panel>
    ),
    watchlist: (
      <Panel title="Watchlist" subtitle={`${allWatchItems.length} tracked assets`} action={<Link to="/watchlist">Open list <ArrowUpRight size={13} /></Link>}>
        {watchlists.error ? <p className="error-banner" role="alert">Watchlist data is temporarily unavailable.</p> : allWatchItems.length ? <div className="data-list">{allWatchItems.slice(0, 5).map(item => (
          <Link to={`/markets/${item.symbol}`} className="data-row" key={`${item.watchlist_id}-${item.stock_id}`}>
            <div className="flex items-center gap-3"><span className="symbol-token">{item.symbol.slice(0, 2)}</span><div><strong>{item.symbol}</strong><p>{item.company_name}</p></div></div>
            <div className="text-right">{item.quote ? <><strong className="font-mono">{item.currency} {item.quote.price.toFixed(2)}</strong><p className={movementClass(item.quote.changePercent)}>{formatChange(item.quote.changePercent)}</p></> : <><strong>N/A</strong><p>Unavailable</p></>}</div>
          </Link>
        ))}</div> : <Empty text="Your watchlist is ready for its first asset." link="/markets" label="Browse markets" />}
      </Panel>
    ),
    labLaunch: (
      <section>
        <div className="panel-header"><div><h2 className="panel-title">FinSight Lab</h2><p className="panel-subtitle">Scenario exploration and strategy backtesting, kept deliberately separate.</p></div></div>
        <div className="action-grid">
          <Action to="/lab/single-investment" icon={Landmark} title="Single investment" description="Replay one historical investment with fees, FX, dividends, and tax estimates." />
          <Action to="/lab/recurring-investment" icon={Repeat2} title="Recurring / DCA" description="Model scheduled contributions on their actual historical dates." />
          <Action to="/lab/portfolio-scenario" icon={BriefcaseBusiness} title="Portfolio scenario" description="Explore a weighted multi-asset allocation and attribution." />
          <Action to="/lab/backtest" icon={BarChart3} title="Backtest strategy" description="Run the canonical portfolio backtesting engine." />
        </div>
      </section>
    ),
    insights: (
      <Panel title="Ledger insights" subtitle="Deterministic observations, not advice" action={<Link to="/insights">View all <ArrowUpRight size={13} /></Link>}>
        {insights.error ? <p className="error-banner" role="alert">Insights are temporarily unavailable.</p> : insights.data?.insights.length ? <div className="data-list">{insights.data.insights.slice(0, 3).map(item => (
          <div className="data-row" key={item.id}><div className="flex gap-3"><Sparkles size={16} className="mt-1 text-gold-400" /><div><strong>{item.title}</strong><p>{item.message}</p></div></div>{item.metric && <span className="font-mono text-xs text-gold-400">{item.metric.value.toFixed(2)} {item.metric.unit}</span>}</div>
        ))}</div> : <Empty text="Add finance or portfolio data to generate observations." />}
      </Panel>
    ),
  };

  return (
    <main className="dashboard-page">
      <header className="page-heading">
        <div><p className="page-eyebrow">Personal command center</p><h1>Good {greeting()}, {firstName(user?.name)}</h1><p className="page-subtitle">A unified view of your portfolios, cash flow, research list, and analytical work.</p></div>
        <Link className="btn-primary inline-flex items-center gap-2 px-4 py-2" to="/finance/transactions"><WalletCards size={16} /> Add transaction</Link>
      </header>

      {user && !user.emailVerified && <div className="notice mb-5 p-3 text-sm">Your email is not verified. <Link className="text-gold-300 underline" to="/verify-email">Request a verification link.</Link></div>}

      {(portfolios.error || finance.error) && <div className="error-banner mb-5" role="alert">Some account totals are temporarily unavailable. Navigation and unaffected dashboard sections remain available.</div>}

      <div className="content-stack">
        {preferences.order.filter(id => preferences.visible[id]).map(id => (
          <section key={id} className={id === 'summary' || id === 'labLaunch' ? '' : 'dashboard-section'}>
            <button onClick={() => { void setVisibility(id, false).catch(() => undefined); }} className="dashboard-hide">Hide</button>
            {sections[id]}
          </section>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">{preferences.order.filter(id => !preferences.visible[id]).map(id => <button key={id} onClick={() => { void setVisibility(id, true).catch(() => undefined); }} className="btn-secondary px-3 py-2 text-xs">Restore {id}</button>)}</div>
    </main>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-header"><div><h2 className="panel-title">{title}</h2><p className="panel-subtitle">{subtitle}</p></div>{action && <div className="panel-action">{action}</div>}</div>{children}</section>;
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'up' | 'down' }) {
  return <article className="metric-card"><p className="metric-label">{label}</p><p className={`metric-value${tone ? ` movement-${tone}` : ''}`}>{value}</p><p className="metric-note">{note}</p></article>;
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return <article><p>{label}</p><strong className={tone ? `movement-${tone}` : ''}>{value}</strong></article>;
}

function Action({ to, icon: Icon, title, description }: { to: string; icon: typeof FlaskConical; title: string; description: string }) {
  return <Link className="action-card" to={to}><Icon size={20} /><ArrowUpRight className="action-arrow" size={15} /><div><h2>{title}</h2><p>{description}</p></div></Link>;
}

function Empty({ text, link, label }: { text: string; link?: string; label?: string }) {
  return <div className="empty-state"><p>{text}</p>{link && <Link className="mt-3 inline-block text-sm text-gold-300" to={link}>{label}</Link>}</div>;
}

function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
function signed(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`; }
function firstName(name?: string | null) { return name?.trim().split(/\s+/)[0] || 'Investor'; }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'; }
function movementClass(value: number | null) { return value == null ? '' : value >= 0 ? 'movement-up' : 'movement-down'; }
function formatChange(value: number | null) { return value == null ? 'N/A' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
