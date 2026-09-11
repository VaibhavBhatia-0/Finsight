import { FreshnessBadge } from '../components/FreshnessBadge';
import { Spinner } from '../components/Spinner';
import { useInsights } from '../hooks/useInsights';

export default function InsightsPage() {
  const query = useInsights();
  if (query.isPending) return <Spinner />;
  if (query.error) return <p className="p-4 text-red-600">{query.error.message}</p>;

  const result = query.data!;
  return (
    <main className="mx-auto max-w-4xl p-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-sm text-gray-600">Deterministic observations from your recorded finance and portfolio data.</p>
        </div>
        <FreshnessBadge freshness={result.calculation.usesSyntheticMarketData || result.calculation.hasSyntheticFx ? 'Synthetic' : 'Static'} />
      </div>
      {result.insights.length === 0 ? (
        <p className="rounded border p-4">Add finance transactions or portfolio holdings to generate rule-based observations.</p>
      ) : (
        <div className="space-y-3">
          {result.insights.map(insight => (
            <article key={insight.id} className={`rounded border-l-4 p-4 ${accent(insight.severity)}`}>
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

function accent(severity: 'positive' | 'warning' | 'info') {
  if (severity === 'warning') return 'border-l-orange-500 border-gray-200';
  if (severity === 'positive') return 'border-l-green-500 border-gray-200';
  return 'border-l-blue-500 border-gray-200';
}
