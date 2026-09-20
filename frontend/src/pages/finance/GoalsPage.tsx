// src/pages/finance/GoalsPage.tsx
import React, { FormEvent, useState } from "react";
import { useCreateGoal, useDeleteGoal, useGoals } from "../../hooks/useGoals";
import { Goal } from "../../hooks/useGoals";
import FinanceNav from "../../components/FinanceNav";

const GoalsPage: React.FC = () => {
  const { data: goals, isLoading, error } = useGoals();
  const create = useCreateGoal();
  const remove = useDeleteGoal();
  const [showForm, setShowForm] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); await create.mutateAsync({ name: String(data.get('name')), targetAmount: Number(data.get('targetAmount')), currentAmount: Number(data.get('currentAmount') || 0), targetDate: String(data.get('targetDate') || '') || null }); event.currentTarget.reset(); setShowForm(false); };

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600" role="alert">Error loading goals</div>;

  return (
    <main>
      <header className="page-heading"><div><p className="page-eyebrow">Personal finance</p><h1>Financial goals</h1><p className="page-subtitle">Define targets, deadlines, and starting balances before recording contributions.</p></div><button onClick={() => setShowForm(current => !current)} className="btn-primary px-4 py-2">Add goal</button></header>
      <FinanceNav />
      {showForm && <form onSubmit={submit} className="mb-6 grid gap-3 rounded border p-4 sm:grid-cols-2"><input name="name" required maxLength={150} placeholder="Goal name" className="rounded border px-3 py-2" /><input name="targetAmount" required type="number" min="0.01" step="0.01" placeholder="Target amount" className="rounded border px-3 py-2" /><input name="currentAmount" type="number" min="0" step="0.01" defaultValue="0" placeholder="Current amount" className="rounded border px-3 py-2" /><label className="text-sm">Target date<input name="targetDate" type="date" className="mt-1 block w-full rounded border px-3 py-2" /></label><button disabled={create.isPending} className="rounded border px-4 py-2 sm:col-span-2">Save goal</button>{create.error && <p className="text-red-600 sm:col-span-2">{create.error.message}</p>}</form>}
      {goals && goals.length > 0 ? (
        <ul className="panel data-list">
          {goals.map((g: Goal) => (
            <li key={g.id} className="data-row">
              <span className="min-w-0 flex-1"><strong>{g.name}</strong><span className="ml-3 font-mono">{g.currentAmount.toLocaleString()} / {g.targetAmount.toLocaleString()}</span>{g.targetDate && <span className="ml-3 text-sm text-gray-500">Target {g.targetDate}</span>}<span className="goal-track mt-2"><span style={{ width: `${Math.min(100, g.targetAmount ? g.currentAmount / g.targetAmount * 100 : 0)}%` }} /></span></span><button disabled={remove.isPending} onClick={() => remove.mutate(g.id)} className="text-sm text-red-600">Delete</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state"><p>No goals defined.</p></div>
      )}
    </main>
  );
};

export default GoalsPage;
