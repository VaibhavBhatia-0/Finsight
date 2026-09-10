// src/pages/finance/ExpensesPage.tsx
import React from "react";
import { useExpenses } from "../../hooks/useExpenses";
import { Expense } from "../../hooks/useExpenses";

const ExpensesPage: React.FC = () => {
  const { data: expenses, isLoading, error } = useExpenses();

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600" role="alert">Error loading expenses</div>;

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Expenses</h1>
      {expenses && expenses.length > 0 ? (
        <ul className="list-disc pl-5">
          {expenses.map((e: Expense) => (
            <li key={e.id}>
              {e.category}: ${e.amount} on {e.date}
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
