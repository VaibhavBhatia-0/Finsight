// src/pages/lab/LabBacktestPage.tsx
import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useRunBacktest, useBacktest } from "../../hooks/useBacktest";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import LabResultView from "./LabResultView";


interface FormValues {
  portfolioId: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  amount: number;
}

const LabBacktestPage: React.FC = () => {
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const queryClient = useQueryClient();
  const runBacktest = useRunBacktest();
  const [backtestId, setBacktestId] = React.useState<string | null>(null);
  const { data: result, isLoading, isError, error } = useBacktest(backtestId ?? "", !!backtestId);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    const payload = {
      portfolioId: data.portfolioId,
      startDate: data.startDate,
      endDate: data.endDate,
      amount: data.amount,
    };
    const created = await runBacktest.mutateAsync(payload);
    setBacktestId(created.id);
    // Invalidate any stale backtest list
    queryClient.invalidateQueries(["backtests"]);
  };

  const handleReset = () => {
    reset();
    setBacktestId(null);
  };

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Backtest Lab</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="portfolioId">
            Portfolio ID
          </label>
          <input
            id="portfolioId"
            {...register("portfolioId", { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500"
            placeholder="Enter portfolio identifier"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="startDate">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              {...register("startDate", { required: true })}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="endDate">
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              {...register("endDate", { required: true })}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="amount">
            Investment Amount
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            {...register("amount", { required: true, valueAsNumber: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500"
            placeholder="e.g., 10000"
          />
        </div>
        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={runBacktest.isLoading}
            className="px-4 py-2 bg-champagne-600 text-white rounded hover:bg-champagne-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-champagne-500"
          >
            {runBacktest.isLoading ? (
              <span className="flex items-center"><Loader2 className="animate-spin mr-2"/>Running...</span>
            ) : (
              "Run Backtest"
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Result section */}
      {backtestId && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Backtest Result</h2>
          {isLoading && (
            <div className="flex items-center text-champagne-600">
              <Loader2 className="mr-2 animate-spin" /> Loading result...
            </div>
          )}
          {isError && (
            <p className="text-red-600">Error loading result: {error?.message}</p>
          )}
          {result && (
          <LabResultView result={result} isLoading={isLoading} isError={isError} error={error} />
        )}
        </section>
      )}
    </main>
  );
};

export default LabBacktestPage;
