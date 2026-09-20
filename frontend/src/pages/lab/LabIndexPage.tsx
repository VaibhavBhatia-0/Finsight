import { ArrowUpRight, BarChart3, FlaskConical, Landmark, Repeat2, Scale, SplitSquareVertical } from 'lucide-react';
import { Link } from 'react-router-dom';

const scenarioTools = [
  { to: '/lab/single-investment', icon: Landmark, title: 'Single investment', tag: 'Scenario engine', description: 'Replay a lump-sum investment through historical prices, FX, fees, dividends, and optional tax estimates.' },
  { to: '/lab/recurring-investment', icon: Repeat2, title: 'Recurring / DCA', tag: 'Scenario engine', description: 'Schedule recurring contributions and preserve every dated cash flow for XIRR.' },
  { to: '/lab/portfolio-scenario', icon: SplitSquareVertical, title: 'Portfolio scenario', tag: 'Scenario engine', description: 'Model weighted assets together and reconcile performance attribution.' },
  { to: '/lab/compare', icon: Scale, title: 'Compare scenarios', tag: 'Normalized metrics', description: 'Compare saved scenarios without treating different currencies as equivalent.' },
];

export default function LabIndexPage() {
  return (
    <main className="lab-index-page">
      <header className="page-heading">
        <div><p className="page-eyebrow">Research sandbox</p><h1>FinSight Lab</h1><p className="page-subtitle">Explore historical what-if questions with explicit assumptions. Scenario simulation and strategy backtesting remain separate workflows.</p></div>
        <FlaskConical size={30} className="text-gold-400" aria-hidden />
      </header>

      <section className="mb-8">
        <div className="panel-header"><div><h2 className="panel-title">Scenario engine</h2><p className="panel-subtitle">Single, recurring, and portfolio simulations use distinct calculation paths.</p></div><span className="freshness-badge">Synthetic history</span></div>
        <div className="lab-tool-grid">
          {scenarioTools.map(({ to, icon: Icon, title, tag, description }) => (
            <Link className="lab-tool-card" to={to} key={to}>
              <div className="lab-tool-icon"><Icon size={21} /></div><ArrowUpRight className="action-arrow" size={16} />
              <p className="lab-tool-tag">{tag}</p><h2>{title}</h2><p>{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel lab-backtest-callout">
        <div><p className="page-eyebrow">Canonical backtesting engine</p><h2>Backtest a portfolio strategy</h2><p>Lab Backtest Strategy and Analyze Backtesting share one engine and one stored result contract.</p></div>
        <Link className="btn-primary inline-flex items-center gap-2 px-4 py-2" to="/lab/backtest"><BarChart3 size={16} /> Configure backtest</Link>
      </section>
    </main>
  );
}
