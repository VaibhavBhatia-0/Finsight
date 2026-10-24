import { useMemo, useState, type FormEvent } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3, Copy, Loader2, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ApiId, PortfolioValuation, ScenarioAssetInput } from '../../api/contracts';
import { chartChrome, glowLine, useChartFit, useChartPalette } from '../../components/chartTheme';
import StockSearchInput from '../../components/StockSearchInput';
import { usePortfolios } from '../../hooks/usePortfolios';
import { useRunScenario, useSaveScenario, type ScenarioRequest, type ScenarioResult } from '../../hooks/useScenario';
import LabResultView from './LabResultView';

/** One line of an allocation: a holding carried over from a saved portfolio (stockId) or a stock picked by search (symbol). */
interface AllocationRow { key: number; symbol: string; stockId?: ApiId; label: string; weight: number }
type Source = 'portfolio' | 'custom';

const MAX_ASSETS = 20;
let lastKey = 0;
function newKey() { lastKey += 1; return lastKey; }
const blankRow = (): AllocationRow => ({ key: newKey(), symbol: '', label: '', weight: 50 });

/** Holdings weighted by current market value, rescaled to 100% so idle cash does not count as an asset. */
function rowsFromPortfolio(portfolio: PortfolioValuation): AllocationRow[] {
  const holdings = portfolio.holdings.filter(holding => holding.marketValue > 0);
  const total = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  return holdings.map(holding => ({
    key: newKey(), symbol: holding.symbol, stockId: holding.stockId, label: holding.companyName,
    weight: Math.round((holding.marketValue / total) * 10_000) / 100,
  }));
}

function totalWeight(rows: AllocationRow[]) { return rows.reduce((sum, row) => sum + (Number.isFinite(row.weight) ? row.weight : 0), 0); }

function allocationProblem(rows: AllocationRow[]): string | null {
  if (rows.length < 2) return 'A portfolio scenario needs at least two assets. Use Single investment for one stock.';
  if (rows.some(row => !row.symbol && !row.stockId)) return 'Pick every asset from the search suggestions.';
  const ids = rows.map(row => String(row.stockId ?? row.symbol.toUpperCase()));
  if (new Set(ids).size !== ids.length) return 'Each asset can appear only once.';
  if (rows.some(row => !(row.weight > 0))) return 'Every weight must be above zero.';
  if (Math.abs(totalWeight(rows) - 100) > 0.01) return `Weights add up to ${totalWeight(rows).toFixed(2)}%; they must total 100%.`;
  return null;
}

function toAssets(rows: AllocationRow[]): ScenarioAssetInput[] {
  return rows.map(row => (row.stockId ? { stockId: row.stockId, weight: row.weight / 100 } : { symbol: row.symbol, weight: row.weight / 100 }));
}

/** Rescales weights proportionally so they total exactly 100%. */
function normalized(rows: AllocationRow[]): AllocationRow[] {
  const total = totalWeight(rows);
  if (!(total > 0)) return rows;
  const scaled = rows.map(row => ({ ...row, weight: Math.round((row.weight / total) * 10_000) / 100 }));
  const drift = Math.round((100 - totalWeight(scaled)) * 100) / 100;
  if (scaled.length) scaled[0] = { ...scaled[0], weight: Math.round((scaled[0].weight + drift) * 100) / 100 };
  return scaled;
}

export default function PortfolioScenarioPage() {
  const portfolios = usePortfolios();
  const [source, setSource] = useState<Source>('portfolio');
  const [portfolioId, setPortfolioId] = useState('');
  const [primary, setPrimary] = useState<AllocationRow[]>([blankRow(), blankRow()]);
  const [alternative, setAlternative] = useState<AllocationRow[] | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState('100000');
  const [currency, setCurrency] = useState('INR');
  const [taxJurisdiction, setTaxJurisdiction] = useState<'' | 'IN' | 'US'>('');
  const [formError, setFormError] = useState<string | null>(null);
  const runPrimary = useRunScenario();
  const runAlternative = useRunScenario();
  const saveScenario = useSaveScenario();
  const [lastRequest, setLastRequest] = useState<ScenarioRequest | null>(null);

  const saved = portfolios.data ?? [];
  const chosen = saved.find(item => String(item.portfolio.id) === portfolioId);
  const primaryName = source === 'portfolio' && chosen ? chosen.portfolio.name : 'Custom mix';

  function choosePortfolio(id: string) {
    setPortfolioId(id);
    const portfolio = saved.find(item => String(item.portfolio.id) === id);
    setPrimary(portfolio ? rowsFromPortfolio(portfolio) : []);
    if (portfolio) setCurrency(portfolio.portfolio.baseCurrency === 'USD' ? 'USD' : 'INR');
    setAlternative(null);
    setFormError(null);
  }

  function switchSource(next: Source) {
    setSource(next);
    setFormError(null);
    setAlternative(null);
    if (next === 'custom') setPrimary([blankRow(), blankRow()]);
    else if (chosen) setPrimary(rowsFromPortfolio(chosen));
    else setPrimary([]);
  }

  function resetAll() {
    setPortfolioId(''); setPrimary(source === 'custom' ? [blankRow(), blankRow()] : []); setAlternative(null);
    setStartDate(''); setEndDate(''); setAmount('100000'); setFormError(null); setLastRequest(null);
    runPrimary.reset(); runAlternative.reset(); saveScenario.reset();
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (source === 'portfolio' && !chosen) { setFormError('Choose one of your portfolios, or switch to Custom mix.'); return; }
    const primaryProblem = allocationProblem(primary);
    const alternativeProblem = alternative ? allocationProblem(alternative) : null;
    if (primaryProblem || alternativeProblem) { setFormError(primaryProblem ?? `Comparison mix: ${alternativeProblem}`); return; }
    if (!startDate || !endDate || startDate >= endDate) { setFormError('Choose a start date before the end date.'); return; }
    const initialAmount = Number(amount);
    if (!(initialAmount > 0)) { setFormError('Enter an investment amount above zero.'); return; }
    const base = { scenarioType: 'PORTFOLIO_SCENARIO' as const, initialAmount, startDate, endDate, baseCurrency: currency, taxJurisdiction: taxJurisdiction || undefined };
    const request: ScenarioRequest = { ...base, assets: toAssets(primary) };
    runAlternative.reset();
    saveScenario.reset();
    const runs: Array<Promise<unknown>> = [runPrimary.mutateAsync(request)];
    if (alternative) runs.push(runAlternative.mutateAsync({ ...base, assets: toAssets(alternative) }));
    await Promise.allSettled(runs);
    setLastRequest(request);
  };

  const pending = runPrimary.isPending || runAlternative.isPending;
  const primarySide = useMemo(() => (runPrimary.data ? { name: primaryName, result: runPrimary.data } : null), [primaryName, runPrimary.data]);
  const alternativeSide = useMemo(() => (runAlternative.data ? { name: 'Comparison mix', result: runAlternative.data } : null), [runAlternative.data]);

  return <main className="scenario-page">
    <header className="page-heading"><div><p className="page-eyebrow">FinSight Lab · Scenario engine</p><h1>Portfolio scenario</h1><p className="page-subtitle">Replay one of your portfolios, or any weighted mix, through history, and compare it with an alternative allocation.</p></div></header>
    <form onSubmit={submit} className="panel scenario-form space-y-4" noValidate>
      <div className="panel-header"><div><h2 className="panel-title">Allocation and assumptions</h2><p className="panel-subtitle">Weights must form one complete portfolio</p></div><span className="freshness-badge">Provider history</span></div>

      <div className="pill-group scenario-source" role="tablist" aria-label="Start from">
        <button type="button" role="tab" aria-selected={source === 'portfolio'} className={`pill${source === 'portfolio' ? ' active' : ''}`} onClick={() => switchSource('portfolio')}>My portfolio</button>
        <button type="button" role="tab" aria-selected={source === 'custom'} className={`pill${source === 'custom' ? ' active' : ''}`} onClick={() => switchSource('custom')}>Custom mix</button>
      </div>

      {source === 'portfolio' && <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="scenario-portfolio">Portfolio</label>
        <select id="scenario-portfolio" value={portfolioId} onChange={event => choosePortfolio(event.target.value)} className="w-full px-3 py-2" disabled={portfolios.isPending}>
          <option value="">{portfolios.isPending ? 'Loading your portfolios…' : 'Select a portfolio'}</option>
          {saved.map(item => <option key={item.portfolio.id} value={item.portfolio.id}>{item.portfolio.name} · {item.portfolio.baseCurrency} · {item.holdings.length} holding{item.holdings.length === 1 ? '' : 's'}</option>)}
        </select>
        {portfolios.isError && <p className="error-banner text-sm" role="alert">Sign in to use your saved portfolios, or switch to Custom mix.</p>}
        {!portfolios.isPending && !portfolios.isError && !saved.length && <p className="panel-subtitle">You have no saved portfolios yet. <Link to="/portfolios" className="text-accent-300">Create one</Link> or switch to Custom mix.</p>}
        {chosen && <p className="panel-subtitle">Weights start from each holding&apos;s current market value (cash excluded). Adjust them to test a different mix.</p>}
      </div>}

      {(source === 'custom' || chosen) && <AllocationEditor title={primaryName} rows={primary} onChange={setPrimary} searchable={source === 'custom'} />}

      {(source === 'custom' || chosen) && (alternative
        ? <AllocationEditor title="Comparison mix" rows={alternative} onChange={setAlternative} searchable onRemove={() => { setAlternative(null); runAlternative.reset(); }} />
        : <button type="button" className="btn-secondary inline-flex items-center gap-2 px-4 py-2" onClick={() => setAlternative(primary.map(row => ({ ...row, key: newKey() })))}><Copy size={15} /> Compare with another mix</button>)}

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">Start date<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="block text-sm font-medium">End date<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2" /></label>
      </div>
      <label className="block text-sm font-medium">Investment amount<input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2" /></label>
      <label className="block text-sm font-medium">Base currency<select value={currency} onChange={event => setCurrency(event.target.value)} className="mt-1 w-full rounded border px-3 py-2"><option>INR</option><option>USD</option></select></label>
      <label className="block text-sm font-medium">Tax residency for educational estimate<select value={taxJurisdiction} onChange={event => setTaxJurisdiction(event.target.value as '' | 'IN' | 'US')} className="mt-1 w-full rounded border px-3 py-2"><option value="">No tax estimate</option><option value="IN">India</option><option value="US">United States</option></select></label>
      {formError && <p className="error-banner text-sm" role="alert">{formError}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2 disabled:opacity-50">{pending ? <span className="flex items-center"><Loader2 className="mr-2 animate-spin" size={16} />Running…</span> : alternative ? 'Run and compare' : 'Run portfolio scenario'}</button>
        <button type="button" onClick={resetAll} className="btn-secondary px-4 py-2">Reset</button>
        {chosen && <Link to={`/lab/backtest?portfolio=${chosen.portfolio.id}`} className="btn-secondary inline-flex items-center gap-2 px-4 py-2"><BarChart3 size={15} /> Stored backtest of this portfolio</Link>}
      </div>
    </form>

    {alternative && runPrimary.data && (runAlternative.data || runAlternative.isError) && <ScenarioComparison
      left={primarySide!}
      right={alternativeSide}
      error={runAlternative.error?.message}
      currency={currency}
    />}

    <LabResultView result={runPrimary.data ?? null} isError={runPrimary.isError} error={runPrimary.error ?? undefined} />
    {lastRequest && runPrimary.data && <div className="mt-3"><button type="button" disabled={saveScenario.isPending || saveScenario.isSuccess} onClick={() => saveScenario.mutate({ ...lastRequest, name: `${primaryName} scenario` })} className="btn-secondary px-4 py-2 disabled:opacity-50">{saveScenario.isSuccess ? 'Scenario saved' : saveScenario.isPending ? 'Saving…' : 'Save scenario'}</button>{saveScenario.error && <p className="mt-2 text-red-600" role="alert">{saveScenario.error.message}</p>}</div>}
  </main>;
}

function AllocationEditor({ title, rows, onChange, searchable, onRemove }: { title: string; rows: AllocationRow[]; onChange: (rows: AllocationRow[]) => void; searchable: boolean; onRemove?: () => void }) {
  const total = totalWeight(rows);
  const update = (key: number, patch: Partial<AllocationRow>) => onChange(rows.map(row => (row.key === key ? { ...row, ...patch } : row)));
  return <div className="allocation-editor" role="group" aria-label={title}>
    <div className="allocation-editor-head">
      <span>{title}</span>
      <span className={Math.abs(total - 100) > 0.01 ? 'movement-down' : 'movement-up'}>{total.toFixed(2)}%</span>
    </div>
    {rows.map(row => <div key={row.key} className="allocation-row">
      {searchable && !row.stockId
        ? <StockSearchInput label="Asset" value={row.symbol} onChange={symbol => update(row.key, { symbol })} onSelect={security => update(row.key, { label: security?.name ?? '' })} />
        : <div className="allocation-fixed"><strong>{row.symbol}</strong><small>{row.label}</small></div>}
      <label className="allocation-weight">Weight %<input type="number" min="0.01" max="100" step="0.01" value={Number.isFinite(row.weight) ? row.weight : ''} onChange={event => update(row.key, { weight: event.target.valueAsNumber })} /></label>
      <button type="button" className="round-button allocation-remove" aria-label={`Remove ${row.symbol || 'asset'}`} disabled={rows.length <= 2} onClick={() => onChange(rows.filter(item => item.key !== row.key))}><Trash2 size={15} /></button>
    </div>)}
    <div className="allocation-actions">
      <button type="button" className="btn-secondary inline-flex items-center gap-2 px-3 py-2" disabled={rows.length >= MAX_ASSETS} onClick={() => onChange([...rows, { ...blankRow(), weight: 0 }])}><Plus size={15} /> Add asset</button>
      <button type="button" className="btn-secondary px-3 py-2" disabled={!(total > 0) || Math.abs(total - 100) <= 0.01} onClick={() => onChange(normalized(rows))}>Scale to 100%</button>
      {onRemove && <button type="button" className="btn-secondary px-3 py-2" onClick={onRemove}>Remove comparison</button>}
    </div>
  </div>;
}

function ScenarioComparison({ left, right, error, currency }: { left: { name: string; result: ScenarioResult }; right: { name: string; result: ScenarioResult } | null; error?: string; currency: string }) {
  const palette = useChartPalette();
  const fit = useChartFit();
  const sides = useMemo(() => (right ? [left, right] : [left]), [left, right]);
  const option = useMemo(() => {
    const chrome = chartChrome(palette);
    const dates = [...new Set(sides.flatMap(side => side.result.performance_series?.map(point => point.date) ?? []))].sort();
    return {
      ...chrome.base, tooltip: chrome.tooltip, legend: chrome.legend, grid: { left: 56, right: 18, top: 44, bottom: 34 },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: chrome.axisLabel, axisLine: chrome.axisLine },
      yAxis: { type: 'value', scale: true, axisLabel: { ...chrome.axisLabel, formatter: (value: number) => new Intl.NumberFormat('en', { notation: 'compact' }).format(value) }, splitLine: chrome.splitLine },
      series: sides.map((side, index) => {
        const values = new Map(side.result.performance_series?.map(point => [point.date, point.value]) ?? []);
        const color = palette.series[index];
        return { name: side.name, type: 'line', showSymbol: false, smooth: .3, connectNulls: true, data: dates.map(date => values.get(date) ?? null), itemStyle: { color }, lineStyle: glowLine(color) };
      }),
    };
  }, [palette, sides]);
  const metrics: Array<[string, (result: ScenarioResult) => unknown, 'money' | 'percent' | 'decimal' | 'drawdown']> = [
    ['Final value', result => result.financials?.net_value, 'money'],
    ['Net return', result => result.financials?.net_return_percentage, 'percent'],
    ['CAGR', result => result.risk_metrics?.cagr, 'percent'],
    ['XIRR', result => result.risk_metrics?.xirr, 'percent'],
    ['Volatility', result => result.risk_metrics?.volatility, 'percent'],
    ['Sharpe ratio', result => result.risk_metrics?.sharpe_ratio, 'decimal'],
    ['Max drawdown', result => result.risk_metrics?.max_drawdown, 'drawdown'],
  ];
  const format = (value: unknown, kind: (typeof metrics)[number][2]) => {
    const number = Number(value);
    if (value == null || !Number.isFinite(number)) return 'N/A';
    if (kind === 'money') return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(number);
    if (kind === 'percent') return `${number.toFixed(2)}%`;
    if (kind === 'drawdown') return `-${Math.abs(number).toFixed(2)}%`;
    return number.toFixed(2);
  };
  return <section className="panel mt-8">
    <div className="panel-header"><div><h2 className="panel-title">Side-by-side comparison</h2><p className="panel-subtitle">Same dates, amount, and currency for both allocations</p></div></div>
    {error && <p className="error-banner text-sm" role="alert">The comparison mix could not be run: {error}</p>}
    <div role="img" aria-label={`Portfolio value of ${sides.map(side => side.name).join(' and ')}`}><ReactECharts option={option} notMerge lazyUpdate style={{ height: fit.height(320) }} /></div>
    <div className="overflow-x-auto"><table className="scenario-compare-table"><thead><tr><th className="text-left">Metric</th>{sides.map(side => <th key={side.name} className="text-right">{side.name}</th>)}</tr></thead>
      <tbody>{metrics.map(([label, read, kind]) => <tr key={label}><td>{label}</td>{sides.map(side => <td key={side.name} className="text-right font-mono">{format(read(side.result), kind)}</td>)}</tr>)}</tbody></table></div>
  </section>;
}
