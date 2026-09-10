// src/pages/PortfolioDetailPage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";

const PortfolioDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Portfolio Detail</h1>
      <p>Details for portfolio <strong>{id}</strong>.</p>
      <Link to="/portfolios" className="text-indigo-600 hover:underline" aria-label="Back to portfolios list">
        Back to Portfolios
      </Link>
    </main>
  );
};

export default PortfolioDetailPage;
