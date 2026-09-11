import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { useRunScenario, useSaveScenario, type ScenarioRequest } from '../../hooks/useScenario';
import LabResultView from './LabResultView';

interface FormValues {
  firstSymbol: string;
  firstWeight: number;
  secondSymbol: string;
  secondWeight: number;
  amount: number;
  startDate: string;
  endDate: string;
  currency: string;
  taxJurisdiction?: 'IN' | 'US';
}

export default function PortfolioScenarioPage() {
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { currency: 'INR', firstWeight: 50, secondWeight: 50 },
  });
  const runScenario = useRunScenario();
  const saveScenario = useSaveScenario();
  const [lastRequest, setLastRequest] = useState<ScenarioRequest | null>(null);
  const submit: SubmitHandler<FormValues> = async (data) => {
    const request: ScenarioRequest = {
      scenarioType: 'PORTFOLIO_SCENARIO',
      assets: [
        { symbol: data.firstSymbol, weight: data.firstWeight / 100 },
        { symbol: data.secondSymbol, weight: data.secondWeight / 100 },
      ],
      initialAmount: data.amount,
      startDate: data.startDate,
      endDate: data.endDate,
      baseCurrency: data.currency,
      taxJurisdiction: data.taxJurisdiction || undefined,
    };
    await runScenario.mutateAsync(request);
    setLastRequest(request);
  };

  return <section className="mx-auto max-w-2xl p-4">
    <h1 className="mb-4 text-2xl font-bold">Portfolio Scenario Lab</h1>
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <label className="block text-sm font-medium">First asset<input {...register('firstSymbol', { required: true })} className="mt-1 w-full rounded border px-3 py-2" placeholder="AAPL" /></label>
        <label className="block text-sm font-medium">Weight %<input type="number" min="0.01" max="99.99" step="0.01" {...register('firstWeight', { required: true, valueAsNumber: true })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="block text-sm font-medium">Second asset<input {...register('secondSymbol', { required: true })} className="mt-1 w-full rounded border px-3 py-2" placeholder="MSFT" /></label>
        <label className="block text-sm font-medium">Weight %<input type="number" min="0.01" max="99.99" step="0.01" {...register('secondWeight', { required: true, valueAsNumber: true })} className="mt-1 w-full rounded border px-3 py-2" /></label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">Start date<input type="date" {...register('startDate', { required: true })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="block text-sm font-medium">End date<input type="date" {...register('endDate', { required: true })} className="mt-1 w-full rounded border px-3 py-2" /></label>
      </div>
      <label className="block text-sm font-medium">Investment amount<input type="number" min="0.01" step="0.01" {...register('amount', { required: true, min: 0.01, valueAsNumber: true })} className="mt-1 w-full rounded border px-3 py-2" /></label>
      <label className="block text-sm font-medium">Base currency<select {...register('currency')} className="mt-1 w-full rounded border px-3 py-2"><option>INR</option><option>USD</option></select></label>
      <label className="block text-sm font-medium">Tax residency for educational estimate<select {...register('taxJurisdiction')} className="mt-1 w-full rounded border px-3 py-2"><option value="">No tax estimate</option><option value="IN">India</option><option value="US">United States</option></select></label>
      <div className="flex gap-2"><button type="submit" disabled={runScenario.isPending} className="rounded bg-gold-600 px-4 py-2 text-white disabled:opacity-50">{runScenario.isPending ? <span className="flex items-center"><Loader2 className="mr-2 animate-spin" />Running…</span> : 'Run portfolio scenario'}</button><button type="button" onClick={() => { reset(); runScenario.reset(); saveScenario.reset(); setLastRequest(null); }} className="rounded bg-gray-200 px-4 py-2">Reset</button></div>
    </form>
    <LabResultView result={runScenario.data ?? null} isError={runScenario.isError} error={runScenario.error ?? undefined} />
    {lastRequest && runScenario.data && <div className="mt-3"><button type="button" disabled={saveScenario.isPending || saveScenario.isSuccess} onClick={() => saveScenario.mutate({ ...lastRequest, name: 'Portfolio scenario' })} className="rounded border border-gold-600 px-4 py-2 text-gold-700 disabled:opacity-50">{saveScenario.isSuccess ? 'Scenario saved' : saveScenario.isPending ? 'Saving…' : 'Save scenario'}</button>{saveScenario.error && <p className="mt-2 text-red-600" role="alert">{saveScenario.error.message}</p>}</div>}
  </section>;
}
