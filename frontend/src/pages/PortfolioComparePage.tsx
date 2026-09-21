import { type FormEvent, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { useComparePortfolios, usePortfolios } from '../hooks/usePortfolios';

const colors = ['#d6b978', '#8b9a83', '#a58b78', '#c9c5bd'];

export default function PortfolioComparePage() {
  const portfolios = usePortfolios();
  const compare = useComparePortfolios();
  const option = useMemo(() => {
    const dates = [...new Set(compare.data?.comparisonSeries.flatMap(item => item.values.map(row => row.date)) ?? [])].sort();
    return {
      animationDuration: 350,
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: '#a8a29e' } },
      grid: { left: 48, right: 22, top: 48, bottom: 34 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#8c8881', hideOverlap: true }, axisLine: { lineStyle: { color: '#3b3935' } } },
      yAxis: { type: 'value', name: 'Rebased to 100', nameTextStyle: { color: '#8c8881' }, axisLabel: { color: '#8c8881' }, splitLine: { lineStyle: { color: 'rgba(140,136,129,.14)' } } },
      series: compare.data?.comparisonSeries.map((item, index) => {
        const values = new Map(item.values.map(row => [row.date, row.value]));
        return { name: item.name, type: 'line', showSymbol: false, data: dates.map(date => values.get(date) ?? null), connectNulls: false, lineStyle: { width: 2, color: colors[index] } };
      }) ?? [],
    };
  }, [compare.data]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ids = new FormData(event.currentTarget).getAll('portfolioIds') as string[];
    compare.mutate(ids);
  };
  return <main>
    <Link to="/portfolios" className="mb-5 inline-flex items-center gap-2 text-sm text-gold-300"><ArrowLeft size={15} /> Portfolios</Link>
    <header className="page-heading"><div><p className="page-eyebrow">Portfolio intelligence</p><h1>Compare portfolios</h1><p className="page-subtitle">Factual comparison over the common available period. Differences in currency, benchmark, and history remain explicit.</p></div><Scale size={30} className="text-gold-400" /></header>
    <form onSubmit={submit} className="panel mb-5"><fieldset><legend className="panel-title mb-3">Select two to four portfolios</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{portfolios.data?.map(item => <label key={item.portfolio.id} className="selection-row"><input name="portfolioIds" type="checkbox" value={item.portfolio.id} /><span><strong>{item.portfolio.name}</strong><small>{item.portfolio.baseCurrency} · {item.portfolio.benchmarkName ?? 'No benchmark'}</small></span></label>)}</div></fieldset><button disabled={compare.isPending || portfolios.isPending} className="btn-primary mt-4 px-4 py-2">{compare.isPending ? 'Calculating…' : 'Compare selected portfolios'}</button>{compare.error && <p className="error-banner mt-3" role="alert">{compare.error.message}</p>}</form>
    {portfolios.isPending && <Spinner />}
    {compare.data && <div className="content-stack">
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Normalized performance</h2><p className="panel-subtitle">Common period {compare.data.synchronizedPeriod.startDate ?? 'N/A'} — {compare.data.synchronizedPeriod.endDate ?? 'N/A'}</p></div></div><div role="img" aria-label="Normalized comparison of selected portfolios"><ReactECharts option={option} notMerge lazyUpdate style={{ height: 360 }} /></div><p className="methodology-copy">{compare.data.compatibility.note}</p>{(!compare.data.compatibility.sameCurrency || !compare.data.compatibility.sameBenchmark || compare.data.compatibility.differentStartDates) && <div className="notice mt-3 p-3 text-sm">{!compare.data.compatibility.sameCurrency && <p>Base currencies differ: {compare.data.compatibility.currencies.join(', ')}.</p>}{!compare.data.compatibility.sameBenchmark && <p>Benchmarks differ: {compare.data.compatibility.benchmarks.join(', ')}.</p>}{compare.data.compatibility.differentStartDates && <p>Portfolio start dates differ; the chart uses only the overlapping period.</p>}</div>}</section>
      <section className="panel"><div className="overflow-x-auto"><table><thead><tr><th>Portfolio</th><th className="text-right">Current value</th><th className="text-right">Return</th><th className="text-right">CAGR</th><th className="text-right">Volatility</th><th className="text-right">Sharpe</th><th className="text-right">Max drawdown</th><th className="text-right">Benchmark difference</th></tr></thead><tbody>{compare.data.portfolios.map(item => <tr key={item.portfolio.id}><td><strong>{item.portfolio.name}</strong><small className="block text-gray-500">{item.portfolio.baseCurrency}</small></td><td className="text-right font-mono">{money(item.performance?.currentValue, item.portfolio.baseCurrency)}</td><Metric value={item.performance?.portfolioReturn} suffix="%" /><Metric value={item.performance?.portfolioCagr} suffix="%" /><Metric value={item.risk.volatility} suffix="%" /><Metric value={item.risk.sharpeRatio} /><Metric value={item.risk.maxDrawdown} suffix="%" /><Metric value={item.performance?.absoluteDifference} suffix=" pp" /></tr>)}</tbody></table></div></section>
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Allocation comparison</h2><p className="panel-subtitle">Current holding weights including cash</p></div></div><div className="comparison-allocation-grid">{compare.data.portfolios.map(item => <article key={item.portfolio.id}><h3>{item.portfolio.name}</h3>{item.allocation.holdings.filter(row => row.percentage > 0).map(row => <div className="exposure-row" key={row.symbol}><span>{row.symbol}</span><span className="exposure-track"><i style={{ width: `${Math.min(100, row.percentage)}%` }} /></span><strong>{row.percentage.toFixed(1)}%</strong></div>)}</article>)}</div></section>
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Contribution history</h2><p className="panel-subtitle">External deposits and withdrawals, converted using each transaction date&apos;s FX rate</p></div></div><div className="comparison-allocation-grid">{compare.data.portfolios.map(item => <article key={item.portfolio.id}><h3>{item.portfolio.name}</h3>{item.contributionHistory.length ? <div className="overflow-x-auto"><table><thead><tr><th>Date</th><th>Type</th><th className="text-right">Base amount</th></tr></thead><tbody>{item.contributionHistory.map((row, index) => <tr key={`${row.date}-${row.type}-${index}`}><td>{row.date}</td><td>{row.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}</td><td className="text-right font-mono">{money(row.baseAmount, row.baseCurrency)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Net contributions</th><th className="text-right font-mono">{money(item.contributionHistory.reduce((sum, row) => sum + row.baseAmount, 0), item.portfolio.baseCurrency)}</th></tr></tfoot></table></div> : <p className="methodology-copy">No external contributions recorded.</p>}</article>)}</div></section>
    </div>}
  </main>;
}

function Metric({ value, suffix = '' }: { value?: number | null; suffix?: string }) { return <td className="text-right font-mono">{value == null ? 'N/A' : `${value.toFixed(2)}${suffix}`}</td>; }
function money(value: number | null | undefined, currency: string) { return value == null ? 'N/A' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
