import type { CSSProperties } from 'react';
import type { PortfolioHolding } from '../api/contracts';
import { smoothPath, useChartPalette } from './chartTheme';

const chartWidth = 760;
const chartHeight = 300;
const plot = { left: 45, right: 24, top: 32, bottom: 42 };

export function PositionPerformanceChart({ holdings }: { holdings: PortfolioHolding[] }) {
  if (!holdings.length) return <ChartEmpty message="Add a buy transaction to unlock position analytics." />;

  const rows = holdings.slice().sort((a, b) => b.weight - a.weight).slice(0, 8);
  const innerWidth = chartWidth - plot.left - plot.right;
  const innerHeight = chartHeight - plot.top - plot.bottom;
  const slot = innerWidth / rows.length;
  const maxWeight = Math.max(10, ...rows.map(row => row.weight));
  const returns = rows.map(row => row.unrealizedPnLPct);
  const minReturn = Math.min(0, ...returns);
  const maxReturn = Math.max(0, ...returns);
  const returnRange = Math.max(1, maxReturn - minReturn);
  const returnY = (value: number) => plot.top + (maxReturn - value) / returnRange * innerHeight;
  const points = rows.map((row, index) => ({ x: plot.left + slot * index + slot / 2, y: returnY(row.unrealizedPnLPct) }));
  const curve = smoothPath(points);
  const baseline = plot.top + innerHeight;
  const area = `${curve} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
  const barWidth = Math.min(22, slot * .34);

  return (
    <div className="native-chart" role="img" aria-label="Position allocation weights and unrealized returns">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="bar-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="stop-s1" /><stop offset="1" className="stop-s3" stopOpacity=".18" /></linearGradient>
          <linearGradient id="return-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="stop-s2" stopOpacity=".32" /><stop offset="1" className="stop-s2" stopOpacity="0" /></linearGradient>
          <filter id="line-glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(tick => { const y = plot.top + tick * innerHeight; return <line key={tick} x1={plot.left} x2={chartWidth - plot.right} y1={y} y2={y} className="chart-grid-line" />; })}
        <line x1={plot.left} x2={chartWidth - plot.right} y1={returnY(0)} y2={returnY(0)} className="chart-zero-line" />
        {rows.map((row, index) => {
          const barHeight = Math.max(2, row.weight / maxWeight * innerHeight * .78);
          const x = plot.left + slot * index + slot / 2 - barWidth / 2;
          return <g key={row.stockId} className="chart-position"><rect x={x} y={baseline - barHeight} width={barWidth} height={barHeight} rx={Math.min(7, barWidth / 2)} className="chart-bar" style={{ '--i': index } as CSSProperties}><title>{row.symbol}: {row.weight.toFixed(2)}% allocation</title></rect><text x={plot.left + slot * index + slot / 2} y={chartHeight - 15} textAnchor="middle" className="chart-axis-label">{row.symbol}</text></g>;
        })}
        <path d={area} fill="url(#return-area)" className="chart-return-area" />
        <path d={curve} pathLength={1} className="chart-return-line" filter="url(#line-glow)" />
        {rows.map((row, index) => <circle key={row.stockId} cx={points[index].x} cy={points[index].y} r="4.5" className={row.unrealizedPnLPct < 0 ? 'chart-point negative' : 'chart-point'} style={{ '--i': index } as CSSProperties}><title>{row.symbol}: {signed(row.unrealizedPnLPct)}% unrealized return</title></circle>)}
        <text x={plot.left} y="13" className="chart-unit">WEIGHT % / RETURN %</text>
      </svg>
      <div className="chart-key"><span><i className="bar-key" />Allocation</span><span><i className="line-key" />Unrealized return</span></div>
    </div>
  );
}

export function AllocationDonut({ holdings, cashWeight }: { holdings: PortfolioHolding[]; cashWeight: number }) {
  const { series } = useChartPalette();
  // Sorted like the dashboard legend so the first colours line up with it; cash is last and always neutral grey.
  const holdingColors = series.slice(0, 4);
  const data = holdings.map(row => ({ name: row.symbol, value: row.weight })).sort((a, b) => b.value - a.value)
    .map((item, index) => ({ ...item, color: holdingColors[index % holdingColors.length] }));
  if (cashWeight > 0.005) data.push({ name: 'Cash', value: cashWeight, color: series[series.length - 1] });
  if (!data.length) return <ChartEmpty message="Portfolio allocation appears after the first transaction." />;

  let offset = 0;
  return (
    <div className="donut-chart" role="img" aria-label="Current portfolio allocation by asset and cash">
      <svg viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="77" className="donut-track" />
        {data.map((item, index) => {
          const value = Math.max(0, item.value);
          const segment = <circle key={item.name} cx="110" cy="110" r="77" pathLength="100" stroke={item.color} strokeDasharray={`${value} ${100 - value}`} strokeDashoffset={-offset} className="donut-segment" style={{ color: item.color, '--i': index } as CSSProperties}><title>{item.name}: {value.toFixed(2)}%</title></circle>;
          offset += value;
          return segment;
        })}
        <text x="110" y="104" textAnchor="middle" className="donut-kicker">NET ASSETS</text>
        <text x="110" y="127" textAnchor="middle" className="donut-value">{data.length}</text>
        <text x="110" y="143" textAnchor="middle" className="donut-caption">ALLOCATIONS</text>
      </svg>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return <div className="chart-empty"><span className="chart-empty-line" aria-hidden="true" /><p>{message}</p></div>;
}

function signed(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`; }
