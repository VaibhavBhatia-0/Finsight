import type { Insight, MarketIndex, MarketStock } from '../api/contracts';

const palette = ['#d1a65a', '#5ca98c', '#9a8a6b', '#b98a3f'];

export function IndexPerformanceChart({ indices }: { indices: MarketIndex[] }) {
  return <DivergingBars title="Index session change" rows={indices.map(index => ({ label: index.name, value: index.changePercent }))} />;
}

export function MarketMoversChart({ stocks }: { stocks: MarketStock[] }) {
  const movers = stocks.filter(stock => stock.quote).slice().sort((a, b) => Math.abs(b.quote!.changePercent) - Math.abs(a.quote!.changePercent)).slice(0, 6);
  return <DivergingBars title="Largest catalogue moves" rows={movers.map(stock => ({ label: stock.symbol, value: stock.quote!.changePercent }))} compact />;
}

export function InsightDistributionChart({ insights }: { insights: Insight[] }) {
  const categories: Insight['category'][] = ['CASH_FLOW', 'BUDGET', 'GOAL', 'PORTFOLIO'];
  const counts = categories.map(category => insights.filter(insight => insight.category === category).length);
  const max = Math.max(1, ...counts);
  return (
    <div className="insight-distribution" role="img" aria-label="Insight count by category">
      {categories.map((category, index) => <div key={category}><span>{category.replace('_', ' ')}</span><i><b style={{ width: `${counts[index] / max * 100}%`, background: palette[index] }} /></i><strong>{counts[index]}</strong></div>)}
    </div>
  );
}

function DivergingBars({ title, rows, compact = false }: { title: string; rows: Array<{ label: string; value: number }>; compact?: boolean }) {
  const max = Math.max(1, ...rows.map(row => Math.abs(row.value)));
  return (
    <div className={`diverging-chart${compact ? ' compact' : ''}`} role="img" aria-label={title}>
      <div className="diverging-axis" aria-hidden="true" />
      {rows.map(row => {
        const width = Math.abs(row.value) / max * 48;
        return <div className="diverging-row" key={row.label}><span>{row.label}</span><div className="diverging-track"><i className={row.value < 0 ? 'negative' : 'positive'} style={row.value < 0 ? { right: '50%', width: `${width}%` } : { left: '50%', width: `${width}%` }} /></div><strong className={row.value < 0 ? 'movement-down' : 'movement-up'}>{row.value >= 0 ? '+' : ''}{row.value.toFixed(2)}%</strong></div>;
      })}
    </div>
  );
}
