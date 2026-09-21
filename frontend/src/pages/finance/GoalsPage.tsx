// src/pages/finance/GoalsPage.tsx
import React, { FormEvent, useState } from "react";
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from "../../hooks/useGoals";
import { Goal } from "../../hooks/useGoals";
import FinanceNav from "../../components/FinanceNav";
import { usePortfolios } from "../../hooks/usePortfolios";
import { Link } from "react-router-dom";

const GoalsPage: React.FC = () => {
  const { data: goals, isLoading, error } = useGoals();
  const create = useCreateGoal();
  const remove = useDeleteGoal();
  const update = useUpdateGoal();
  const portfolios = usePortfolios();
  const [showForm, setShowForm] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await create.mutateAsync({ name: String(data.get('name')), targetAmount: Number(data.get('targetAmount')), currentAmount: Number(data.get('currentAmount') || 0), targetDate: String(data.get('targetDate') || '') || null, baseCurrency: String(data.get('baseCurrency')), portfolioId: data.get('portfolioId') ? String(data.get('portfolioId')) : null, status: 'ACTIVE' });
    form.reset();
    setShowForm(false);
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600" role="alert">Error loading goals</div>;

  return (
    <main>
      <header className="page-heading"><div><p className="page-eyebrow">Plan</p><h1>Financial goals</h1><p className="page-subtitle">Define target amounts, deadlines, currencies, and optional portfolio links.</p></div><div className="flex gap-2"><Link to="/planning" className="btn-secondary px-4 py-2">Planning calculators</Link><button onClick={() => setShowForm(current => !current)} className="btn-primary px-4 py-2">Add goal</button></div></header>
      <FinanceNav />
      {showForm && <form onSubmit={submit} className="panel mb-6 grid gap-3 sm:grid-cols-2"><label className="text-sm">Goal name<input name="name" required maxLength={150} placeholder="Emergency fund" className="mt-1 w-full px-3 py-2" /></label><label className="text-sm">Target amount<input name="targetAmount" required type="number" min="0.01" step="0.01" className="mt-1 w-full px-3 py-2" /></label><label className="text-sm">Current amount<input name="currentAmount" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 w-full px-3 py-2" /></label><label className="text-sm">Target date<input name="targetDate" type="date" className="mt-1 block w-full px-3 py-2" /></label><label className="text-sm">Base currency<select name="baseCurrency" defaultValue="INR" className="mt-1 w-full px-3 py-2"><option>INR</option><option>USD</option></select></label><label className="text-sm">Linked portfolio · optional<select name="portfolioId" className="mt-1 w-full px-3 py-2"><option value="">None</option>{portfolios.data?.map(item => <option key={item.portfolio.id} value={item.portfolio.id}>{item.portfolio.name}</option>)}</select></label><button disabled={create.isPending} className="btn-primary px-4 py-2 sm:col-span-2">Save goal</button>{create.error && <p className="error-banner sm:col-span-2">{create.error.message}</p>}</form>}
      {goals && goals.length > 0 ? (
        <ul className="panel data-list">
          {goals.map((g: Goal) => (
            <li key={g.id} className="data-row">
              <span className="min-w-0 flex-1"><strong>{g.name}</strong><span className="ml-3 font-mono">{g.baseCurrency} {g.currentAmount.toLocaleString()} / {g.targetAmount.toLocaleString()}</span>{g.targetDate && <span className="ml-3 text-sm text-gray-500">Target {g.targetDate}</span>}{g.portfolioId && <Link to={`/portfolios/${g.portfolioId}`} className="ml-3 text-sm text-gold-300">Linked portfolio</Link>}<span className="goal-track mt-2"><span style={{ width: `${Math.min(100, g.targetAmount ? g.currentAmount / g.targetAmount * 100 : 0)}%` }} /></span><span className="mt-2 flex flex-wrap items-center gap-3"><label className="text-xs text-gray-500">Status <select aria-label={`Status for ${g.name}`} value={g.status} disabled={update.isPending} onChange={event => update.mutate({ ...g, status: event.target.value as Goal['status'] })} className="ml-1 px-2 py-1 text-sm"><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="COMPLETED">Completed</option></select></label><Link to="/finance/savings" className="text-sm text-gold-300">Record contribution</Link></span></span><button disabled={remove.isPending} onClick={() => remove.mutate(g.id)} className="text-sm text-red-600">Delete</button>
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
