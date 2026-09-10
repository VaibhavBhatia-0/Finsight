// src/pages/finance/BudgetsPage.tsx
import React from "react";
import { useBudgets, Budget } from "../../hooks/useBudgets";

const BudgetsPage: React.FC = () => {
  const { data: budgets, isLoading, error } = useBudgets();

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600">Error loading budgets</div>;

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Budgets</h1>
      {budgets && budgets.length > 0 ? (
        <ul className="list-disc pl-5">
          {budgets.map((b: Budget) => (
            <li key={b.id}>
              {b.category}: {b.amount} ({b.startDate} to {b.endDate})
            </li>
          ))}
        </ul>
      ) : (
        <p>No budgets defined.</p>
      )}
    </main>
  );
};

export default BudgetsPage;
