import ReactECharts from 'echarts-for-react';
import { Loader2 } from 'lucide-react';
import type { ScenarioResult } from '../../api/contracts';

interface Props { result: ScenarioResult | null; isLoading?: boolean; isError?: boolean; error?: Error }

export const LabResultView = ({ result, isLoading, isError, error }: Props) => {
  if (isLoading) return <div className="flex items-center text-champagne-600" role="status"><Loader2 className="mr-2 animate-spin" /> Running historical scenario…</div>;
  if (isError) return <p className="text-red-600">Scenario failed: {error?.message}</p>;
  if (!result) return <div className="empty-state"><p>Configure and run a scenario to see its reconciled result.</p></div>;

  const currency = result.baseCurrency || 'INR';
  const financials = result.financials ?? {};
  const risk = result.risk_metrics ?? {};
  const attribution = result.attribution ?? {};
  const title = modeTitle(result.mode);
  const identity = result.stock?.symbol || (result.assets?.map(asset => asset.symbol).join(' · ') || 'Portfolio');
  const start = result.provenance?.dataRange.start || stringDetail(result.details, 'actual_buy_date');
  const end = result.provenance?.dataRange.end || stringDetail(result.details, 'actual_sell_date');

  return (
    <section className="lab-result-dashboard mt-8">
      <header className="lab-result-hero">
        <div><p className="page-eyebrow">Scenario result</p><h2>{title}</h2><p>{identity}{start && end ? ` · ${date(start)} → ${date(end)}` : ''}</p></div>
        <div className="lab-result-primary">
          <ResultMetric label="Invested" value={money(financials.initial_investment, currency)} />
          <ResultMetric label="Current value" value={money(financials.net_value, currency)} />
          <ResultMetric label="Net P&L" value={signedMoney(financials.net_profit, currency)} tone={tone(financials.net_profit)} />
          <ResultMetric label="Net return" value={percent(financials.net_return_percentage)} tone={tone(financials.net_return_percentage)} />
        </div>
      </header>

      <section className="panel lab-performance-panel">
        <div className="panel-header"><div><h3 className="panel-title">Performance</h3><p className="panel-subtitle">Historical base-currency valuation through the scenario period</p></div></div>
        {result.performance_series?.length ? <ReactECharts option={performanceOption(result.performance_series, currency)} notMerge lazyUpdate style={{ height: 330 }} /> : <div className="empty-state"><p>A valuation series was not returned for this scenario.</p></div>}
      </section>

      <section className="panel">
        <div className="panel-header"><div><h3 className="panel-title">Returns & risk</h3><p className="panel-subtitle">Percentage metrics are annualized only where mathematically applicable</p></div></div>
        <div className="lab-result-grid">
          <ResultMetric label="Gross return" value={percent(financials.gross_return_percentage)} tone={tone(financials.gross_return_percentage)} />
          <ResultMetric label="Net return" value={percent(financials.net_return_percentage)} tone={tone(financials.net_return_percentage)} />
          <ResultMetric label="CAGR" value={percent(risk.cagr)} tone={tone(risk.cagr)} />
          <ResultMetric label="XIRR" value={percent(risk.xirr)} tone={tone(risk.xirr)} />
          <ResultMetric label="Volatility" value={percent(risk.volatility)} />
          <ResultMetric label="Sharpe" value={decimal(risk.sharpe_ratio)} />
          <ResultMetric label="Max drawdown" value={drawdown(risk.max_drawdown)} tone="down" />
          <ResultMetric label="Beta" value={decimal(risk.beta)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><h3 className="panel-title">Attribution reconciliation</h3><p className="panel-subtitle">Every component reconciles to net profit within engine precision</p></div><span className={Math.abs(number(attribution.reconciliation_difference)) < 0.01 ? 'reconcile-ok' : 'reconcile-warning'}>{Math.abs(number(attribution.reconciliation_difference)) < 0.01 ? 'RECONCILED' : 'CHECK REQUIRED'}</span></div>
        <div className="attribution-grid">
          <ResultMetric label="Asset movement" value={signedMoney(attribution.asset_return_amount, currency)} tone={tone(attribution.asset_return_amount)} />
          <ResultMetric label="FX impact" value={signedMoney(attribution.fx_impact_amount, currency)} tone={tone(attribution.fx_impact_amount)} />
          <ResultMetric label="Dividends" value={signedMoney(attribution.dividend_amount, currency)} tone={tone(attribution.dividend_amount)} />
          <ResultMetric label="Fees" value={signedMoney(attribution.fees_amount, currency)} tone="down" />
          <ResultMetric label="Estimated tax" value={signedMoney(attribution.tax_amount, currency)} tone="down" />
          <ResultMetric label="Net P&L" value={signedMoney(attribution.net_profit, currency)} tone={tone(attribution.net_profit)} />
        </div>
      </section>

      {result.contributions?.length ? <section className="panel"><div className="panel-header"><div><h3 className="panel-title">Cash flows</h3><p className="panel-subtitle">Each contribution retains its scheduled date, execution date, units, and historical FX</p></div></div><div className="overflow-x-auto"><table><thead><tr><th>Scheduled</th><th>Trade date</th><th className="text-right">Contribution</th><th className="text-right">Units</th><th className="text-right">FX rate</th></tr></thead><tbody>{result.contributions.map((flow, index) => <tr key={`${flow.trade_date}-${index}`}><td>{String(flow.scheduled_date)}</td><td>{String(flow.trade_date)}</td><td className="text-right">{money(flow.amount, currency)}</td><td className="text-right font-mono">{decimal(flow.shares, 6)}</td><td className="text-right font-mono">{decimal(flow.fx_rate, 6)}</td></tr>)}</tbody></table></div></section> : null}

      <div className="lab-methodology-grid">
        <details className="panel"><summary>Assumptions & methodology</summary><ul>{result.assumptions?.map(item => <li key={item}>{item}</li>)}</ul>{result.provenance && <dl className="provenance-list"><div><dt>Market data</dt><dd>{result.provenance.marketDataSource}</dd></div><div><dt>Data range</dt><dd>{result.provenance.dataRange.start} → {result.provenance.dataRange.end}</dd></div><div><dt>Retrieved</dt><dd>{new Date(result.provenance.retrievedAt).toLocaleString()}</dd></div><div><dt>FX source</dt><dd>{result.provenance.fxSource}</dd></div><div><dt>Corporate actions</dt><dd>{result.provenance.corporateActionMethodology}</dd></div><div><dt>Fees</dt><dd>{result.provenance.feeMethodology}</dd></div></dl>}</details>
        {result.taxMethodology && <details className="panel"><summary>Tax estimate methodology</summary><dl className="provenance-list"><div><dt>Applied</dt><dd>{result.taxMethodology.applied ? 'Yes' : 'No'}</dd></div><div><dt>Method</dt><dd>{result.taxMethodology.methodology.replace(/_/g, ' ')}</dd></div><div><dt>Holding period</dt><dd>{result.taxMethodology.holdingPeriodDays} days</dd></div>{result.taxMethodology.applied && <><div><dt>Rule</dt><dd>{result.taxMethodology.jurisdiction} {result.taxMethodology.taxType} at {(result.taxMethodology.rate * 100).toFixed(2)}%</dd></div><div><dt>Source</dt><dd>{result.taxMethodology.sourceReference || 'N/A'}</dd></div></>}<div><dt>Important</dt><dd>{result.taxMethodology.disclaimer}</dd></div></dl></details>}
      </div>
      <p className="lab-disclaimer">Educational historical analysis only. This is not investment, legal, or tax advice.</p>
    </section>
  );
};

function ResultMetric({ label, value, tone: valueTone }: { label: string; value: string; tone?: 'up' | 'down' }) { return <div className="result-metric"><span>{label}</span><strong className={valueTone === 'up' ? 'movement-up' : valueTone === 'down' ? 'movement-down' : ''}>{value}</strong></div>; }
function modeTitle(mode: ScenarioResult['mode']) { return mode === 'SINGLE_INVESTMENT' ? 'Single Investment' : mode === 'RECURRING_INVESTMENT' ? 'Recurring Investment / DCA' : 'Portfolio Scenario'; }
function performanceOption(rows: Array<{ date: string; value: number }>, currency: string) { return { animationDuration: 450, backgroundColor: 'transparent', grid: { left: 70, right: 24, top: 26, bottom: 44 }, tooltip: { trigger: 'axis', backgroundColor: '#101210', borderColor: '#343834', textStyle: { color: '#f5f5ef' }, valueFormatter: (value: number) => money(value, currency) }, xAxis: { type: 'category', data: rows.map(row => date(row.date)), boundaryGap: false, axisLabel: { color: '#777c78', hideOverlap: true }, axisLine: { lineStyle: { color: '#343834' } } }, yAxis: { type: 'value', scale: true, axisLabel: { color: '#777c78', formatter: (value: number) => new Intl.NumberFormat('en', { notation: 'compact' }).format(value) }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.055)' } } }, dataZoom: [{ type: 'inside' }], series: [{ name: 'Portfolio value', type: 'line', data: rows.map(row => row.value), showSymbol: false, smooth: .15, lineStyle: { color: '#d6b978', width: 2 }, areaStyle: { color: 'rgba(214,185,120,.06)' } }] }; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(number(value)); }
function signedMoney(value: unknown, currency: string) { const amount = number(value); return `${amount > 0 ? '+' : amount < 0 ? '-' : ''}${money(Math.abs(amount), currency)}`; }
function percent(value: unknown) { return value == null || !Number.isFinite(Number(value)) ? 'N/A' : `${Number(value).toFixed(2)}%`; }
function drawdown(value: unknown) { return value == null || !Number.isFinite(Number(value)) ? 'N/A' : `-${Math.abs(Number(value)).toFixed(2)}%`; }
function decimal(value: unknown, digits = 2) { return value == null || !Number.isFinite(Number(value)) ? 'N/A' : Number(value).toFixed(digits); }
function tone(value: unknown): 'up' | 'down' | undefined { const parsed = Number(value); return !Number.isFinite(parsed) || parsed === 0 ? undefined : parsed > 0 ? 'up' : 'down'; }
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }
function stringDetail(value: Record<string, string | number>, key: string) { const item = value?.[key]; return item == null ? '' : String(item); }

export default LabResultView;
