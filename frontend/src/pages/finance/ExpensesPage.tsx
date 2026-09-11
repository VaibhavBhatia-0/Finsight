// src/pages/finance/ExpensesPage.tsx
import React, { FormEvent, useState } from "react";
import { useCreateExpense, useDeleteExpense, useExpenses } from "../../hooks/useExpenses";
import { Expense } from "../../hooks/useExpenses";
import { useUserPreferences } from "../../context/UserPreferencesContext";

const ExpensesPage: React.FC = () => {
  const { data: expenses, isLoading, error } = useExpenses();
  const create = useCreateExpense();
  const remove = useDeleteExpense();
  const { preferences } = useUserPreferences();
  const [showForm, setShowForm] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await create.mutateAsync({ amount: Number(data.get('amount')), category: String(data.get('category')), date: String(data.get('date')), description: String(data.get('description') || '') || undefined, currency: String(data.get('currency')) });
    event.currentTarget.reset();
    setShowForm(false);
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600" role="alert">Error loading expenses</div>;

  return (
    <main className="p-4">
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-bold">Expenses</h1><button onClick={() => setShowForm(current => !current)} className="rounded bg-gold-600 px-4 py-2 text-white">Add expense</button></div>
      {showForm && <form onSubmit={submit} className="mb-6 grid gap-3 rounded border p-4 sm:grid-cols-2"><input name="category" required maxLength={100} placeholder="Category" className="rounded border px-3 py-2" /><input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" className="rounded border px-3 py-2" /><input name="date" required type="date" className="rounded border px-3 py-2" /><input name="currency" required pattern="[A-Z]{3}" defaultValue={preferences.defaultCurrency} className="rounded border px-3 py-2" /><input name="description" maxLength={500} placeholder="Description" className="rounded border px-3 py-2 sm:col-span-2" /><button disabled={create.isPending} className="rounded border px-4 py-2 sm:col-span-2">{create.isPending ? 'Saving…' : 'Save expense'}</button>{create.error && <p className="text-red-600 sm:col-span-2" role="alert">{create.error.message}</p>}</form>}
      {expenses && expenses.length > 0 ? (
        <ul className="list-disc pl-5">
          {expenses.map((e: Expense) => (
            <li key={e.id} className="flex items-center justify-between py-2">
              <span>{e.category}: {e.currency} {e.amount.toLocaleString()} on {e.date}</span><button disabled={remove.isPending} onClick={() => remove.mutate(e.id)} className="text-sm text-red-600">Delete</button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No expenses recorded.</p>
      )}
    </main>
  );
};

export default ExpensesPage;
