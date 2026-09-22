import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import api from '../api/client';
import type { MarketHistory, MarketStock, TechnicalAnalysisResponse } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import { useTechnicalAnalysis } from '../hooks/useMarketIntelligence';
import FreshnessBadge from './FreshnessBadge';
import { Spinner } from './Spinner';
import { ThemeContext } from '../context/ThemeContext';

const periods = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'] as const;
const overlayOptions = ['SMA 20', 'SMA 50', 'SMA 200', 'EMA 20', 'Bollinger', 'Volume', 'RSI', 'MACD'] as const;
type ComparisonCandidate = Pick<MarketStock, 'id' | 'symbol' | 'quote'>;

export default function StockAnalyticsPanel({ stock, comparisonCandidates = [] }: { stock: MarketStock; comparisonCandidates?: ComparisonCandidate[] }) {
  const theme = useContext(ThemeContext)?.theme ?? 'dark';
  const [period, setPeriod] = useState<typeof periods[number]>('1Y');
  const [overlays, setOverlays] = useState<Set<string>>(new Set(['Volume']));
  const [comparisonId, setComparisonId] = useState('');
  const comparison = comparisonCandidates.find(item => String(item.id) === comparisonId && item.quote);
  const technicals = useTechnicalAnalysis(stock.id, period);
  const comparisonHistory = useQuery({
    queryKey: ['market-history', comparison?.id, period],
    queryFn: async () => (await api.get<MarketHistory>(endpoints.markets.stockPrices(comparison!.id), { params: { period } })).data,
    enabled: Boolean(comparison),
    staleTime: period === '1D' || period === '5D' ? 60_000 : 60 * 60 * 1000,
  });
  const option = useMemo(() => chartOption(technicals.data, comparisonHistory.data, stock.symbol, comparison?.symbol, overlays, theme), [comparison?.symbol, comparisonHistory.data, overlays, stock.symbol, technicals.data, theme]);
  const quote = stock.quote;

  function toggle(name: string) { setOverlays(current => { const next = new Set(current); if (next.has(name)) next.delete(name); else next.add(name); return next; }); }

  return <div className="stock-inline-panel" onClick={event => event.stopPropagation()}>
    <div className="stock-inline-summary">
      <div><span>Price</span><strong>{quote ? money(quote.price, stock.currency) : 'N/A'}</strong></div>
      <div><span>Previous close</span><strong>{quote?.previousClose == null ? 'N/A' : money(quote.previousClose, stock.currency)}</strong></div>
      <div><span>Day range</span><strong>{quote?.low == null || quote.high == null ? 'N/A' : `${money(quote.low, stock.currency)} – ${money(quote.high, stock.currency)}`}</strong></div>
      <div><span>Volume</span><strong>{quote?.volume == null ? 'N/A' : compact(quote.volume)}</strong></div>
      {quote && <FreshnessBadge freshness={quote.freshnessLabel} timestamp={quote.marketTimestamp} />}
    </div>
    <div className="stock-chart-toolbar">
      <div className="period-switch" aria-label="Chart period">{periods.map(value => <button type="button" key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value}</button>)}</div>
      <div className="overlay-switch" aria-label="Technical overlays">{overlayOptions.map(value => <button type="button" key={value} className={overlays.has(value) ? 'active' : ''} aria-pressed={overlays.has(value)} onClick={() => toggle(value)}>{value}</button>)}</div>
      <label className="comparison-select">Compare<select value={comparisonId} onChange={event => setComparisonId(event.target.value)}><option value="">None</option>{comparisonCandidates.filter(item => item.id !== stock.id && item.quote).map(item => <option key={item.id} value={String(item.id)}>{item.symbol}</option>)}</select></label>
    </div>
    {technicals.isPending ? <Spinner /> : technicals.error ? <p role="alert" className="error-banner">Historical market data is unavailable.</p> : technicals.data ? <>
      <ReactECharts option={option} notMerge lazyUpdate style={{ height: overlays.has('RSI') || overlays.has('MACD') ? 520 : 390 }} />
      <dl className="technical-summary"><Fact label="RSI 14" value={metric(technicals.data.summary?.rsi14)} /><Fact label="Annualized volatility" value={percent(technicals.data.summary?.volatility)} /><Fact label="Maximum drawdown" value={percent(technicals.data.summary?.maxDrawdown)} /><Fact label="As of" value={technicals.data.summary?.asOfDate ?? 'N/A'} /></dl>
      <p className="chart-provenance">{technicals.data.provider} · adjusted close · retrieved {new Date(technicals.data.fetchedAt).toLocaleString()}. {technicals.data.methodology}</p>
    </> : null}
  </div>;
}

function chartOption(analysis: TechnicalAnalysisResponse | undefined, comparison: MarketHistory | undefined, symbol: string, comparisonSymbol: string | undefined, overlays: Set<string>, theme: 'dark' | 'light') {
  const points = analysis?.series ?? [];
  const compareByDate = new Map((comparison?.bars ?? []).map(row => [row.date, row.adjusted_close ?? row.close]));
  const hasComparison = Boolean(comparisonSymbol && compareByDate.size && points.length);
  const base = points[0]?.close;
  const primary = hasComparison && base ? points.map(row => row.close / base * 100) : points.map(row => row.close);
  const rawCompare = points.map(row => compareByDate.get(row.date) ?? null);
  const compareBase = rawCompare.find(value => value != null);
  const compared = compareBase ? rawCompare.map(value => value == null ? null : value / compareBase * 100) : [];
  const showVolume = overlays.has('Volume');
  const showRsi = overlays.has('RSI');
  const showMacd = overlays.has('MACD');
  const lowerCount = Number(showRsi) + Number(showMacd);
  const priceHeight = lowerCount ? (showVolume ? 45 : 55) : (showVolume ? 67 : 82);
  const grids: any[] = [{ left: 58, right: 24, top: 32, height: `${priceHeight}%` }];
  if (showVolume) grids.push({ left: 58, right: 24, top: `${priceHeight + 9}%`, height: lowerCount ? '10%' : '16%' });
  const lowerNames = [showRsi ? 'RSI' : null, showMacd ? 'MACD' : null].filter(Boolean) as string[];
  lowerNames.forEach((_, index) => grids.push({ left: 58, right: 24, top: `${showVolume ? priceHeight + 23 + index * 15 : priceHeight + 9 + index * 18}%`, height: lowerCount === 2 ? '11%' : '15%' }));
  const palette = theme === 'light' ? { text: '#625b4d', grid: 'rgba(90,72,38,.12)', border: '#d5c6aa', tooltip: '#fff9ed', tooltipText: '#24211c', primary: '#9a722a', comparison: '#25705b' } : { text: '#929690', grid: 'rgba(255,255,255,.055)', border: '#343834', tooltip: '#101210', tooltipText: '#f5f5ef', primary: '#d4aa58', comparison: '#61b89a' };
  const series: any[] = [{ name: hasComparison ? `${symbol} normalized` : symbol, type: 'line', data: primary, showSymbol: false, smooth: .12, lineStyle: { width: 2, color: palette.primary }, itemStyle: { color: palette.primary }, xAxisIndex: 0, yAxisIndex: 0 }];
  if (hasComparison) series.push({ name: `${comparisonSymbol} normalized`, type: 'line', data: compared, showSymbol: false, lineStyle: { width: 1.5, color: palette.comparison }, xAxisIndex: 0, yAxisIndex: 0 });
  const addLine = (enabled: boolean, name: string, values: Array<number | null>, style: object = {}) => { if (enabled) series.push({ name, type: 'line', data: hasComparison && base ? values.map(value => value == null ? null : value / base * 100) : values, showSymbol: false, lineStyle: { width: 1, ...style }, xAxisIndex: 0, yAxisIndex: 0 }); };
  addLine(overlays.has('SMA 20'), 'SMA 20', points.map(row => row.sma20), { type: 'dashed' });
  addLine(overlays.has('SMA 50'), 'SMA 50', points.map(row => row.sma50), { type: 'dashed' });
  addLine(overlays.has('SMA 200'), 'SMA 200', points.map(row => row.sma200), { type: 'dashed' });
  addLine(overlays.has('EMA 20'), 'EMA 20', points.map(row => row.ema20), { color: '#b98568' });
  if (overlays.has('Bollinger')) { addLine(true, 'Bollinger upper', points.map(row => row.bollingerUpper), { width: .8, opacity: .7 }); addLine(true, 'Bollinger middle', points.map(row => row.bollingerMiddle), { width: .8, type: 'dotted', opacity: .6 }); addLine(true, 'Bollinger lower', points.map(row => row.bollingerLower), { width: .8, opacity: .7 }); }
  let gridIndex = 1;
  if (showVolume) { series.push({ name: 'Volume', type: 'bar', data: points.map(row => row.volume), xAxisIndex: gridIndex, yAxisIndex: gridIndex, itemStyle: { color: 'rgba(205,167,94,.34)' } }); gridIndex += 1; }
  if (showRsi) { series.push({ name: 'RSI 14', type: 'line', data: points.map(row => row.rsi14), showSymbol: false, xAxisIndex: gridIndex, yAxisIndex: gridIndex, lineStyle: { width: 1.3, color: palette.comparison }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 30 }, { yAxis: 70 }], lineStyle: { color: palette.grid, type: 'dashed' } } }); gridIndex += 1; }
  if (showMacd) series.push({ name: 'MACD', type: 'line', data: points.map(row => row.macd), showSymbol: false, xAxisIndex: gridIndex, yAxisIndex: gridIndex }, { name: 'Signal', type: 'line', data: points.map(row => row.macdSignal), showSymbol: false, xAxisIndex: gridIndex, yAxisIndex: gridIndex }, { name: 'Histogram', type: 'bar', data: points.map(row => row.macdHistogram), xAxisIndex: gridIndex, yAxisIndex: gridIndex });
  const axis = { type: 'category', data: points.map(row => formatAxisDate(row.date)), boundaryGap: false, axisLine: { lineStyle: { color: palette.border } }, axisLabel: { color: palette.text, hideOverlap: true }, splitLine: { show: false } };
  const xAxes = grids.map((_, index) => ({ ...axis, gridIndex: index, axisLabel: index === grids.length - 1 ? axis.axisLabel : { show: false } }));
  const yAxes = grids.map((_, index) => { const lower = lowerNames[index - (showVolume ? 2 : 1)]; return { type: 'value', gridIndex: index, scale: index === 0, min: lower === 'RSI' ? 0 : undefined, max: lower === 'RSI' ? 100 : undefined, axisLabel: { color: palette.text, formatter: showVolume && index === 1 ? (value: number) => compact(value) : undefined }, splitLine: { lineStyle: { color: palette.grid } } }; });
  return { animationDuration: 350, backgroundColor: 'transparent', grid: grids, tooltip: { trigger: 'axis', backgroundColor: palette.tooltip, borderColor: palette.border, textStyle: { color: palette.tooltipText } }, legend: { top: 0, right: 18, textStyle: { color: palette.text, fontSize: 10 } }, xAxis: xAxes, yAxis: yAxes, dataZoom: [{ type: 'inside', xAxisIndex: grids.map((_, index) => index) }], series };
}

function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function metric(value: number | null | undefined) { return value == null ? 'N/A' : value.toFixed(2); }
function percent(value: number | null | undefined) { return value == null ? 'N/A' : `${value.toFixed(2)}%`; }
function formatAxisDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: value.length <= 10 ? '2-digit' : undefined }); }
function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
function compact(value: number) { return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
