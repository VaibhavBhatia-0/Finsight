import type { PortfolioHolding } from '../api/contracts';

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
  const points = rows.map((row, index) => `${plot.left + slot * index + slot / 2},${returnY(row.unrealizedPnLPct)}`).join(' ');

  return (
    <div className="native-chart" role="img" aria-label="Position allocation weights and unrealized returns">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="return-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9b8cff" stopOpacity=".24" /><stop offset="1" stopColor="#9b8cff" stopOpacity="0" /></linearGradient>
          <filter id="line-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(tick => { const y = plot.top + tick * innerHeight; return <line key={tick} x1={plot.left} x2={chartWidth - plot.right} y1={y} y2={y} className="chart-grid-line" />; })}
        <line x1={plot.left} x2={chartWidth - plot.right} y1={returnY(0)} y2={returnY(0)} className="chart-zero-line" />
        {rows.map((row, index) => {
          const barHeight = Math.max(2, row.weight / maxWeight * innerHeight * .78);
          const x = plot.left + slot * index + slot * .22;
          return <g key={row.stockId} className="chart-position"><rect x={x} y={plot.top + innerHeight - barHeight} width={slot * .56} height={barHeight} rx="7" className="chart-bar"><title>{row.symbol}: {row.weight.toFixed(2)}% allocation</title></rect><text x={plot.left + slot * index + slot / 2} y={chartHeight - 15} textAnchor="middle" className="chart-axis-label">{row.symbol}</text></g>;
        })}
        <polygon points={`${plot.left + slot / 2},${plot.top + innerHeight} ${points} ${plot.left + slot * (rows.length - 1) + slot / 2},${plot.top + innerHeight}`} fill="url(#return-area)" />
        <polyline points={points} className="chart-return-line" filter="url(#line-glow)" />
        {rows.map((row, index) => <circle key={row.stockId} cx={plot.left + slot * index + slot / 2} cy={returnY(row.unrealizedPnLPct)} r="4" className={row.unrealizedPnLPct < 0 ? 'chart-point negative' : 'chart-point'}><title>{row.symbol}: {signed(row.unrealizedPnLPct)}% unrealized return</title></circle>)}
        <text x={plot.left} y="13" className="chart-unit">WEIGHT % / RETURN %</text>
      </svg>
      <div className="chart-key"><span><i className="bar-key" />Allocation</span><span><i className="line-key" />Unrealized return</span></div>
    </div>
  );
}

export function AllocationDonut({ holdings, cashWeight }: { holdings: PortfolioHolding[]; cashWeight: number }) {
  const data = holdings.map(row => ({ name: row.symbol, value: row.weight }));
  if (cashWeight > 0.005) data.push({ name: 'Cash', value: cashWeight });
  if (!data.length) return <ChartEmpty message="Portfolio allocation appears after the first transaction." />;

  const colors = ['#9b8cff', '#d1a65a', '#7783a5', '#c9c3ff', '#867044', '#59607a', '#6d63ad', '#b9a878'];
  let offset = 0;
  return (
    <div className="donut-chart" role="img" aria-label="Current portfolio allocation by asset and cash">
      <svg viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="77" className="donut-track" />
        {data.map((item, index) => {
          const value = Math.max(0, item.value);
          const segment = <circle key={item.name} cx="110" cy="110" r="77" pathLength="100" stroke={colors[index % colors.length]} strokeDasharray={`${value} ${100 - value}`} strokeDashoffset={-offset} className="donut-segment"><title>{item.name}: {value.toFixed(2)}%</title></circle>;
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
