// src/pages/WatchlistDetailPage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";

const WatchlistDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Watchlist Detail</h1>
      <p>Details for watchlist item <strong>{id}</strong>.</p>
      <Link to="/watchlist" className="text-indigo-600 hover:underline" aria-label="Back to watchlist">
        Back to Watchlist
      </Link>
    </main>
  );
};

export default WatchlistDetailPage;
