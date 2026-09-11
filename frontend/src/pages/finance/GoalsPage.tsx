// src/pages/finance/GoalsPage.tsx
import React, { FormEvent, useState } from "react";
import { useCreateGoal, useDeleteGoal, useGoals } from "../../hooks/useGoals";
import { Goal } from "../../hooks/useGoals";

const GoalsPage: React.FC = () => {
  const { data: goals, isLoading, error } = useGoals();
  const create = useCreateGoal();
  const remove = useDeleteGoal();
  const [showForm, setShowForm] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); await create.mutateAsync({ name: String(data.get('name')), targetAmount: Number(data.get('targetAmount')), currentAmount: Number(data.get('currentAmount') || 0), targetDate: String(data.get('targetDate') || '') || null }); event.currentTarget.reset(); setShowForm(false); };

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600" role="alert">Error loading goals</div>;

  return (
    <main className="p-4">
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-bold">Financial Goals</h1><button onClick={() => setShowForm(current => !current)} className="rounded bg-gold-600 px-4 py-2 text-white">Add goal</button></div>
      {showForm && <form onSubmit={submit} className="mb-6 grid gap-3 rounded border p-4 sm:grid-cols-2"><input name="name" required maxLength={150} placeholder="Goal name" className="rounded border px-3 py-2" /><input name="targetAmount" required type="number" min="0.01" step="0.01" placeholder="Target amount" className="rounded border px-3 py-2" /><input name="currentAmount" type="number" min="0" step="0.01" defaultValue="0" placeholder="Current amount" className="rounded border px-3 py-2" /><label className="text-sm">Target date<input name="targetDate" type="date" className="mt-1 block w-full rounded border px-3 py-2" /></label><button disabled={create.isPending} className="rounded border px-4 py-2 sm:col-span-2">Save goal</button>{create.error && <p className="text-red-600 sm:col-span-2">{create.error.message}</p>}</form>}
      {goals && goals.length > 0 ? (
        <ul className="list-disc pl-5">
          {goals.map((g: Goal) => (
            <li key={g.id} className="flex items-center justify-between py-2">
              <span>{g.name}: {g.currentAmount.toLocaleString()}/{g.targetAmount.toLocaleString()}{g.targetDate ? ` (target ${g.targetDate})` : ''}</span><button disabled={remove.isPending} onClick={() => remove.mutate(g.id)} className="text-sm text-red-600">Delete</button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No goals defined.</p>
      )}
    </main>
  );
};

export default GoalsPage;
