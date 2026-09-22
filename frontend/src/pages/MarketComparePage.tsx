import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, Plus, Scale, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SecuritySearchItem } from '../api/contracts';
import StockSearchInput from '../components/StockSearchInput';
import { useMarketComparison } from '../hooks/useMarketIntelligence';

const colors = ['#d4aa58', '#6fa58e', '#b98568', '#a9a39a', '#d0c19f'];

export default function MarketComparePage() {
  const [rows, setRows] = useState<Array<{ text: string; security: SecuritySearchItem | null }>>([{ text: '', security: null }, { text: '', security: null }]);
  const compare = useMarketComparison();
  const selected = rows.flatMap(row => row.security ? [row.security] : []);
  const option = useMemo(() => {
    const dates = [...new Set(compare.data?.securities.flatMap(row => row.normalizedSeries.map(point => point.date)) ?? [])].sort();
    return {
      animationDuration: 350, tooltip: { trigger: 'axis' }, legend: { top: 0, textStyle: { color: '#99958e' } }, grid: { left: 50, right: 22, top: 48, bottom: 38 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#8d8981', hideOverlap: true }, axisLine: { lineStyle: { color: '#3c3934' } } },
      yAxis: { type: 'value', name: 'Rebased to 100', scale: true, axisLabel: { color: '#8d8981' }, nameTextStyle: { color: '#8d8981' }, splitLine: { lineStyle: { color: 'rgba(140,136,129,.12)' } } },
      series: compare.data?.securities.map((row, index) => { const values = new Map(row.normalizedSeries.map(point => [point.date, point.value])); return { name: row.security.providerSymbol, type: 'line', showSymbol: false, connectNulls: false, data: dates.map(date => values.get(date) ?? null), lineStyle: { width: 2, color: colors[index] } }; }) ?? [],
    };
  }, [compare.data]);

  function update(index: number, value: Partial<(typeof rows)[number]>) { setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...value } : row)); }
  function remove(index: number) { setRows(current => current.filter((_, rowIndex) => rowIndex !== index)); }

  return <main>
    <Link to="/markets" className="mb-5 inline-flex items-center gap-2 text-sm text-gold-300"><ArrowLeft size={15} /> Markets</Link>
    <header className="page-heading"><div><p className="page-eyebrow">Market intelligence</p><h1>Compare securities</h1><p className="page-subtitle">Factual price, valuation, performance, risk, and technical comparison. Missing provider observations remain unavailable.</p></div><Scale className="text-gold-400" /></header>
    <section className="panel mb-5"><div className="grid gap-3 md:grid-cols-2">{rows.map((row, index) => <div key={index} className="flex items-end gap-2"><div className="min-w-0 flex-1"><StockSearchInput label={`Security ${index + 1}`} value={row.text} onChange={text => update(index, { text })} onSelect={security => update(index, { security })} /></div>{rows.length > 2 && <button type="button" className="icon-action mb-1" aria-label={`Remove security ${index + 1}`} onClick={() => remove(index)}><Trash2 size={16} /></button>}</div>)}</div><div className="mt-4 flex flex-wrap gap-2">{rows.length < 5 && <button type="button" className="btn-secondary inline-flex items-center gap-2 px-4 py-2" onClick={() => setRows(current => [...current, { text: '', security: null }])}><Plus size={15} /> Add security</button>}<button type="button" className="btn-primary px-4 py-2" disabled={selected.length < 2 || compare.isPending || new Set(selected.map(item => String(item.id))).size !== selected.length} onClick={() => compare.mutate(selected.map(item => item.id))}>{compare.isPending ? 'Comparing…' : 'Compare selected securities'}</button></div>{compare.error && <p className="error-banner mt-3">{compare.error.message}</p>}</section>
    {compare.data && <div className="content-stack"><section className="panel"><div className="panel-header"><div><h2 className="panel-title">Normalized one-year performance</h2><p className="panel-subtitle">Common provider observation dates, rebased to 100</p></div></div><div role="img" aria-label="Normalized performance comparison"><ReactECharts option={option} notMerge lazyUpdate style={{ height: 380 }} /></div><p className="methodology-copy">{compare.data.methodology}</p></section><section className="panel overflow-x-auto"><table><thead><tr><th>Security</th><th>Market</th><th className="text-right">Price</th><th className="text-right">1D</th><th className="text-right">1M</th><th className="text-right">YTD</th><th className="text-right">1Y</th><th className="text-right">5Y</th><th className="text-right">Volatility</th><th className="text-right">Drawdown</th><th className="text-right">P/E</th><th className="text-right">EPS</th><th className="text-right">Yield</th><th className="text-right">RSI</th></tr></thead><tbody>{compare.data.securities.map(row => <tr key={row.security.id}><td><Link to={`/markets/${encodeURIComponent(row.security.providerSymbol ?? row.security.symbol)}`}><strong>{row.security.providerSymbol}</strong><small className="block text-gray-500">{row.security.name}</small></Link></td><td>{row.security.exchange} · {row.security.country}</td><td className="text-right font-mono">{row.quote ? money(row.quote.price, row.quote.currency) : 'N/A'}</td><Cell value={row.performance['1D']} suffix="%" /><Cell value={row.performance['1M']} suffix="%" /><Cell value={row.performance.YTD} suffix="%" /><Cell value={row.performance['1Y']} suffix="%" /><Cell value={row.performance['5Y']} suffix="%" /><Cell value={row.risk.volatility} suffix="%" /><Cell value={row.risk.maxDrawdown} suffix="%" /><Cell value={row.fundamentals.peRatio} /><Cell value={row.fundamentals.eps} /><Cell value={row.fundamentals.dividendYield} suffix="%" /><Cell value={row.technicals?.rsi14} /></tr>)}</tbody></table></section></div>}
  </main>;
}

function Cell({ value, suffix = '' }: { value: number | null | undefined; suffix?: string }) { return <td className="text-right font-mono">{value == null ? 'N/A' : `${value.toFixed(2)}${suffix}`}</td>; }
function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
