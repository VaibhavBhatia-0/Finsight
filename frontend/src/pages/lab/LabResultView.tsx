// src/pages/lab/LabResultView.tsx
import React from "react";
import { FreshnessBadge } from "../../components/FreshnessBadge";
import { Loader2 } from "lucide-react";

/**
 * A reusable component to display backtest / simulation results.
 * It expects a result object that may contain various financial metrics.
 * Only the metrics that exist on the object will be rendered.
 */
export interface LabResult {
  // Generic fields – allow any additional keys
  [key: string]: any;
}

interface Props {
  result: LabResult | null;
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
  const renderMetric = (label: string, value: any) => {
    if (value === undefined || value === null) return null;
    return (
      <div className="flex justify-between py-1">
        <span className="font-medium">{label}:</span>
        <span>{value}</span>
      </div>
    );
  };

  return (
    <section className="mt-8 border rounded p-4 bg-gray-50">
      <h2 className="text-xl font-semibold mb-2">Simulation Result</h2>
      <div className="grid grid-cols-1 gap-2">
        {renderMetric("Initial Investment", result.initialInvestment)}
        {renderMetric("Final Value", result.finalValue)}
        {renderMetric("Gain / Loss", result.gainLoss)}
        {renderMetric("Gross Return", result.grossReturn)}
        {renderMetric("Net Return", result.netReturn)}
        {renderMetric("Dividends", result.dividends)}
        {renderMetric("Fees", result.fees)}
        {renderMetric("Estimated Taxes", result.estimatedTaxes)}
        {renderMetric("FX Impact", result.fxImpact)}
        {renderMetric("CAGR", result.cagr)}
        {renderMetric("XIRR", result.xirr)}
        {renderMetric("Volatility", result.volatility)}
        {renderMetric("Sharpe Ratio", result.sharpe)}
        {renderMetric("Max Drawdown", result.maxDrawdown)}
        {renderMetric("Benchmark Comparison", result.benchmarkComparison)}
        {renderMetric("Return Attribution", result.returnAttribution)}
      </div>
      {/* Assume result may contain a chart data array */}
      {result.chartData && Array.isArray(result.chartData) && (
        <div className="mt-4">
          {/* Placeholder for chart – in real app an ECharts component would be used */}
          <p className="text-sm text-gray-600">[Chart visualisation would appear here]</p>
        </div>
      )}
      {/* Assumptions & Methodology */}
      {result.assumptions && (
        <details className="mt-4">
          <summary className="cursor-pointer text-indigo-600 underline">Assumptions & Methodology</summary>
          <div className="mt-2 text-sm prose max-w-none" dangerouslySetInnerHTML={{ __html: result.assumptions }} />
        </details>
      )}
      {/* Freshness badge */}
      {result.freshness && (
        <div className="mt-2">
          <FreshnessBadge freshness={result.freshness} timestamp={result.timestamp} />
        </div>
      )}
      {/* Disclaimer */}
      <p className="mt-4 text-xs text-gray-600 italic">
        The information provided is for educational purposes only and does not constitute financial advice.
      </p>
    </section>
  );
};

export default LabResultView;

