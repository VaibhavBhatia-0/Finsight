import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import api from '../api/client';
import type { MarketHistory, MarketStock } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import FreshnessBadge from './FreshnessBadge';
import { Spinner } from './Spinner';
import { ThemeContext } from '../context/ThemeContext';

const periods = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'] as const;
const overlayOptions = ['SMA 20', 'SMA 50', 'SMA 200', 'RSI'] as const;
type ComparisonCandidate = Pick<MarketStock, 'id' | 'symbol' | 'quote'>;

export default function StockAnalyticsPanel({ stock, comparisonCandidates = [] }: { stock: MarketStock; comparisonCandidates?: ComparisonCandidate[] }) {
  const theme = useContext(ThemeContext)?.theme ?? 'dark';
  const [period, setPeriod] = useState<typeof periods[number]>('1Y');
  const [overlays, setOverlays] = useState<Set<string>>(new Set());
  const [comparisonId, setComparisonId] = useState('');
  const comparison = comparisonCandidates.find(item => String(item.id) === comparisonId && item.quote);
  const history = useQuery({
    queryKey: ['market-history', stock.id, period],
    queryFn: async () => (await api.get<MarketHistory>(endpoints.markets.stockPrices(stock.id), { params: { period } })).data,
    staleTime: period === '1D' || period === '5D' ? 60_000 : 60 * 60 * 1000,
  });
  const comparisonHistory = useQuery({
    queryKey: ['market-history', comparison?.id, period],
    queryFn: async () => (await api.get<MarketHistory>(endpoints.markets.stockPrices(comparison!.id), { params: { period } })).data,
    enabled: Boolean(comparison),
    staleTime: period === '1D' || period === '5D' ? 60_000 : 60 * 60 * 1000,
  });
  const option = useMemo(() => chartOption(history.data, comparisonHistory.data, stock.symbol, comparison?.symbol, overlays, theme), [comparison?.symbol, comparisonHistory.data, history.data, overlays, stock.symbol, theme]);
  const quote = stock.quote;

  function toggle(name: string) {
    setOverlays(current => { const next = new Set(current); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  }

  return (
    <div className="stock-inline-panel" onClick={event => event.stopPropagation()}>
      <div className="stock-inline-summary">
        <div><span>Price</span><strong>{quote ? money(quote.price, stock.currency) : 'N/A'}</strong></div>
        <div><span>Previous close</span><strong>{quote?.previousClose == null ? 'N/A' : money(quote.previousClose, stock.currency)}</strong></div>
        <div><span>Day range</span><strong>{quote?.low == null || quote.high == null ? 'N/A' : `${money(quote.low, stock.currency)} – ${money(quote.high, stock.currency)}`}</strong></div>
        <div><span>Volume</span><strong>{quote?.volume == null ? 'N/A' : compact(quote.volume)}</strong></div>
        {quote && <FreshnessBadge freshness={quote.freshnessLabel} timestamp={quote.marketTimestamp} />}
      </div>
      <div className="stock-chart-toolbar">
        <div className="period-switch" aria-label="Chart period">{periods.map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value}</button>)}</div>
        <div className="overlay-switch" aria-label="Technical overlays">{overlayOptions.map(value => <button key={value} className={overlays.has(value) ? 'active' : ''} aria-pressed={overlays.has(value)} onClick={() => toggle(value)}>{value}</button>)}</div>
        <label className="comparison-select">Compare
          <select value={comparisonId} onChange={event => setComparisonId(event.target.value)}>
            <option value="">None</option>
            {comparisonCandidates.filter(item => item.id !== stock.id && item.quote).map(item => <option key={item.id} value={String(item.id)}>{item.symbol}</option>)}
          </select>
        </label>
      </div>
      {history.isPending ? <Spinner /> : history.error ? <p role="alert" className="error-banner">Historical market data is unavailable.</p> : history.data ? (
        <>
          <ReactECharts option={option} notMerge lazyUpdate style={{ height: overlays.has('RSI') ? 430 : 370 }} />
          <p className="chart-provenance">{history.data.provider} · {history.data.interval} observations · adjusted close · {history.data.events.length} provider corporate actions · retrieved {new Date(history.data.fetchedAt).toLocaleString()}</p>
        </>
      ) : null}
    </div>
  );
}

function chartOption(history: MarketHistory | undefined, comparison: MarketHistory | undefined, symbol: string, comparisonSymbol: string | undefined, overlays: Set<string>, theme: 'dark' | 'light') {
  const bars = history?.bars ?? [];
  const compareByDate = new Map((comparison?.bars ?? []).map(row => [row.date, row.adjusted_close ?? row.close]));
  const hasComparison = Boolean(comparisonSymbol && compareByDate.size);
  const closes = bars.map(row => row.adjusted_close ?? row.close);
  const normalized = hasComparison && closes.length ? closes.map(value => value / closes[0] * 100) : closes;
  const compareValues = hasComparison
    ? bars.map(row => compareByDate.get(row.date) ?? null).map((value, _, values) => value == null || values.find(item => item != null) == null ? null : value / (values.find(item => item != null) as number) * 100)
    : [];
  const rsi = calculateRsi(closes, 14);
  const showRsi = overlays.has('RSI');
  const priceGrid = showRsi ? { left: 58, right: 24, top: 25, height: '51%' } : { left: 58, right: 24, top: 25, height: '61%' };
  const volumeGrid = showRsi ? { left: 58, right: 24, top: '61%', height: '12%' } : { left: 58, right: 24, top: '73%', height: '17%' };
  const grids: object[] = [priceGrid, volumeGrid];
  if (showRsi) grids.push({ left: 58, right: 24, top: '79%', height: '13%' });
  const palette = theme === 'light'
    ? { text: '#625b4d', grid: 'rgba(90,72,38,.12)', border: '#d5c6aa', tooltip: '#fff9ed', tooltipText: '#24211c', primary: '#9a722a', comparison: '#25705b' }
    : { text: '#929690', grid: 'rgba(255,255,255,.055)', border: '#343834', tooltip: '#101210', tooltipText: '#f5f5ef', primary: '#d4aa58', comparison: '#61b89a' };
  const series: any[] = [
    { name: hasComparison ? `${symbol} normalized` : symbol, type: 'line', data: normalized, showSymbol: false, smooth: .15, lineStyle: { width: 2, color: palette.primary }, itemStyle: { color: palette.primary }, xAxisIndex: 0, yAxisIndex: 0 },
    { name: 'Volume', type: 'bar', data: bars.map(row => row.volume), xAxisIndex: 1, yAxisIndex: 1, itemStyle: { color: 'rgba(205,167,94,.34)' } },
  ];
  if (hasComparison) series.push({ name: `${comparisonSymbol} normalized`, type: 'line', data: compareValues, showSymbol: false, smooth: .15, lineStyle: { width: 1.5, color: palette.comparison }, xAxisIndex: 0, yAxisIndex: 0 });
  for (const size of [20, 50, 200]) if (overlays.has(`SMA ${size}`)) series.push({ name: `SMA ${size}`, type: 'line', data: movingAverage(hasComparison ? normalized : closes, size), showSymbol: false, lineStyle: { width: 1, type: 'dashed' }, xAxisIndex: 0, yAxisIndex: 0 });
  if (showRsi) series.push({ name: 'RSI 14', type: 'line', data: rsi, showSymbol: false, lineStyle: { width: 1.4, color: palette.comparison }, xAxisIndex: 2, yAxisIndex: 2, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 30 }, { yAxis: 70 }], lineStyle: { color: palette.grid, type: 'dashed' } } });
  const axis = { type: 'category', data: bars.map(row => formatAxisDate(row.date)), boundaryGap: false, axisLine: { lineStyle: { color: palette.border } }, axisLabel: { color: palette.text, hideOverlap: true }, splitLine: { show: false } };
  return {
    animationDuration: 350, backgroundColor: 'transparent', grid: grids,
    tooltip: { trigger: 'axis', backgroundColor: palette.tooltip, borderColor: palette.border, textStyle: { color: palette.tooltipText } },
    legend: { top: 0, right: 18, textStyle: { color: palette.text, fontSize: 10 } },
    xAxis: [{ ...axis, gridIndex: 0, axisLabel: { show: false } }, { ...axis, gridIndex: 1 }, ...(showRsi ? [{ ...axis, gridIndex: 2, axisLabel: { show: false } }] : [])],
    yAxis: [
      { type: 'value', gridIndex: 0, scale: true, name: hasComparison ? 'NORMALIZED' : history?.currency, nameTextStyle: { color: palette.text }, axisLabel: { color: palette.text }, splitLine: { lineStyle: { color: palette.grid } } },
      { type: 'value', gridIndex: 1, axisLabel: { color: palette.text, formatter: (value: number) => compact(value) }, splitLine: { show: false } },
      ...(showRsi ? [{ type: 'value', gridIndex: 2, min: 0, max: 100, axisLabel: { color: palette.text }, splitLine: { show: false } }] : []),
    ],
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1, ...(showRsi ? [2] : [])] }], series,
  };
}

function movingAverage(values: number[], size: number): Array<number | null> { return values.map((_, index) => index + 1 < size ? null : values.slice(index + 1 - size, index + 1).reduce((sum, value) => sum + value, 0) / size); }
function calculateRsi(values: number[], size: number): Array<number | null> {
  return values.map((_, index) => {
    if (index < size) return null;
    const changes = values.slice(index - size, index + 1).slice(1).map((value, offset) => value - values[index - size + offset]);
    const gains = changes.reduce((sum, value) => sum + Math.max(0, value), 0) / size;
    const losses = changes.reduce((sum, value) => sum + Math.max(0, -value), 0) / size;
    return losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
  });
}
function formatAxisDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: value.length <= 10 ? '2-digit' : undefined }); }
function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
function compact(value: number) { return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
