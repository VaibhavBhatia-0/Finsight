// src/pages/lab/LabResultView.tsx
import React from "react";
import { FreshnessBadge } from "../../components/FreshnessBadge";
import { Loader2 } from "lucide-react";
import type { ScenarioResult } from "../../api/contracts";

/**
 * A reusable component to display backtest / simulation results.
 * It expects a result object that may contain various financial metrics.
 * Only the metrics that exist on the object will be rendered.
 */
interface Props {
  result: ScenarioResult | null;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
}

export const LabResultView: React.FC<Props> = ({ result, isLoading, isError, error }) => {
  if (isLoading) {
    return (
      <div className="flex items-center text-champagne-600" role="status">
        <Loader2 className="mr-2 animate-spin" /> Loading result...
      </div>
    );
  }

  if (isError) {
    return <p className="text-red-600">Error loading result: {error?.message}</p>;
  }

  if (!result) {
    return <p className="text-gray-500">No result to display.</p>;
  }

  // Helper to render a metric only when present
  const renderMetric = (label: string, value: unknown) => {
    if (value === undefined || value === null) return null;
    return (
      <div className="flex justify-between py-1">
        <span className="font-medium">{label}:</span>
        <span>{String(value)}</span>
      </div>
    );
  };

  return (
    <section className="mt-8 border rounded p-4 bg-gray-50">
      <h2 className="text-xl font-semibold mb-2">Simulation Result</h2>
      <div className="grid grid-cols-1 gap-2">
        {renderMetric("Mode", result.mode)}
        {Object.entries(result.financials ?? {}).map(([key, value]) => <React.Fragment key={`financial-${key}`}>{renderMetric(key.replace(/_/g, ' '), value)}</React.Fragment>)}
        {Object.entries(result.risk_metrics ?? {}).map(([key, value]) => <React.Fragment key={`risk-${key}`}>{renderMetric(key.replace(/_/g, ' '), value)}</React.Fragment>)}
        {Object.entries(result.attribution ?? {}).map(([key, value]) => <React.Fragment key={`attribution-${key}`}>{renderMetric(`Attribution: ${key.replace(/_/g, ' ')}`, value)}</React.Fragment>)}
      </div>
      {/* Assumptions & Methodology */}
      {result.assumptions && (
        <details className="mt-4">
          <summary className="cursor-pointer text-indigo-600 underline">Assumptions & Methodology</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">{Array.isArray(result.assumptions) ? result.assumptions.join('\n') : result.assumptions}</p>
        </details>
      )}
      {result.taxMethodology && <details className="mt-4"><summary className="cursor-pointer text-indigo-600 underline">Tax estimate methodology</summary><dl className="mt-2 grid gap-1 text-sm"><div><dt className="inline font-medium">Applied: </dt><dd className="inline">{result.taxMethodology.applied ? 'Yes' : 'No'}</dd></div><div><dt className="inline font-medium">Method: </dt><dd className="inline">{result.taxMethodology.methodology.replace(/_/g, ' ')}</dd></div><div><dt className="inline font-medium">Holding period: </dt><dd className="inline">{result.taxMethodology.holdingPeriodDays} days</dd></div>{result.taxMethodology.applied && <><div><dt className="inline font-medium">Rule: </dt><dd className="inline">{result.taxMethodology.jurisdiction} {result.taxMethodology.taxType} at {(result.taxMethodology.rate * 100).toFixed(2)}%</dd></div><div><dt className="inline font-medium">Exemption: </dt><dd className="inline">{result.taxMethodology.exemptionAmount.toLocaleString()}</dd></div><div><dt className="inline font-medium">Source: </dt><dd className="inline">{result.taxMethodology.sourceReference}</dd></div></>}<p className="mt-2">{result.taxMethodology.disclaimer}</p></dl></details>}
      {/* Freshness badge */}
      <div className="mt-2"><FreshnessBadge freshness="Synthetic" /></div>
      {/* Disclaimer */}
      <p className="mt-4 text-xs text-gray-600 italic">
        The information provided is for educational purposes only and does not constitute financial advice.
      </p>
    </section>
  );
};

export default LabResultView;
