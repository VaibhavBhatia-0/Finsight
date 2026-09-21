import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Info, Save } from 'lucide-react';
import type { PortfolioBenchmark, PortfolioIntelligence } from '../api/contracts';
import { useUpdatePortfolio } from '../hooks/usePortfolios';

export default function PortfolioIntelligencePanel({ data, benchmarks }: { data: PortfolioIntelligence; benchmarks: PortfolioBenchmark[] }) {
  const update = useUpdatePortfolio(data.portfolio.id);
  const [benchmarkId, setBenchmarkId] = useState(data.portfolio.benchmarkId == null ? '' : String(data.portfolio.benchmarkId));
  const [targets, setTargets] = useState<Record<string, number>>(data.portfolio.allocationTargets || {});
  const currency = data.portfolio.baseCurrency;
  const performanceOption = useMemo(() => ({
    animationDuration: 350,
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#a8a29e' } },
    grid: { left: 50, right: 22, top: 44, bottom: 36 },
    xAxis: { type: 'category', data: data.performance?.series.map(row => row.date) ?? [], axisLabel: { color: '#8c8881', hideOverlap: true }, axisLine: { lineStyle: { color: '#3b3935' } } },
    yAxis: { type: 'value', name: 'Rebased to 100', nameTextStyle: { color: '#8c8881' }, axisLabel: { color: '#8c8881' }, splitLine: { lineStyle: { color: 'rgba(140,136,129,.14)' } } },
    series: [
      { name: data.portfolio.name, type: 'line', showSymbol: false, smooth: false, data: data.performance?.series.map(row => row.portfolioNormalized) ?? [], lineStyle: { width: 2, color: '#d6b978' }, areaStyle: { color: 'rgba(214,185,120,.08)' } },
      ...(data.performance?.benchmark ? [{ name: data.performance.benchmark.name, type: 'line', showSymbol: false, smooth: false, data: data.performance.series.map(row => row.benchmarkNormalized), lineStyle: { width: 1.5, color: '#8b9a83', type: 'dashed' } }] : []),
    ],
  }), [data]);
  const allocationOption = useMemo(() => {
    const rows = data.allocation.holdings.filter(row => row.value > 0);
    return {
      animationDuration: 300,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: { color: '#a8a29e' } },
      grid: { left: 88, right: 28, top: 40, bottom: 24 },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: '#8c8881' }, splitLine: { lineStyle: { color: 'rgba(140,136,129,.14)' } } },
      yAxis: { type: 'category', data: rows.map(row => row.symbol), axisLabel: { color: '#d6d3cd' }, axisLine: { show: false } },
      series: [
        { name: 'Current', type: 'bar', data: rows.map(row => row.percentage), itemStyle: { color: '#d6b978', borderRadius: [0, 3, 3, 0] }, barMaxWidth: 12 },
        { name: 'Target', type: 'bar', data: rows.map(row => row.targetPercentage), itemStyle: { color: '#6f746b', borderRadius: [0, 3, 3, 0] }, barMaxWidth: 8 },
      ],
    };
  }, [data]);

  if (!data.performance) return <section className="panel"><div className="empty-state"><p>{data.reason || 'Add dated portfolio transactions to calculate intelligence.'}</p></div></section>;
  const performance = data.performance;
  return <div className="content-stack">
    <section className="panel">
      <div className="panel-header"><div><p className="page-eyebrow">Benchmarking</p><h2 className="panel-title">Performance relative to a benchmark</h2><p className="panel-subtitle">Cash-flow-neutral history, normalized to 100 in {currency}</p></div><label className="text-sm">Benchmark<select value={benchmarkId} onChange={event => setBenchmarkId(event.target.value)} className="ml-2 px-3 py-2"><option value="">None</option>{benchmarks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" disabled={update.isPending} onClick={() => update.mutate({ benchmarkId: benchmarkId ? Number(benchmarkId) : null })} className="btn-secondary ml-2 inline-flex items-center gap-2 px-3 py-2"><Save size={14} /> Apply</button></label></div>
      <dl className="intelligence-summary">
        <Stat label="Portfolio return" value={percent(performance.portfolioReturn)} />
        <Stat label="Benchmark return" value={percent(performance.benchmarkReturn)} />
        <Stat label="Difference" value={points(performance.absoluteDifference)} />
        <Stat label="Portfolio CAGR" value={percent(performance.portfolioCagr)} />
        <Stat label="Benchmark CAGR" value={percent(performance.benchmarkCagr)} />
        <Stat label="XIRR" value={percent(performance.xirr)} />
      </dl>
      <div role="img" aria-label={`Normalized performance chart for ${data.portfolio.name}${performance.benchmark ? ` and ${performance.benchmark.name}` : ''}`}><ReactECharts option={performanceOption} notMerge lazyUpdate style={{ height: 340 }} /></div>
      <p className="methodology-copy"><Info size={14} aria-hidden /> {performance.methodology}</p>
    </section>

    <div className="intelligence-split">
      <section className="panel"><div className="panel-header"><div><p className="page-eyebrow">Allocation</p><h2 className="panel-title">Holdings and targets</h2></div></div><div role="img" aria-label="Current and target portfolio allocation"><ReactECharts option={allocationOption} notMerge lazyUpdate style={{ height: Math.max(260, data.allocation.holdings.length * 42) }} /></div><div className="overflow-x-auto"><table><thead><tr><th>Holding</th><th className="text-right">Current</th><th className="text-right">Value</th><th className="text-right">Target</th><th className="text-right">Difference</th></tr></thead><tbody>{data.allocation.holdings.map(row => <tr key={row.symbol}><td>{row.symbol}</td><td className="text-right font-mono">{row.percentage.toFixed(2)}%</td><td className="text-right font-mono">{money(row.value, currency)}</td><td className="text-right"><input aria-label={`${row.symbol} target percentage`} type="number" min="0" max="100" step="0.1" value={targets[row.symbol] ?? ''} onChange={event => setTargets(current => ({ ...current, [row.symbol]: Number(event.target.value) }))} className="target-input" /></td><td className="text-right font-mono">{row.targetDifference == null ? '—' : `${signed(row.targetDifference)} pp`}</td></tr>)}</tbody></table></div><button type="button" disabled={update.isPending} onClick={() => update.mutate({ allocationTargets: targets })} className="btn-secondary mt-4 inline-flex items-center gap-2 px-3 py-2"><Save size={14} /> Save targets</button>{update.error && <p className="error-banner mt-3" role="alert">{update.error.message}</p>}</section>
      <section className="panel"><div className="panel-header"><div><p className="page-eyebrow">Exposure</p><h2 className="panel-title">Portfolio composition</h2></div></div><Exposure title="Sector" rows={data.allocation.sectors} /><Exposure title="Geography" rows={data.allocation.geographies} /><Exposure title="Currency" rows={data.allocation.currencies} />{data.dataQuality?.missingSectorCount ? <p className="notice mt-4 p-3 text-sm">Sector data is unavailable for {data.dataQuality.missingSectorCount} holding(s).</p> : null}</section>
    </div>

    <section className="panel"><div className="panel-header"><div><p className="page-eyebrow">Risk</p><h2 className="panel-title">Risk dashboard</h2><p className="panel-subtitle">Calculated only when sufficient dated observations exist</p></div><span className="freshness-badge">{data.risk.observations ?? 0} observations</span></div>{data.risk.status !== 'AVAILABLE' ? <div className="empty-state"><p>Insufficient historical data for volatility, Sharpe, beta, and correlation.</p></div> : <><dl className="intelligence-summary"><Stat label="Annualized volatility" value={percent(data.risk.volatility)} /><Stat label="Sharpe ratio" value={number(data.risk.sharpeRatio)} /><Stat label="Maximum drawdown" value={percent(data.risk.maxDrawdown)} /><Stat label="Beta" value={number(data.risk.beta)} /><Stat label="Benchmark correlation" value={number(data.risk.correlation)} /><Stat label="Downside observations" value={data.risk.downsideObservations == null ? 'N/A' : `${data.risk.downsideObservations} · ${percent(data.risk.downsidePercentage)}`} /></dl><div className="risk-detail-grid"><div><h3>Concentration</h3><p>Largest position <strong>{percent(data.risk.concentration?.largestHoldingPercentage)}</strong></p><p>HHI <strong>{number(data.risk.concentration?.herfindahlIndex)}</strong></p></div><div><h3>Risk contribution</h3>{data.risk.riskContribution?.length ? data.risk.riskContribution.map(row => <p key={row.symbol} className="flex justify-between"><span>{row.symbol}</span><strong>{percent(row.percentage)}</strong></p>) : <p>N/A</p>}</div></div></>}<details className="methodology-details"><summary>Metric definitions</summary><p>Volatility annualizes observed daily return dispersion. Sharpe compares return with the configured risk-free assumption. Maximum drawdown is the largest peak-to-trough decline. Beta and correlation use date-aligned benchmark returns. HHI measures position concentration.</p></details></section>

    <section className="panel"><div className="panel-header"><div><p className="page-eyebrow">Attribution</p><h2 className="panel-title">Where net P&amp;L came from</h2><p className="panel-subtitle">FIFO lot attribution in {currency}</p></div><span className={`freshness-badge ${Math.abs(data.attribution.totals.reconciliationDifference) > .01 ? 'is-stale' : ''}`}>Reconciliation {money(data.attribution.totals.reconciliationDifference, currency)}</span></div><div className="overflow-x-auto"><table><thead><tr><th>Holding</th><th className="text-right">Price return</th><th className="text-right">Dividends</th><th className="text-right">FX impact</th><th className="text-right">Fees</th><th className="text-right">Taxes</th><th className="text-right">Net contribution</th></tr></thead><tbody>{data.attribution.holdings.map(row => <tr key={`${row.stockId ?? 'cash'}-${row.symbol}`}><td>{row.symbol}</td><Amount value={row.priceReturn} currency={currency} /><Amount value={row.dividends} currency={currency} /><Amount value={row.fxImpact} currency={currency} /><Amount value={-row.fees} currency={currency} /><Amount value={-row.taxes} currency={currency} /><Amount value={row.netContribution} currency={currency} /></tr>)}</tbody><tfoot><tr><th>Total</th><Amount value={data.attribution.totals.priceReturn} currency={currency} /><Amount value={data.attribution.totals.dividends} currency={currency} /><Amount value={data.attribution.totals.fxImpact} currency={currency} /><Amount value={-data.attribution.totals.fees} currency={currency} /><Amount value={-data.attribution.totals.taxes} currency={currency} /><Amount value={data.attribution.totals.netPnl} currency={currency} /></tr></tfoot></table></div><p className="methodology-copy"><Info size={14} aria-hidden /> {data.attribution.invariant}</p></section>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function Exposure({ title, rows }: { title: string; rows: Array<{ label: string; percentage: number }> }) { return <div className="exposure-block"><h3>{title}</h3>{rows.length ? rows.map(row => <div className="exposure-row" key={row.label}><span>{row.label}</span><span className="exposure-track"><i style={{ width: `${Math.min(100, row.percentage)}%` }} /></span><strong>{row.percentage.toFixed(1)}%</strong></div>) : <p className="text-sm text-gray-500">N/A</p>}</div>; }
function Amount({ value, currency }: { value: number; currency: string }) { return <td className={`text-right font-mono ${value > 0 ? 'movement-up' : value < 0 ? 'movement-down' : ''}`}>{money(value, currency)}</td>; }
function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
function percent(value?: number | null) { return value == null ? 'N/A' : `${value.toFixed(2)}%`; }
function points(value?: number | null) { return value == null ? 'N/A' : `${signed(value)} pp`; }
function signed(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`; }
function number(value?: number | null) { return value == null ? 'N/A' : value.toFixed(3); }
