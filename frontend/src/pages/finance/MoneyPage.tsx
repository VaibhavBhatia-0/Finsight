import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import type { FinanceSummary } from '../../api/contracts';
import { endpoints } from '../../api/endpoints';
import { Spinner } from '../../components/Spinner';
import { useUserPreferences } from '../../context/UserPreferencesContext';
import { useCreateBudget, useDeleteBudget } from '../../hooks/useBudgets';
import { useCreateExpense, useDeleteExpense, useExpenses } from '../../hooks/useExpenses';
import { type Goal, useAddGoalContribution, useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from '../../hooks/useGoals';
import { usePortfolios } from '../../hooks/usePortfolios';

/** Budgets, expenses, goals and savings contributions on one page, driven by the finance summary. */
export default function MoneyPage() {
  const summary = useQuery({ queryKey: ['finance-summary'], queryFn: async () => (await api.get<FinanceSummary>(endpoints.finance.summary)).data });
  if (summary.isPending) return <Spinner />;
  if (summary.error) return <p className="error-banner" role="alert">{summary.error.message}</p>;
  const data = summary.data;
  const categories = [...new Set([...data.budgets.map(item => item.category), ...Object.keys(data.categoryBreakdown)])].sort();

  return <main>
    <header className="page-heading"><div><p className="page-eyebrow">Personal finance</p><h1>Money</h1><p className="page-subtitle">Track spending against budgets and put savings toward goals in one place.</p></div><Link to="/finance/transactions" className="btn-secondary px-4 py-2">Full ledger</Link></header>
    <dl className="intelligence-summary panel mb-4">
      <Stat label="Income" value={money(data.overview.totalIncome, data.currency)} />
      <Stat label="Expenses" value={money(data.overview.totalExpense, data.currency)} />
      <Stat label="Net savings" value={money(data.overview.netSavings, data.currency)} />
      <Stat label="Savings rate" value={`${data.overview.savingsRate.toFixed(1)}%`} />
    </dl>
    <datalist id="finance-categories">{categories.map(item => <option key={item} value={item} />)}</datalist>
    <div className="content-grid mb-4">
      <BudgetsPanel budgets={data.budgets} currency={data.currency} />
      <ExpensesPanel />
    </div>
    <GoalsPanel goals={data.goals} currency={data.currency} />
  </main>;
}

function BudgetsPanel({ budgets, currency }: { budgets: FinanceSummary['budgets']; currency: string }) {
  const create = useCreateBudget();
  const remove = useDeleteBudget();
  const [open, setOpen] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await create.mutateAsync({ category: String(data.get('category')).trim(), amount: Number(data.get('amount')), startDate: String(data.get('startDate')), endDate: String(data.get('endDate')) });
    form.reset();
    setOpen(false);
  };
  return <section className="panel">
    <div className="panel-header"><div><h2 className="panel-title">Budgets</h2><p className="panel-subtitle">Spending in each category against its limit</p></div><button type="button" onClick={() => setOpen(current => !current)} className="btn-primary px-3 py-2">{open ? 'Cancel' : 'Add budget'}</button></div>
    {open && <form onSubmit={submit} className="mb-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Category<input name="category" list="finance-categories" required maxLength={100} className="mt-1 w-full px-3 py-2" /></label>
      <label className="text-sm">Limit<input name="amount" required type="number" min="0.01" step="0.01" className="mt-1 w-full px-3 py-2" /></label>
      <label className="text-sm">Start date<input name="startDate" required type="date" defaultValue={monthStart()} className="mt-1 block w-full px-3 py-2" /></label>
      <label className="text-sm">End date<input name="endDate" required type="date" defaultValue={monthEnd()} className="mt-1 block w-full px-3 py-2" /></label>
      <button type="submit" disabled={create.isPending} className="btn-primary px-4 py-2 sm:col-span-2">{create.isPending ? 'Saving…' : 'Save budget'}</button>
      {create.error && <p className="error-banner sm:col-span-2" role="alert">{create.error.message}</p>}
    </form>}
    {budgets.length ? <ul className="data-list">{budgets.map(item => <li key={item.id} className="data-row">
      <span className="min-w-0 flex-1">
        <strong>{item.category}</strong><span className="ml-3 text-sm text-gray-500">{item.startDate.slice(0, 10)} → {item.endDate.slice(0, 10)}</span>
        <span className="goal-track mt-2"><span style={{ width: `${Math.min(100, item.spentPercentage)}%`, ...(item.isExceeded ? { background: 'var(--danger, #dc2626)' } : {}) }} /></span>
        <span className={`mt-1 block text-sm ${item.isExceeded ? 'text-red-600' : 'text-gray-500'}`}>{money(item.spentAmount, currency)} of {money(item.budgetAmount, currency)} · {item.isExceeded ? `${money(-item.remainingAmount, currency)} over` : `${money(item.remainingAmount, currency)} left`}</span>
      </span>
      <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(item.id)} className="text-sm text-red-600">Delete</button>
    </li>)}</ul> : <div className="empty-state"><p>No budgets yet. Add one to track spending against a limit.</p></div>}
  </section>;
}

function ExpensesPanel() {
  const expenses = useExpenses();
  const create = useCreateExpense();
  const remove = useDeleteExpense();
  const { preferences } = useUserPreferences();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await create.mutateAsync({ amount: Number(data.get('amount')), category: String(data.get('category')).trim(), date: String(data.get('date')), description: String(data.get('description') || '') || undefined, currency: String(data.get('currency')).toUpperCase() });
    form.reset();
  };
  const recent = expenses.data?.slice(0, 8) ?? [];
  return <section className="panel">
    <div className="panel-header"><div><h2 className="panel-title">Expenses</h2><p className="panel-subtitle">Use a budget's category so it counts toward that budget</p></div></div>
    <form onSubmit={submit} className="mb-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Category<input name="category" list="finance-categories" required maxLength={100} className="mt-1 w-full px-3 py-2" /></label>
      <label className="text-sm">Amount<input name="amount" required type="number" min="0.01" step="0.01" className="mt-1 w-full px-3 py-2" /></label>
      <label className="text-sm">Date<input name="date" required type="date" defaultValue={localToday()} className="mt-1 block w-full px-3 py-2" /></label>
      <label className="text-sm">Currency<input name="currency" required pattern="[A-Za-z]{3}" defaultValue={preferences.defaultCurrency} className="mt-1 w-full px-3 py-2" /></label>
      <label className="text-sm sm:col-span-2">Description · optional<input name="description" maxLength={500} className="mt-1 w-full px-3 py-2" /></label>
      <button type="submit" disabled={create.isPending} className="btn-primary px-4 py-2 sm:col-span-2">{create.isPending ? 'Saving…' : 'Add expense'}</button>
      {create.error && <p className="error-banner sm:col-span-2" role="alert">{create.error.message}</p>}
    </form>
    {expenses.isPending ? <Spinner /> : expenses.error ? <p className="error-banner" role="alert">{expenses.error.message}</p> : recent.length ? <ul className="data-list">{recent.map(item => <li key={item.id} className="data-row">
      <span><strong>{item.category}</strong><span className="ml-3 font-mono">{item.currency} {item.amount.toLocaleString()}</span><span className="ml-3 text-sm text-gray-500">{item.date}</span></span>
      <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(item.id)} className="text-sm text-red-600">Delete</button>
    </li>)}</ul> : <div className="empty-state"><p>No expenses recorded.</p></div>}
  </section>;
}

function GoalsPanel({ goals, currency }: { goals: FinanceSummary['goals']; currency: string }) {
  const goalRows = useGoals();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const remove = useDeleteGoal();
  const contribute = useAddGoalContribution();
  const portfolios = usePortfolios();
  const [open, setOpen] = useState(false);
  const [contributingTo, setContributingTo] = useState<string | null>(null);
  const byId = new Map((goalRows.data ?? []).map(goal => [String(goal.id), goal]));

  const submitGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await create.mutateAsync({ name: String(data.get('name')).trim(), targetAmount: Number(data.get('targetAmount')), currentAmount: Number(data.get('currentAmount') || 0), targetDate: String(data.get('targetDate') || '') || null, baseCurrency: String(data.get('baseCurrency')), portfolioId: data.get('portfolioId') ? String(data.get('portfolioId')) : null, status: 'ACTIVE' });
    form.reset();
    setOpen(false);
  };
  const submitContribution = async (event: FormEvent<HTMLFormElement>, goalId: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await contribute.mutateAsync({ goalId, amount: Number(data.get('amount')), contributionDate: String(data.get('contributionDate')), notes: String(data.get('notes') || '') || undefined });
    form.reset();
    setContributingTo(null);
  };

  return <section className="panel">
    <div className="panel-header"><div><h2 className="panel-title">Goals &amp; savings</h2><p className="panel-subtitle">Progress, required pace and contributions for each goal</p></div><div className="flex gap-2"><Link to="/planning" className="btn-secondary px-3 py-2">Planning calculators</Link><button type="button" onClick={() => setOpen(current => !current)} className="btn-primary px-3 py-2">{open ? 'Cancel' : 'Add goal'}</button></div></div>
    {open && <form onSubmit={submitGoal} className="mb-4 grid gap-3 sm:grid-cols-3">
      <label className="text-sm">Goal name<input name="name" required maxLength={150} placeholder="Emergency fund" className="mt-1 w-full px-3 py-2" /></label>
      <label className="text-sm">Target amount<input name="targetAmount" required type="number" min="0.01" step="0.01" className="mt-1 w-full px-3 py-2" /></label>
      <label className="text-sm">Saved so far<input name="currentAmount" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 w-full px-3 py-2" /></label>
      <label className="text-sm">Target date · optional<input name="targetDate" type="date" className="mt-1 block w-full px-3 py-2" /></label>
      <label className="text-sm">Currency<select name="baseCurrency" defaultValue={currency} className="mt-1 w-full px-3 py-2"><option>INR</option><option>USD</option></select></label>
      <label className="text-sm">Linked portfolio · optional<select name="portfolioId" className="mt-1 w-full px-3 py-2"><option value="">None</option>{portfolios.data?.map(item => <option key={item.portfolio.id} value={item.portfolio.id}>{item.portfolio.name}</option>)}</select></label>
      <button type="submit" disabled={create.isPending} className="btn-primary px-4 py-2 sm:col-span-3">{create.isPending ? 'Saving…' : 'Save goal'}</button>
      {create.error && <p className="error-banner sm:col-span-3" role="alert">{create.error.message}</p>}
    </form>}
    {goals.length ? <div className="savings-grid">{goals.map(goal => {
      const row = byId.get(String(goal.id));
      return <article key={goal.id} className="rounded border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold">{goal.name}</h3><p className="font-mono text-sm">{currency} {goal.currentAmount.toLocaleString()} of {goal.targetAmount.toLocaleString()} · {goal.progressPercentage.toFixed(1)}%</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {row && <select aria-label={`Status for ${goal.name}`} value={row.status} disabled={update.isPending} onChange={event => update.mutate({ ...row, status: event.target.value as Goal['status'] })} className="px-2 py-1 text-sm"><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="COMPLETED">Completed</option></select>}
            <button type="button" onClick={() => setContributingTo(current => current === String(goal.id) ? null : String(goal.id))} className="btn-primary px-3 py-1 text-sm">Add savings</button>
            <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(goal.id)} className="text-sm text-red-600">Delete</button>
          </div>
        </div>
        <span className="goal-track mt-3"><span style={{ width: `${Math.min(100, goal.progressPercentage)}%` }} /></span>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="mini-stat"><dt>Saving per month</dt><dd>{currency} {goal.monthlyContributionRate.toLocaleString()}</dd></div>
          <div className="mini-stat"><dt>Needed per month</dt><dd>{goal.requiredMonthlyContribution == null ? 'Set a target date' : `${currency} ${goal.requiredMonthlyContribution.toLocaleString()}`}</dd></div>
          <div className="mini-stat"><dt>On track to finish</dt><dd>{goal.projectedCompletionDate ?? 'Needs savings history'}</dd></div>
        </dl>
        {goal.linkedPortfolioId && <Link to={`/portfolios/${goal.linkedPortfolioId}`} className="mt-2 inline-block text-sm text-gold-300">Linked portfolio</Link>}
        {contributingTo === String(goal.id) && <form onSubmit={event => { void submitContribution(event, String(goal.id)); }} className="mt-3 grid gap-2 sm:grid-cols-3">
          <input name="amount" aria-label="Amount" required type="number" min="0.01" step="0.01" placeholder="Amount" className="px-3 py-2" />
          <input name="contributionDate" aria-label="Date" required type="date" defaultValue={localToday()} className="px-3 py-2" />
          <input name="notes" aria-label="Notes" maxLength={1000} placeholder="Notes · optional" className="px-3 py-2" />
          <button type="submit" disabled={contribute.isPending} className="btn-primary px-3 py-2 sm:col-span-3">{contribute.isPending ? 'Saving…' : 'Record savings'}</button>
          {contribute.error && <p className="error-banner sm:col-span-3" role="alert">{contribute.error.message}</p>}
        </form>}
      </article>;
    })}</div> : <div className="empty-state"><p>No goals yet. Add one to start tracking savings.</p></div>}
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function money(value: number, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
function localToday() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function monthStart() { return `${localToday().slice(0, 7)}-01`; }
function monthEnd() { const now = new Date(); const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); return `${localToday().slice(0, 7)}-${String(last).padStart(2, '0')}`; }
