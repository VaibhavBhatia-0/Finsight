// src/pages/lab/LabIndexPage.tsx
import React from "react";
import { Link } from "react-router-dom";

const LabIndexPage: React.FC = () => {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">FinSight Lab</h1>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <Link to="/lab/single-investment" className="text-indigo-600 hover:underline" aria-label="Single Investment Lab">
            Single Investment
          </Link>
        </li>
        <li>
          <Link to="/lab/recurring-investment" className="text-indigo-600 hover:underline" aria-label="Recurring Investment Lab">
            Recurring Investment
          </Link>
        </li>
        <li>
          <Link to="/lab/portfolio-scenario" className="text-indigo-600 hover:underline" aria-label="Portfolio Scenario Lab">
            Portfolio Scenario
          </Link>
        </li>
        <li>
          <Link to="/lab/compare" className="text-indigo-600 hover:underline" aria-label="Compare Scenarios Lab">
            Compare Scenarios
          </Link>
        </li>
        <li>
          <Link to="/lab/backtest" className="text-indigo-600 hover:underline" aria-label="Backtest Lab">
            Backtest
          </Link>
        </li>
      </ul>
    </main>
  );
};

export default LabIndexPage;
