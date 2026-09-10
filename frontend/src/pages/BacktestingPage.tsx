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
      <pre className="bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
};

export default BacktestingPage;
