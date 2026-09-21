import { useState, type ReactNode } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { Controller, useForm, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import StockSearchInput from '../../components/StockSearchInput';
import { useRunScenario, useSaveScenario, type ScenarioRequest } from '../../hooks/useScenario';
import LabResultView from './LabResultView';

interface FormValues { asset: string; amount: number; startDate: string; endDate: string; currency: string; benchmark?: string; taxJurisdiction?: 'IN' | 'US' }

export default function SingleInvestmentPage() {
  const form = useForm<FormValues>({ defaultValues: { currency: 'INR' } });
  const runScenario = useRunScenario();
  const saveScenario = useSaveScenario();
  const [lastRequest, setLastRequest] = useState<ScenarioRequest | null>(null);
  const submit: SubmitHandler<FormValues> = async data => {
    const request: ScenarioRequest = { scenarioType: 'SINGLE_INVESTMENT', symbol: data.asset, initialAmount: data.amount, startDate: data.startDate, endDate: data.endDate, baseCurrency: data.currency, benchmarkCode: data.benchmark, taxJurisdiction: data.taxJurisdiction || undefined };
    await runScenario.mutateAsync(request); setLastRequest(request);
  };
  return <ScenarioForm title="Single investment" subtitle="Replay one historical lump-sum investment with explicit FX, fees, dividends, and optional tax context." submitLabel="Run simulation" form={form} onSubmit={submit} pending={runScenario.isPending} onReset={() => { runScenario.reset(); saveScenario.reset(); setLastRequest(null); }}>
    <LabResultView result={runScenario.data ?? null} isError={runScenario.isError} error={runScenario.error ?? undefined} />
    {lastRequest && runScenario.data && <SaveScenarioButton request={{ ...lastRequest, name: `${lastRequest.symbol} single investment` }} pending={saveScenario.isPending} saved={saveScenario.isSuccess} error={saveScenario.error} onSave={saveScenario.mutate} />}
  </ScenarioForm>;
}

interface ScenarioFormProps { title: string; subtitle: string; submitLabel: string; form: UseFormReturn<FormValues>; onSubmit: SubmitHandler<FormValues>; pending: boolean; onReset: () => void; children: ReactNode }

export function ScenarioForm({ title, subtitle, submitLabel, form, onSubmit, pending, onReset, children }: ScenarioFormProps) {
  const { register, handleSubmit, reset, control } = form;
  return <main className="scenario-page">
    <header className="page-heading"><div><p className="page-eyebrow">FinSight Lab · Scenario engine</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div><Landmark size={30} className="text-gold-400" /></header>
    <form onSubmit={handleSubmit(onSubmit)} className="panel scenario-form space-y-4">
      <div className="panel-header"><div><h2 className="panel-title">Scenario configuration</h2><p className="panel-subtitle">Historical what-if inputs</p></div><span className="freshness-badge">Provider history</span></div>
      <Controller name="asset" control={control} rules={{ required: true }} render={({ field }) => <StockSearchInput label="Asset" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />} />
      <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Start date<input type="date" {...register('startDate', { required: true })} className="mt-1 w-full px-3 py-2" /></label><label className="block text-sm font-medium">End date<input type="date" {...register('endDate', { required: true })} className="mt-1 w-full px-3 py-2" /></label></div>
      <label className="block text-sm font-medium">Investment amount<input type="number" min="0.01" step="0.01" {...register('amount', { required: true, min: 0.01, valueAsNumber: true })} className="mt-1 w-full px-3 py-2" /></label>
      <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Base currency<select {...register('currency', { required: true })} className="mt-1 w-full px-3 py-2"><option>INR</option><option>USD</option></select></label><label className="block text-sm font-medium">Tax residency<select {...register('taxJurisdiction')} className="mt-1 w-full px-3 py-2"><option value="">No tax estimate</option><option value="IN">India</option><option value="US">United States</option></select></label></div>
      <label className="block text-sm font-medium">Benchmark symbol<input {...register('benchmark')} className="mt-1 w-full px-3 py-2" placeholder="Optional" /></label>
      <div className="flex gap-2"><button type="submit" disabled={pending} className="btn-primary px-4 py-2">{pending ? <span className="flex items-center"><Loader2 className="mr-2 animate-spin" size={16} />Running…</span> : submitLabel}</button><button type="button" onClick={() => { reset(); onReset(); }} className="btn-secondary px-4 py-2">Reset</button></div>
    </form>{children}
  </main>;
}

function SaveScenarioButton({ request, pending, saved, error, onSave }: { request: ScenarioRequest; pending: boolean; saved: boolean; error: Error | null; onSave: (request: ScenarioRequest) => void }) {
  return <div className="mt-3"><button type="button" disabled={pending || saved} onClick={() => onSave(request)} className="btn-secondary px-4 py-2">{saved ? 'Scenario saved' : pending ? 'Saving…' : 'Save scenario'}</button>{error && <p className="error-banner mt-2" role="alert">{error.message}</p>}</div>;
}
