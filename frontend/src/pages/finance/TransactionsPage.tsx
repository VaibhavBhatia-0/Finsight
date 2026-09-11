import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../../components/Spinner';
import { useUserPreferences } from '../../context/UserPreferencesContext';
import { useCreateFinanceTransaction, useCreateRecurringRule, useDeactivateRecurringRule, useDeleteFinanceTransaction, useFinanceTransactions, useRecurringRules } from '../../hooks/useFinanceTransactions';

export default function FinanceTransactionsPage() {
  const transactions = useFinanceTransactions();
  const rules = useRecurringRules();
  const createTransaction = useCreateFinanceTransaction();
  const createRule = useCreateRecurringRule();
  const deleteTransaction = useDeleteFinanceTransaction();
  const deactivateRule = useDeactivateRecurringRule();
  const { preferences } = useUserPreferences();
  const [recurring, setRecurring] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const common = {
      transactionType: String(data.get('transactionType')) as 'INCOME' | 'EXPENSE' | 'TRANSFER',
      category: String(data.get('category')),
      amount: Number(data.get('amount')),
      currency: String(data.get('currency')).toUpperCase(),
      description: String(data.get('description') || '') || undefined,
      notes: String(data.get('notes') || '') || undefined,
    };
    if (recurring) {
      await createRule.mutateAsync({ ...common, startDate: String(data.get('date')), endDate: String(data.get('endDate') || '') || undefined, frequency: String(data.get('frequency')) as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' });
    } else {
      await createTransaction.mutateAsync({ ...common, transactionDate: String(data.get('date')) });
    }
    form.reset();
    setRecurring(false);
  };

  if (transactions.isPending || rules.isPending) return <Spinner />;
  const error = transactions.error || rules.error;
  if (error) return <p className="p-4 text-red-600">{error.message}</p>;

  return <main className="mx-auto max-w-5xl p-4">
    <h1 className="text-2xl font-bold">Finance transactions</h1>
    <FinanceNav />
    <form onSubmit={submit} className="my-6 grid gap-3 rounded border p-4 sm:grid-cols-2">
      <select name="transactionType" aria-label="Transaction type" className="rounded border px-3 py-2"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option><option value="TRANSFER">Transfer</option></select>
      <input name="category" required maxLength={100} placeholder="Category" className="rounded border px-3 py-2" />
      <input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" className="rounded border px-3 py-2" />
      <input name="currency" required pattern="[A-Z]{3}" defaultValue={preferences.defaultCurrency} aria-label="Currency" className="rounded border px-3 py-2" />
      <label className="text-sm">{recurring ? 'Start date' : 'Transaction date'}<input name="date" required type="date" className="mt-1 block w-full rounded border px-3 py-2" /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={recurring} onChange={event => setRecurring(event.target.checked)} />Recurring rule</label>
      {recurring && <><select name="frequency" aria-label="Frequency" className="rounded border px-3 py-2"><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUALLY">Annually</option></select><label className="text-sm">End date (optional)<input name="endDate" type="date" className="mt-1 block w-full rounded border px-3 py-2" /></label></>}
      <input name="description" maxLength={500} placeholder="Description" className="rounded border px-3 py-2" />
      <input name="notes" maxLength={1000} placeholder="Notes" className="rounded border px-3 py-2" />
      <button disabled={createTransaction.isPending || createRule.isPending} className="rounded bg-gold-600 px-4 py-2 text-white sm:col-span-2">{createTransaction.isPending || createRule.isPending ? 'Saving…' : recurring ? 'Create recurring rule' : 'Add transaction'}</button>
      {(createTransaction.error || createRule.error) && <p className="text-red-600 sm:col-span-2">{(createTransaction.error || createRule.error)?.message}</p>}
    </form>
    <section className="mb-8"><h2 className="mb-3 text-xl font-semibold">Recurring rules</h2>{rules.data?.length ? <div className="space-y-2">{rules.data.map(rule => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><span>{rule.transaction_type} · {rule.category} · {rule.currency} {Number(rule.amount).toLocaleString()} · {rule.frequency} · {rule.active ? 'Active' : 'Inactive'}</span>{rule.active && <button onClick={() => deactivateRule.mutate(rule.id)} disabled={deactivateRule.isPending} className="text-sm text-red-600">Stop</button>}</div>)}</div> : <p>No recurring rules.</p>}</section>
    <section><h2 className="mb-3 text-xl font-semibold">Ledger</h2>{transactions.data?.length ? <div className="overflow-x-auto"><table className="min-w-full"><thead><tr><th className="text-left">Date</th><th className="text-left">Type</th><th className="text-left">Category</th><th className="text-right">Amount</th><th className="text-left">Source</th><th></th></tr></thead><tbody>{transactions.data.map(item => <tr key={item.id} className="border-t"><td className="py-2">{item.transaction_date.slice(0, 10)}</td><td>{item.transaction_type}</td><td>{item.category}</td><td className="text-right">{item.currency} {Number(item.amount).toLocaleString()}</td><td>{item.recurring_rule_id ? 'Recurring rule' : 'Manual'}</td><td className="text-right"><button onClick={() => deleteTransaction.mutate(item.id)} disabled={deleteTransaction.isPending} className="text-sm text-red-600">Delete</button></td></tr>)}</tbody></table></div> : <p>No transactions recorded.</p>}</section>
  </main>;
}

function FinanceNav() {
  return <nav className="mt-3 flex flex-wrap gap-3 text-sm"><Link to="/finance/transactions">Transactions</Link><Link to="/finance/expenses">Expenses</Link><Link to="/finance/budgets">Budgets</Link><Link to="/finance/savings">Savings</Link><Link to="/finance/goals">Goals</Link></nav>;
}
