// src/pages/WatchlistPage.tsx
import React from "react";
import { Link } from "react-router-dom";

const WatchlistPage: React.FC = () => {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Watchlist</h1>
      <p className="mb-2">Your watchlist items will appear here.</p>
      <Link to="/watchlist/detail/1" className="text-indigo-600 hover:underline" aria-label="View watchlist detail">
        View Sample Detail
      </Link>
    </main>
  );
};

export default WatchlistPage;
