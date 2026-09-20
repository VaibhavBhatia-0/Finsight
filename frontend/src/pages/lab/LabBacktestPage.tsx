import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, Loader2 } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useBacktest, useRunBacktest } from '../../hooks/useBacktest';
import { usePortfolios } from '../../hooks/usePortfolios';

interface FormValues { portfolioId: string; startDate: string; endDate: string; amount: number }

export default function LabBacktestPage() {
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const queryClient = useQueryClient();
  const portfolios = usePortfolios();
  const runBacktest = useRunBacktest();
  const [backtestId, setBacktestId] = useState<string | null>(null);
  const { data: result, isLoading, isError, error } = useBacktest(backtestId ?? '', Boolean(backtestId));

  const onSubmit: SubmitHandler<FormValues> = async data => {
    const created = await runBacktest.mutateAsync({ portfolioId: Number(data.portfolioId), startDate: data.startDate, endDate: data.endDate, initialAmount: data.amount });
    setBacktestId(created.id);
    await queryClient.invalidateQueries({ queryKey: ['backtests'] });
  };

  return <main>
    <header className="page-heading"><div><p className="page-eyebrow">FinSight Lab · Backtesting engine</p><h1>Backtest strategy</h1><p className="page-subtitle">Run a portfolio through the canonical historical engine. This is strategy evaluation—not scenario simulation.</p></div><BarChart3 size={30} className="text-gold-400" /></header>
    <div className="content-grid lab-config-grid">
      <form onSubmit={handleSubmit(onSubmit)} className="panel space-y-4">
        <div className="panel-header"><div><h2 className="panel-title">Configuration</h2><p className="panel-subtitle">BUY_AND_HOLD · portfolio weights at run time</p></div><span className="freshness-badge">Synthetic history</span></div>
        <label className="block text-sm font-medium">Portfolio<select {...register('portfolioId', { required: true })} className="mt-1 w-full px-3 py-2"><option value="">Select portfolio</option>{portfolios.data?.map(item => <option value={item.portfolio.id} key={item.portfolio.id}>{item.portfolio.name} · {item.portfolio.baseCurrency}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Start date<input type="date" {...register('startDate', { required: true })} className="mt-1 w-full px-3 py-2" /></label><label className="block text-sm font-medium">End date<input type="date" {...register('endDate', { required: true })} className="mt-1 w-full px-3 py-2" /></label></div>
        <label className="block text-sm font-medium">Initial investment<input type="number" min="0.01" step="0.01" {...register('amount', { required: true, min: 0.01, valueAsNumber: true })} className="mt-1 w-full px-3 py-2" placeholder="10000" /></label>
        <div className="flex gap-2"><button type="submit" disabled={runBacktest.isPending || portfolios.isPending} className="btn-primary px-4 py-2">{runBacktest.isPending ? <span className="flex items-center"><Loader2 className="mr-2 animate-spin" size={16} />Running…</span> : 'Run backtest'}</button><button type="button" onClick={() => { reset(); setBacktestId(null); runBacktest.reset(); }} className="btn-secondary px-4 py-2">Reset</button></div>
        {runBacktest.error && <p className="error-banner" role="alert">Unable to run backtest: {runBacktest.error.message}</p>}
      </form>
      <aside className="panel methodology-card"><p className="page-eyebrow">Engine boundary</p><h2>One source of truth</h2><p>Analyze → Backtesting reads the stored output produced here. Both routes share the same backend service and result contract.</p><dl><div><dt>Strategy</dt><dd>Buy and hold</dd></div><div><dt>Pricing</dt><dd>Historical series</dd></div><div><dt>Output</dt><dd>Return, CAGR, volatility, drawdown, Sharpe</dd></div></dl></aside>
    </div>

    {(isLoading || isError || result) && <section className="mt-5">
      {isLoading && <div className="panel flex items-center text-gold-300"><Loader2 className="mr-2 animate-spin" /> Loading result…</div>}
      {isError && <p className="error-banner">Error loading result: {error?.message}</p>}
      {result && <><div className="panel-header mt-8"><div><h2 className="panel-title">Backtest result</h2><p className="panel-subtitle">Completed {new Date(result.completedAt).toLocaleString()}</p></div><span className="freshness-badge">{result.status}</span></div><div className="metric-grid"><Metric label="Total invested" value={result.summary.totalInvested.toLocaleString()} /><Metric label="Final value" value={result.summary.finalValue.toLocaleString()} /><Metric label="Absolute return" value={result.summary.absoluteReturn.toLocaleString()} tone={result.summary.absoluteReturn >= 0 ? 'up' : 'down'} /><Metric label="Return" value={`${result.summary.returnPercentage.toFixed(2)}%`} tone={result.summary.returnPercentage >= 0 ? 'up' : 'down'} /><Metric label="CAGR" value={percent(result.summary.cagr)} /><Metric label="Volatility" value={percent(result.summary.volatility)} /><Metric label="Max drawdown" value={percent(result.summary.maxDrawdown)} /><Metric label="Sharpe ratio" value={result.summary.sharpeRatio?.toFixed(3) ?? '—'} /></div></>}
    </section>}
  </main>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) { return <article className="metric-card"><p className="metric-label">{label}</p><p className={`metric-value${tone ? ` movement-${tone}` : ''}`}>{value}</p></article>; }
function percent(value: number | null) { return value == null ? '—' : `${value.toFixed(2)}%`; }
