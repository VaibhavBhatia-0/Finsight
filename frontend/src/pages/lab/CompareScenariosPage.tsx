import { useState } from 'react';
import { Spinner } from '../../components/Spinner';
import { useCompareScenarios, useScenarios } from '../../hooks/useScenario';
import type { ApiId } from '../../api/contracts';

export default function CompareScenariosPage() {
  const scenarios = useScenarios();
  const compare = useCompareScenarios();
  const [selected, setSelected] = useState<ApiId[]>([]);

  if (scenarios.isPending) return <Spinner />;
  if (scenarios.error) return <p className="p-4 text-red-600" role="alert">{scenarios.error.message}</p>;

  const toggle = (id: ApiId) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  return <main>
    <header className="page-heading"><div><p className="page-eyebrow">FinSight Lab · Normalized comparison</p><h1>Compare scenarios</h1><p className="page-subtitle">Compare percentage metrics directly while keeping cross-currency absolute values clearly separated.</p></div></header>
    {scenarios.data?.length ? <div className="space-y-2">{scenarios.data.map(scenario => <label key={scenario.id} className="flex items-center gap-3 rounded border p-3"><input type="checkbox" checked={selected.includes(scenario.id)} onChange={() => toggle(scenario.id)} /><span><strong>{scenario.name}</strong> · {scenario.scenario_type}</span></label>)}</div> : <p>No saved scenarios are available.</p>}
    <button type="button" disabled={selected.length < 2 || compare.isPending} onClick={() => compare.mutate(selected)} className="mt-4 rounded bg-gold-600 px-4 py-2 text-white disabled:opacity-50">Compare selected</button>
    {compare.error && <p className="mt-3 text-red-600" role="alert">{compare.error.message}</p>}
    {compare.data && <div className="mt-6"><p className="mb-2 text-sm text-gray-600">Percentage metrics are directly comparable. Absolute values are {compare.data.normalization.absoluteValuesComparable ? 'in one currency' : 'shown in different currencies and are not directly comparable'}.</p><div className="overflow-x-auto"><table className="min-w-full"><thead><tr><th className="text-left">Scenario</th><th className="text-left">Type</th><th className="text-right">Final value</th><th className="text-right">Return</th><th className="text-right">CAGR</th><th className="text-right">XIRR</th></tr></thead><tbody>{compare.data.metrics.map(metric => <tr key={metric.scenarioId} className="border-t"><td className="py-2">{metric.name}</td><td>{metric.scenarioType}</td><td className="text-right">{metric.finalValue == null ? '—' : `${metric.currency} ${metric.finalValue.toFixed(2)}`}</td><td className="text-right">{percent(metric.returnPercentage)}</td><td className="text-right">{percent(metric.cagr)}</td><td className="text-right">{percent(metric.xirr)}</td></tr>)}</tbody></table></div></div>}
  </main>;
}

function percent(value: number | null) {
  return value == null ? '—' : `${value.toFixed(2)}%`;
}
