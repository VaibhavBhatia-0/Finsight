import { useForm, type SubmitHandler } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { useRunScenario } from '../../hooks/useScenario';
import LabResultView from './LabResultView';

interface FormValues { asset: string; amount: number; startDate: string; endDate: string; currency: string; benchmark?: string }

export default function SingleInvestmentPage() {
  const form = useForm<FormValues>({ defaultValues: { currency: 'INR' } });
  const runScenario = useRunScenario();
  const submit: SubmitHandler<FormValues> = async (data) => {
    await runScenario.mutateAsync({ scenarioType: 'SINGLE_INVESTMENT', symbol: data.asset, initialAmount: data.amount, startDate: data.startDate, endDate: data.endDate, baseCurrency: data.currency, benchmarkCode: data.benchmark });
  };
  return <ScenarioForm title="Single Investment Lab" submitLabel="Run simulation" form={form} onSubmit={submit} pending={runScenario.isPending} onReset={runScenario.reset}><LabResultView result={runScenario.data ?? null} isError={runScenario.isError} error={runScenario.error ?? undefined} /></ScenarioForm>;
}

interface ScenarioFormProps {
  title: string;
  submitLabel: string;
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: SubmitHandler<FormValues>;
  pending: boolean;
  onReset: () => void;
  children: React.ReactNode;
}

export function ScenarioForm({ title, submitLabel, form, onSubmit, pending, onReset, children }: ScenarioFormProps) {
  const { register, handleSubmit, reset } = form;
  return <section className="mx-auto max-w-2xl p-4"><h1 className="mb-4 text-2xl font-bold">{title}</h1><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><label className="block text-sm font-medium">Asset symbol<input {...register('asset', { required: true })} className="mt-1 w-full rounded border px-3 py-2" placeholder="AAPL" /></label><div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Start date<input type="date" {...register('startDate', { required: true })} className="mt-1 w-full rounded border px-3 py-2" /></label><label className="block text-sm font-medium">End date<input type="date" {...register('endDate', { required: true })} className="mt-1 w-full rounded border px-3 py-2" /></label></div><label className="block text-sm font-medium">Investment amount<input type="number" min="0.01" step="0.01" {...register('amount', { required: true, min: 0.01, valueAsNumber: true })} className="mt-1 w-full rounded border px-3 py-2" /></label><label className="block text-sm font-medium">Base currency<select {...register('currency', { required: true })} className="mt-1 w-full rounded border px-3 py-2"><option>INR</option><option>USD</option></select></label><label className="block text-sm font-medium">Benchmark symbol<input {...register('benchmark')} className="mt-1 w-full rounded border px-3 py-2" /></label><div className="flex gap-2"><button type="submit" disabled={pending} className="rounded bg-gold-600 px-4 py-2 text-white disabled:opacity-50">{pending ? <span className="flex items-center"><Loader2 className="mr-2 animate-spin" />Running…</span> : submitLabel}</button><button type="button" onClick={() => { reset(); onReset(); }} className="rounded bg-gray-200 px-4 py-2">Reset</button></div></form>{children}</section>;
}
