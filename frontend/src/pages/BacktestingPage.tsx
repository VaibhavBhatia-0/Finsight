// src/pages/BacktestingPage.tsx
import React from "react";
import { useBacktests } from "../hooks/useBacktest";

const BacktestingPage: React.FC = () => {
  const { data, isLoading, error } = useBacktests();

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600" role="alert">Error loading backtest data</div>;

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Backtesting</h1>
      {data?.length ? <div className="overflow-x-auto"><table className="min-w-full"><thead><tr><th className="text-left">Created</th><th className="text-left">Strategy</th><th className="text-right">Invested</th><th className="text-right">Final value</th><th className="text-right">Return</th></tr></thead><tbody>{data.map(backtest => <tr key={backtest.id} className="border-t"><td className="py-2">{new Date(backtest.createdAt).toLocaleDateString()}</td><td>{backtest.details.strategyType}</td><td className="text-right">{backtest.summary.totalInvested.toLocaleString()}</td><td className="text-right">{backtest.summary.finalValue.toLocaleString()}</td><td className="text-right">{backtest.summary.returnPercentage.toFixed(2)}%</td></tr>)}</tbody></table></div> : <p>No backtests have been run.</p>}
    </main>
  );
};

export default BacktestingPage;
