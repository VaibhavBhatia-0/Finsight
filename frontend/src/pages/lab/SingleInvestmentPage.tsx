import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useRunBacktest, useBacktest } from "../../hooks/useBacktest";
import LabResultView from "./LabResultView";
import { Loader2 } from "lucide-react";

interface FormValues {
  asset: string;
  amount: number;
  startDate: string;
  endDate: string;
  currency?: string;
  benchmark?: string;
}

const SingleInvestmentPage: React.FC = () => {
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const runBacktest = useRunBacktest();
  const [backtestId, setBacktestId] = React.useState<string | null>(null);
  const { data: result, isLoading, isError, error } = useBacktest(backtestId ?? "", !!backtestId);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    const payload = {
      scenarioType: "SINGLE_INVESTMENT",
      asset: data.asset,
      amount: data.amount,
      startDate: data.startDate,
      endDate: data.endDate,
      currency: data.currency,
      benchmark: data.benchmark,
    };
    const created = await runBacktest.mutateAsync(payload);
    setBacktestId(created.id);
  };

  const handleReset = () => {
    reset();
    setBacktestId(null);
  };

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Single Investment Lab</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="asset">Asset Symbol</label>
          <input id="asset" {...register("asset", { required: true })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500" placeholder="e.g., AAPL" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="startDate">Start Date</label>
            <input id="startDate" type="date" {...register("startDate", { required: true })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="endDate">End Date</label>
            <input id="endDate" type="date" {...register("endDate", { required: true })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="amount">Investment Amount</label>
          <input id="amount" type="number" step="0.01" {...register("amount", { required: true, valueAsNumber: true })} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500" placeholder="e.g., 10000" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="currency">Currency (optional)</label>
          <input id="currency" {...register("currency")} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500" placeholder="e.g., USD" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="benchmark">Benchmark (optional)</label>
          <input id="benchmark" {...register("benchmark")} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-champagne-500" placeholder="e.g., S&P 500" />
        </div>
        <div className="flex space-x-2">
          <button type="submit" disabled={runBacktest.isLoading} className="px-4 py-2 bg-champagne-600 text-white rounded hover:bg-champagne-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-champagne-500">
            {runBacktest.isLoading ? (<span className="flex items-center"><Loader2 className="animate-spin mr-2"/>Running...</span>) : "Run Simulation"}
          </button>
          <button type="button" onClick={handleReset} className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">Reset</button>
        </div>
      </form>
      {backtestId && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Result</h2>
          <LabResultView result={result} isLoading={isLoading} isError={isError} error={error} />
        </section>
      )}
    </main>
  );
};

export default SingleInvestmentPage;
