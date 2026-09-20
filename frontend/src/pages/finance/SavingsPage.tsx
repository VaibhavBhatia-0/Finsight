// src/pages/finance/SavingsPage.tsx
import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import type { ApiId, FinanceSummary } from '../../api/contracts';
import { endpoints } from '../../api/endpoints';
import { Spinner } from '../../components/Spinner';
import { useAddGoalContribution } from '../../hooks/useGoals';
import FinanceNav from '../../components/FinanceNav';

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

  return <main>
    <header className="page-heading"><div><p className="page-eyebrow">Personal finance</p><h1>Savings contributions</h1><p className="page-subtitle">Record goal deposits and compare observed contribution pace with the required monthly amount.</p></div></header>
    <FinanceNav />
    {summary.data!.goals.length ? <div className="savings-grid">{summary.data!.goals.map(goal => <article key={goal.id} className="rounded border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{goal.name}</h2><p>{summary.data!.currency} {goal.currentAmount.toLocaleString()} of {goal.targetAmount.toLocaleString()} · {goal.progressPercentage.toFixed(2)}%</p></div><button onClick={() => setSelectedGoal(current => current === goal.id ? null : goal.id)} className="rounded bg-gold-600 px-3 py-2 text-white">Add contribution</button></div>
      <span className="goal-track mt-4"><span style={{ width: `${Math.min(100, goal.progressPercentage)}%` }} /></span><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div className="mini-stat"><dt>Observed monthly rate</dt><dd>{summary.data!.currency} {goal.monthlyContributionRate.toLocaleString()}</dd></div><div className="mini-stat"><dt>Projected completion</dt><dd>{goal.projectedCompletionDate ?? 'Needs contribution history'}</dd></div><div className="mini-stat"><dt>Required monthly amount</dt><dd>{goal.requiredMonthlyContribution == null ? 'Set a future target date' : `${summary.data!.currency} ${goal.requiredMonthlyContribution.toLocaleString()}`}</dd></div></dl>
      {selectedGoal === goal.id && <form onSubmit={event => { void submit(event, goal.id); }} className="mt-4 grid gap-2 sm:grid-cols-3"><input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" className="rounded border px-3 py-2" /><input name="contributionDate" required type="date" className="rounded border px-3 py-2" /><input name="notes" maxLength={1000} placeholder="Notes" className="rounded border px-3 py-2" /><button disabled={addContribution.isPending} className="rounded border px-3 py-2 sm:col-span-3">{addContribution.isPending ? 'Saving…' : 'Record contribution'}</button>{addContribution.error && <p className="text-red-600 sm:col-span-3">{addContribution.error.message}</p>}</form>}
    </article>)}</div> : <div className="empty-state"><p>Create a goal before recording savings contributions.</p></div>}
  </main>;
}
