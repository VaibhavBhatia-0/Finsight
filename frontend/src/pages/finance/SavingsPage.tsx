// src/pages/finance/SavingsPage.tsx
import React from "react";
import { useSavings } from "../../hooks/useSavings";
import { SavingsGoal } from "../../hooks/useSavings";

const SavingsPage: React.FC = () => {
  const { data: goals, isLoading, error } = useSavings();

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600" role="alert">Error loading savings goals</div>;

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Savings</h1>
      {goals && goals.length > 0 ? (
        <ul className="list-disc pl-5">
          {goals.map((g: SavingsGoal) => (
            <li key={g.id}>
              {g.description ?? "Saving"}: {g.currentAmount}/{g.targetAmount} (target {g.targetDate})
            </li>
          ))}
        </ul>
      ) : (
        <p>No savings goals defined.</p>
      )}
    </main>
  );
};

export default SavingsPage;
