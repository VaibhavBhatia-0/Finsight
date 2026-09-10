// src/pages/finance/GoalsPage.tsx
import React from "react";
import { useGoals } from "../../hooks/useGoals";
import { Goal } from "../../hooks/useGoals";

const GoalsPage: React.FC = () => {
  const { data: goals, isLoading, error } = useGoals();

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading…</div>;
  if (error) return <div className="text-red-600" role="alert">Error loading goals</div>;

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Financial Goals</h1>
      {goals && goals.length > 0 ? (
        <ul className="list-disc pl-5">
          {goals.map((g: Goal) => (
            <li key={g.id}>
              {g.description ?? "Goal"}: {g.currentAmount}/{g.targetAmount} (target {g.targetDate})
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
