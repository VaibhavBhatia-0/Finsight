import { ArrowUpRight, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { useBacktests } from '../hooks/useBacktest';

export default function BacktestingPage() {
  const { data, isLoading, error } = useBacktests();
  if (isLoading) return <Spinner />;
  if (error) return <div className="error-banner" role="alert">Error loading backtest data</div>;
  const best = data?.length ? Math.max(...data.map(item => item.summary.returnPercentage)) : null;
  const latest = data?.[0];

  return <main>
    <header className="page-heading">
      <div><p className="page-eyebrow">Analyze</p><h1>Backtesting</h1><p className="page-subtitle">Review every stored strategy run produced by the same canonical engine used in FinSight Lab.</p></div>
      <Link to="/lab/backtest" className="btn-primary inline-flex items-center gap-2 px-4 py-2"><BarChart3 size={16} /> Run backtest</Link>
    </header>
    <div className="metric-grid mb-4">
      <Metric label="Completed runs" value={String(data?.length ?? 0)} note="Canonical engine" />
      <Metric label="Best recorded return" value={best == null ? '—' : `${best.toFixed(2)}%`} note="Across completed runs" />
      <Metric label="Latest strategy" value={latest?.details.strategyType.replace(/_/g, ' ') ?? '—'} note={latest ? new Date(latest.createdAt).toLocaleDateString() : 'No run history'} />
    </div>
    <section className="panel">
      <div className="panel-header"><div><h2 className="panel-title">Run history</h2><p className="panel-subtitle">Stored inputs and reconciled output summaries</p></div><span className="freshness-badge">Historical</span></div>
      {data?.length ? <div className="overflow-x-auto"><table><thead><tr><th className="text-left">Created</th><th className="text-left">Strategy</th><th className="text-right">Invested</th><th className="text-right">Final value</th><th className="text-right">Return</th><th className="text-right">CAGR</th></tr></thead><tbody>{data.map(backtest => <tr key={backtest.id}><td>{new Date(backtest.createdAt).toLocaleDateString()}</td><td>{backtest.details.strategyType.replace(/_/g, ' ')}</td><td className="text-right font-mono">{backtest.summary.totalInvested.toLocaleString()}</td><td className="text-right font-mono">{backtest.summary.finalValue.toLocaleString()}</td><td className={`text-right font-mono ${backtest.summary.returnPercentage >= 0 ? 'movement-up' : 'movement-down'}`}>{backtest.summary.returnPercentage.toFixed(2)}%</td><td className="text-right font-mono">{backtest.summary.cagr == null ? '—' : `${backtest.summary.cagr.toFixed(2)}%`}</td></tr>)}</tbody></table></div> : <div className="empty-state"><BarChart3 className="mx-auto mb-3 text-gold-400" /><p>No backtests have been run.</p><Link to="/lab/backtest" className="mt-3 inline-flex items-center gap-2 text-sm text-gold-300">Configure the first run <ArrowUpRight size={14} /></Link></div>}
    </section>
  </main>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-note">{note}</p></article>; }
