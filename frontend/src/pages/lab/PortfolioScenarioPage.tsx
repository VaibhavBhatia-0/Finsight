import { useState } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import StockSearchInput from '../../components/StockSearchInput';
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
  const { register, handleSubmit, reset, control, setError, formState: { errors } } = useForm<FormValues>({
    defaultValues: { currency: 'INR', firstSymbol: '', secondSymbol: '', firstWeight: 50, secondWeight: 50 },
  });
  const runScenario = useRunScenario();
  const saveScenario = useSaveScenario();
  const [lastRequest, setLastRequest] = useState<ScenarioRequest | null>(null);
  const submit: SubmitHandler<FormValues> = async (data) => {
    if (Math.abs(data.firstWeight + data.secondWeight - 100) > 0.001) {
      setError('secondWeight', { message: 'Portfolio weights must total 100%.' });
      return;
    }
    if (data.firstSymbol === data.secondSymbol) {
      setError('secondSymbol', { message: 'Choose two different assets.' });
      return;
    }
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

  return <main className="scenario-page">
    <header className="page-heading"><div><p className="page-eyebrow">FinSight Lab · Scenario engine</p><h1>Portfolio scenario</h1><p className="page-subtitle">Explore a weighted multi-asset allocation with attribution that reconciles to total performance.</p></div></header>
    <form onSubmit={handleSubmit(submit)} className="panel scenario-form space-y-4">
      <div className="panel-header"><div><h2 className="panel-title">Allocation and assumptions</h2><p className="panel-subtitle">Weights must form one complete portfolio</p></div><span className="freshness-badge">Synthetic history</span></div>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Controller name="firstSymbol" control={control} rules={{ required: true }} render={({ field }) => <StockSearchInput label="First asset" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />} />
        <label className="block text-sm font-medium">Weight %<input type="number" min="0.01" max="99.99" step="0.01" {...register('firstWeight', { required: true, valueAsNumber: true })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <Controller name="secondSymbol" control={control} rules={{ required: true }} render={({ field }) => <StockSearchInput label="Second asset" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />} />
        <label className="block text-sm font-medium">Weight %<input type="number" min="0.01" max="99.99" step="0.01" {...register('secondWeight', { required: true, valueAsNumber: true })} className="mt-1 w-full rounded border px-3 py-2" /></label>
      </div>
      {(errors.firstSymbol || errors.secondSymbol || errors.secondWeight) && <p className="error-banner text-sm" role="alert">{errors.secondSymbol?.message ?? errors.secondWeight?.message ?? 'Select both assets from the catalogue.'}</p>}
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
  </main>;
}
