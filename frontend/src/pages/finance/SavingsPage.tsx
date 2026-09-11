// src/pages/finance/SavingsPage.tsx
import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import type { ApiId, FinanceSummary } from '../../api/contracts';
import { endpoints } from '../../api/endpoints';
import { Spinner } from '../../components/Spinner';
import { useAddGoalContribution } from '../../hooks/useGoals';

export default function SavingsPage() {
  const summary = useQuery({ queryKey: ['finance-summary'], queryFn: async () => (await api.get<FinanceSummary>(endpoints.finance.summary)).data });
  const addContribution = useAddGoalContribution();
  const [selectedGoal, setSelectedGoal] = useState<ApiId | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>, goalId: ApiId) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await addContribution.mutateAsync({ goalId, amount: Number(data.get('amount')), contributionDate: String(data.get('contributionDate')), notes: String(data.get('notes') || '') || undefined });
    form.reset();
    setSelectedGoal(null);
  };

  if (summary.isPending) return <Spinner />;
  if (summary.error) return <div className="p-4 text-red-600" role="alert">{summary.error.message}</div>;

  return <main className="mx-auto max-w-4xl p-4">
    <h1 className="mb-4 text-2xl font-bold">Savings contributions</h1>
    {summary.data!.goals.length ? <div className="space-y-4">{summary.data!.goals.map(goal => <article key={goal.id} className="rounded border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{goal.name}</h2><p>{summary.data!.currency} {goal.currentAmount.toLocaleString()} of {goal.targetAmount.toLocaleString()} · {goal.progressPercentage.toFixed(2)}%</p></div><button onClick={() => setSelectedGoal(current => current === goal.id ? null : goal.id)} className="rounded bg-gold-600 px-3 py-2 text-white">Add contribution</button></div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-gray-500">Observed monthly rate</dt><dd>{summary.data!.currency} {goal.monthlyContributionRate.toLocaleString()}</dd></div><div><dt className="text-gray-500">Projected completion</dt><dd>{goal.projectedCompletionDate ?? 'Needs contribution history'}</dd></div><div><dt className="text-gray-500">Required monthly amount</dt><dd>{goal.requiredMonthlyContribution == null ? 'Set a future target date' : `${summary.data!.currency} ${goal.requiredMonthlyContribution.toLocaleString()}`}</dd></div></dl>
      {selectedGoal === goal.id && <form onSubmit={event => { void submit(event, goal.id); }} className="mt-4 grid gap-2 sm:grid-cols-3"><input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" className="rounded border px-3 py-2" /><input name="contributionDate" required type="date" className="rounded border px-3 py-2" /><input name="notes" maxLength={1000} placeholder="Notes" className="rounded border px-3 py-2" /><button disabled={addContribution.isPending} className="rounded border px-3 py-2 sm:col-span-3">{addContribution.isPending ? 'Saving…' : 'Record contribution'}</button>{addContribution.error && <p className="text-red-600 sm:col-span-3">{addContribution.error.message}</p>}</form>}
    </article>)}</div> : <p>Create a goal before recording savings contributions.</p>}
  </main>;
}
