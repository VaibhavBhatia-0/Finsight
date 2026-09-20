import { FreshnessBadge } from '../components/FreshnessBadge';
import { InsightDistributionChart } from '../components/MarketInsightCharts';
import { Spinner } from '../components/Spinner';
import { useInsights } from '../hooks/useInsights';

export default function InsightsPage() {
  const query = useInsights();
  if (query.isPending) return <Spinner />;
  if (query.error) return <p className="p-4 text-red-600">{query.error.message}</p>;

  const result = query.data!;
  const warnings = result.insights.filter(insight => insight.severity === 'warning').length;
  const positives = result.insights.filter(insight => insight.severity === 'positive').length;
  return (
    <main>
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">Analyze</p><h1>Insights</h1>
          <p className="page-subtitle">Deterministic observations from your recorded finance and portfolio data—never synthetic advice.</p>
        </div>
        <FreshnessBadge freshness={result.calculation.usesSyntheticMarketData || result.calculation.hasSyntheticFx ? 'Synthetic' : 'Static'} />
      </header>
      <div className="metric-grid mb-4">
        <InsightMetric label="Signals" value={result.insights.length} note="Deterministic rules triggered" />
        <InsightMetric label="Attention" value={warnings} note="Items requiring review" tone={warnings ? 'down' : undefined} />
        <InsightMetric label="Positive" value={positives} note="Healthy recorded signals" tone={positives ? 'up' : undefined} />
        <InsightMetric label="Data basis" value={result.calculation.usesSyntheticMarketData ? 'Mixed' : 'Ledger'} note={result.calculation.hasSyntheticFx ? 'Includes synthetic FX' : 'Recorded transactions'} />
      </div>
      <section className="panel insight-chart-panel mb-4">
        <div className="panel-header"><div><p className="page-eyebrow">Signal map</p><h2 className="panel-title">Insight distribution</h2><p className="panel-subtitle">Triggered rules grouped by financial domain</p></div></div>
        <InsightDistributionChart insights={result.insights} />
      </section>
      {result.insights.length === 0 ? (
        <div className="empty-state"><p>Add finance transactions or portfolio holdings to generate rule-based observations.</p></div>
      ) : (
        <div className="space-y-3">
          {result.insights.map(insight => (
            <article key={insight.id} className={`insight-card ${accent(insight.severity)}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{insight.category.replace('_', ' ')}</p>
                  <h2 className="font-semibold">{insight.title}</h2>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{insight.message}</p>
                </div>
                {insight.metric && <p className="font-mono text-sm">{insight.metric.value.toFixed(2)} {insight.metric.unit}</p>}
              </div>
              {insight.basis === 'SYNTHETIC_MARKET_DATA' && <p className="mt-2 text-xs text-orange-700">Uses synthetic development market prices.</p>}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function InsightMetric({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: 'up' | 'down' }) {
  return <article className="metric-card"><p className="metric-label">{label}</p><p className={`metric-value${tone ? ` movement-${tone}` : ''}`}>{value}</p><p className="metric-note">{note}</p></article>;
}

function accent(severity: 'positive' | 'warning' | 'info') {
  if (severity === 'warning') return 'insight-warning';
  if (severity === 'positive') return 'insight-positive';
  return 'insight-info';
}
