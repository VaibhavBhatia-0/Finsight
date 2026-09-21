import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, Loader2 } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import ReactECharts from 'echarts-for-react';
import { useBacktest, useRunBacktest } from '../../hooks/useBacktest';
import { usePortfolios } from '../../hooks/usePortfolios';

interface FormValues { portfolioId: string; startDate: string; endDate: string; amount: number; benchmarkSymbol: '' | '^NSEI' | '^BSESN' | '^GSPC' | '^IXIC'; feePercent: number; fixedFee: number }

export default function LabBacktestPage() {
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const queryClient = useQueryClient();
  const portfolios = usePortfolios();
  const runBacktest = useRunBacktest();
  const [backtestId, setBacktestId] = useState<string | null>(null);
  const { data: result, isLoading, isError, error } = useBacktest(backtestId ?? '', Boolean(backtestId));

  const onSubmit: SubmitHandler<FormValues> = async data => {
    const created = await runBacktest.mutateAsync({ portfolioId: Number(data.portfolioId), startDate: data.startDate, endDate: data.endDate, initialAmount: data.amount, benchmarkSymbol: data.benchmarkSymbol || undefined, feeRate: data.feePercent / 100, fixedFee: data.fixedFee });
    setBacktestId(created.id);
    await queryClient.invalidateQueries({ queryKey: ['backtests'] });
  };

  return <main>
    <header className="page-heading"><div><p className="page-eyebrow">FinSight Lab · Backtesting engine</p><h1>Backtest strategy</h1><p className="page-subtitle">Run a portfolio through the canonical historical engine. This is strategy evaluation—not scenario simulation.</p></div><BarChart3 size={30} className="text-gold-400" /></header>
    <div className="content-grid lab-config-grid">
      <form onSubmit={handleSubmit(onSubmit)} className="panel space-y-4">
        <div className="panel-header"><div><h2 className="panel-title">Configuration</h2><p className="panel-subtitle">BUY_AND_HOLD · portfolio weights at run time</p></div><span className="freshness-badge">Provider history</span></div>
        <label className="block text-sm font-medium">Portfolio<select {...register('portfolioId', { required: true })} className="mt-1 w-full px-3 py-2"><option value="">Select portfolio</option>{portfolios.data?.map(item => <option value={item.portfolio.id} key={item.portfolio.id}>{item.portfolio.name} · {item.portfolio.baseCurrency}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Start date<input type="date" {...register('startDate', { required: true })} className="mt-1 w-full px-3 py-2" /></label><label className="block text-sm font-medium">End date<input type="date" {...register('endDate', { required: true })} className="mt-1 w-full px-3 py-2" /></label></div>
        <label className="block text-sm font-medium">Initial investment<input type="number" min="0.01" step="0.01" {...register('amount', { required: true, min: 0.01, valueAsNumber: true })} className="mt-1 w-full px-3 py-2" placeholder="10000" /></label>
        <label className="block text-sm font-medium">Benchmark<select {...register('benchmarkSymbol')} defaultValue="" className="mt-1 w-full px-3 py-2"><option value="">No benchmark</option><option value="^NSEI">NIFTY 50</option><option value="^BSESN">BSE SENSEX</option><option value="^GSPC">S&amp;P 500</option><option value="^IXIC">NASDAQ Composite</option></select></label>
        <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Trading fee (%)<input type="number" min="0" max="10" step="0.001" defaultValue="0" {...register('feePercent', { min: 0, max: 10, valueAsNumber: true })} className="mt-1 w-full px-3 py-2" /></label><label className="block text-sm font-medium">Fixed fee / trade<input type="number" min="0" step="0.01" defaultValue="0" {...register('fixedFee', { min: 0, valueAsNumber: true })} className="mt-1 w-full px-3 py-2" /></label></div>
        <div className="flex gap-2"><button type="submit" disabled={runBacktest.isPending || portfolios.isPending} className="btn-primary px-4 py-2">{runBacktest.isPending ? <span className="flex items-center"><Loader2 className="mr-2 animate-spin" size={16} />Running…</span> : 'Run backtest'}</button><button type="button" onClick={() => { reset(); setBacktestId(null); runBacktest.reset(); }} className="btn-secondary px-4 py-2">Reset</button></div>
        {runBacktest.error && <p className="error-banner" role="alert">Unable to run backtest: {runBacktest.error.message}</p>}
      </form>
      <aside className="panel methodology-card"><p className="page-eyebrow">Engine boundary</p><h2>One source of truth</h2><p>Analyze → Backtesting reads the stored output produced here. Both routes share the same backend service and result contract.</p><dl><div><dt>Strategy</dt><dd>Buy and hold</dd></div><div><dt>Pricing</dt><dd>Historical series</dd></div><div><dt>Output</dt><dd>Return, CAGR, volatility, drawdown, Sharpe</dd></div></dl></aside>
    </div>

    {(isLoading || isError || result) && <section className="mt-5">
      {isLoading && <div className="panel flex items-center text-gold-300"><Loader2 className="mr-2 animate-spin" /> Loading result…</div>}
      {isError && <p className="error-banner">Error loading result: {error?.message}</p>}
      {result && <><div className="panel-header mt-8"><div><h2 className="panel-title">Backtest result</h2><p className="panel-subtitle">Completed {new Date(result.completedAt).toLocaleString()}</p></div><span className="freshness-badge">{result.status}</span></div><div className="metric-grid"><Metric label="Total invested" value={result.summary.totalInvested.toLocaleString()} /><Metric label="Final value" value={result.summary.finalValue.toLocaleString()} /><Metric label="Fees paid" value={result.summary.feesPaid.toLocaleString()} /><Metric label="Absolute return" value={result.summary.absoluteReturn.toLocaleString()} tone={result.summary.absoluteReturn >= 0 ? 'up' : 'down'} /><Metric label="Strategy return" value={`${result.summary.returnPercentage.toFixed(2)}%`} tone={result.summary.returnPercentage >= 0 ? 'up' : 'down'} /><Metric label="Strategy CAGR" value={percent(result.summary.cagr)} /><Metric label="Benchmark return" value={percent(result.summary.benchmarkReturn)} /><Metric label="Benchmark CAGR" value={percent(result.summary.benchmarkCagr)} /><Metric label="Difference" value={percent(result.summary.benchmarkDifference)} /><Metric label="Relative performance" value={percent(result.summary.relativePerformance)} /><Metric label="XIRR" value={percent(result.summary.xirr)} /><Metric label="Volatility" value={percent(result.summary.volatility)} /><Metric label="Max drawdown" value={percent(result.summary.maxDrawdown)} /><Metric label="Sharpe ratio" value={result.summary.sharpeRatio?.toFixed(3) ?? '—'} /></div><section className="panel mt-5"><div className="panel-header"><div><h2 className="panel-title">Strategy vs benchmark</h2><p className="panel-subtitle">FX-normalized growth of the same starting capital</p></div></div><ReactECharts style={{ height: 340 }} option={chartOption(result.details.timeSeries, result.details.benchmarkSymbol)} /></section><p className="panel-subtitle mt-3">{result.details.methodology}</p></>}
    </section>}
  </main>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) { return <article className="metric-card"><p className="metric-label">{label}</p><p className={`metric-value${tone ? ` movement-${tone}` : ''}`}>{value}</p></article>; }
function percent(value: number | null) { return value == null ? '—' : `${value.toFixed(2)}%`; }
function chartOption(rows: Array<{ date: string; strategy_value: number; benchmark_value: number | null }>, benchmark: string | null) { return { backgroundColor: 'transparent', tooltip: { trigger: 'axis' }, legend: { data: benchmark ? ['Strategy', 'Benchmark'] : ['Strategy'], textStyle: { color: '#9e988f' } }, grid: { left: 46, right: 20, top: 44, bottom: 34 }, xAxis: { type: 'category', data: rows.map(row => row.date), axisLabel: { color: '#817b73', hideOverlap: true }, axisLine: { lineStyle: { color: '#34312d' } } }, yAxis: { type: 'value', axisLabel: { color: '#817b73' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.06)' } } }, series: [{ name: 'Strategy', type: 'line', showSymbol: false, data: rows.map(row => row.strategy_value), lineStyle: { color: '#d0a85f', width: 2 }, areaStyle: { color: 'rgba(208,168,95,.12)' } }, ...(benchmark ? [{ name: 'Benchmark', type: 'line', showSymbol: false, data: rows.map(row => row.benchmark_value), lineStyle: { color: '#a7a29a', width: 1.5, type: 'dashed' } }] : [])] }; }
