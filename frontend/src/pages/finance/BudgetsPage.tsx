// src/pages/finance/BudgetsPage.tsx
import React, { FormEvent, useState } from "react";
import { useBudgets, Budget, useCreateBudget, useDeleteBudget } from "../../hooks/useBudgets";
import FinanceNav from "../../components/FinanceNav";

const BudgetsPage: React.FC = () => {
  const { data: budgets, isLoading, error } = useBudgets();
  const create = useCreateBudget();
  const remove = useDeleteBudget();
  const [showForm, setShowForm] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); await create.mutateAsync({ category: String(data.get('category')), amount: Number(data.get('amount')), startDate: String(data.get('startDate')), endDate: String(data.get('endDate')) }); event.currentTarget.reset(); setShowForm(false); };

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600">Error loading budgets</div>;

  return (
    <main>
      <header className="page-heading"><div><p className="page-eyebrow">Personal finance</p><h1>Budgets</h1><p className="page-subtitle">Set category limits across explicit periods and monitor spend against the ledger.</p></div><button onClick={() => setShowForm(current => !current)} className="btn-primary px-4 py-2">Add budget</button></header>
      <FinanceNav />
      {showForm && <form onSubmit={submit} className="mb-6 grid gap-3 rounded border p-4 sm:grid-cols-2"><input name="category" required maxLength={100} placeholder="Category" className="rounded border px-3 py-2" /><input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" className="rounded border px-3 py-2" /><label className="text-sm">Start date<input name="startDate" required type="date" className="mt-1 block w-full rounded border px-3 py-2" /></label><label className="text-sm">End date<input name="endDate" required type="date" className="mt-1 block w-full rounded border px-3 py-2" /></label><button disabled={create.isPending} className="rounded border px-4 py-2 sm:col-span-2">Save budget</button>{create.error && <p className="text-red-600 sm:col-span-2">{create.error.message}</p>}</form>}
      {budgets && budgets.length > 0 ? (
        <ul className="panel data-list">
          {budgets.map((b: Budget) => (
            <li key={b.id} className="data-row">
              <span><strong>{b.category}</strong><span className="ml-3 font-mono">{b.amount.toLocaleString()}</span><span className="ml-3 text-sm text-gray-500">{b.startDate} → {b.endDate}</span></span><button disabled={remove.isPending} onClick={() => remove.mutate(b.id)} className="text-sm text-red-600">Delete</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state"><p>No budgets defined.</p></div>
      )}
    </main>
  );
};

export default BudgetsPage;
