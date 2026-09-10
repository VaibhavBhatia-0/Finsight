// src/pages/PortfolioListPage.tsx
import React from "react";
import { Link } from "react-router-dom";

const PortfolioListPage: React.FC = () => {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Portfolios</h1>
      <ul className="list-disc pl-5">
        <li>
          <Link to="/portfolios/1" className="text-indigo-600 hover:underline" aria-label="Open portfolio 1">
            Portfolio 1
          </Link>
        </li>
        <li>
          <Link to="/portfolios/2" className="text-indigo-600 hover:underline" aria-label="Open portfolio 2">
            Portfolio 2
          </Link>
        </li>
      </ul>
    </main>
  );
};

export default PortfolioListPage;
