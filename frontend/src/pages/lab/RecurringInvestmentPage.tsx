import { useState } from 'react';
import { Loader2, Repeat2 } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import StockSearchInput from '../../components/StockSearchInput';
import { useRunScenario, useSaveScenario, type ScenarioRequest } from '../../hooks/useScenario';
import LabResultView from './LabResultView';

interface FormValues { asset: string; amount: number; frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'; growthRate: number; startDate: string; endDate: string; currency: string; benchmark?: string; taxJurisdiction?: 'IN' | 'US' }

export default function RecurringInvestmentPage() {
  const { register, handleSubmit, reset, control } = useForm<FormValues>({ defaultValues: { asset: '', currency: 'INR', frequency: 'MONTHLY', growthRate: 0 } });
  const runScenario = useRunScenario(); const saveScenario = useSaveScenario();
  const [lastRequest, setLastRequest] = useState<ScenarioRequest | null>(null);
  const submit: SubmitHandler<FormValues> = async data => {
    const request: ScenarioRequest = { scenarioType: 'RECURRING_INVESTMENT', symbol: data.asset, initialAmount: data.amount, contributionFrequency: data.frequency, contributionGrowthRate: data.growthRate / 100, startDate: data.startDate, endDate: data.endDate, baseCurrency: data.currency, benchmarkCode: data.benchmark, taxJurisdiction: data.taxJurisdiction || undefined };
    await runScenario.mutateAsync(request); setLastRequest(request);
  };
  return <main className="scenario-page">
    <header className="page-heading"><div><p className="page-eyebrow">FinSight Lab · Scenario engine</p><h1>Recurring investment</h1><p className="page-subtitle">Model DCA contributions as individual dated cash flows with a dedicated recurring execution path.</p></div><Repeat2 size={30} className="text-gold-400" /></header>
    <form onSubmit={handleSubmit(submit)} className="panel scenario-form space-y-4"><div className="panel-header"><div><h2 className="panel-title">Contribution schedule</h2><p className="panel-subtitle">Each occurrence is retained for XIRR</p></div><span className="freshness-badge">Provider history</span></div>
      <Controller name="asset" control={control} rules={{ required: true }} render={({ field }) => <StockSearchInput label="Asset" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />} />
      <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Start date<input type="date" {...register('startDate', { required: true })} className="mt-1 w-full px-3 py-2" /></label><label className="block text-sm font-medium">End date<input type="date" {...register('endDate', { required: true })} className="mt-1 w-full px-3 py-2" /></label></div>
      <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Contribution amount<input type="number" min="0.01" step="0.01" {...register('amount', { required: true, min: 0.01, valueAsNumber: true })} className="mt-1 w-full px-3 py-2" /></label><label className="block text-sm font-medium">Frequency<select {...register('frequency')} className="mt-1 w-full px-3 py-2"><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUALLY">Annually</option></select></label></div>
      <label className="block text-sm font-medium">Annual contribution growth (%)<input type="number" min="0" max="1000" step="0.01" {...register('growthRate', { min: 0, max: 1000, valueAsNumber: true })} className="mt-1 w-full px-3 py-2" /></label>
      <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Base currency<select {...register('currency')} className="mt-1 w-full px-3 py-2"><option>INR</option><option>USD</option></select></label><label className="block text-sm font-medium">Tax residency<select {...register('taxJurisdiction')} className="mt-1 w-full px-3 py-2"><option value="">No tax estimate</option><option value="IN">India</option><option value="US">United States</option></select></label></div>
      <label className="block text-sm font-medium">Benchmark symbol<input {...register('benchmark')} className="mt-1 w-full px-3 py-2" placeholder="Optional" /></label>
      <div className="flex gap-2"><button type="submit" disabled={runScenario.isPending} className="btn-primary px-4 py-2">{runScenario.isPending ? <span className="flex items-center"><Loader2 className="mr-2 animate-spin" size={16} />Running…</span> : 'Run recurring scenario'}</button><button type="button" onClick={() => { reset(); runScenario.reset(); saveScenario.reset(); setLastRequest(null); }} className="btn-secondary px-4 py-2">Reset</button></div>
    </form>
    <LabResultView result={runScenario.data ?? null} isError={runScenario.isError} error={runScenario.error ?? undefined} />
    {lastRequest && runScenario.data && <div className="mt-3"><button type="button" disabled={saveScenario.isPending || saveScenario.isSuccess} onClick={() => saveScenario.mutate({ ...lastRequest, name: `${lastRequest.symbol} recurring investment` })} className="btn-secondary px-4 py-2">{saveScenario.isSuccess ? 'Scenario saved' : saveScenario.isPending ? 'Saving…' : 'Save scenario'}</button>{saveScenario.error && <p className="error-banner mt-2" role="alert">{saveScenario.error.message}</p>}</div>}
  </main>;
}
