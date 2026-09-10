// src/pages/DashboardPage.tsx
import React from "react";
import { useUserPreferences } from "../context/UserPreferencesContext";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

// Placeholder data fetching hooks (should be replaced with real hooks)
const usePortfolioSummary = () => ({ data: { totalValue: 123456, change: 2.5 }, isLoading: false, isError: false });
const useMarketIndices = () => ({ data: [{ name: "S&P 500", value: 4500 }], isLoading: false, isError: false });
const useWatchlist = () => ({ data: [{ symbol: "AAPL", price: 150 }], isLoading: false, isError: false });

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => {
  const { setVisibility, preferences } = useUserPreferences();
  const visible = preferences.visible[id];

  if (!visible) return null;

  return (
    <section className="mb-8" data-section-id={id}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          onClick={() => setVisibility(id, false)}
          className="text-sm text-gray-500 hover:text-gray-700"
          aria-label={`Hide ${title}`}
        >
          Hide
        </button>
      </div>
      {children}
    </section>
  );
};

const DashboardPage: React.FC = () => {
  const { preferences, setOrder, setVisibility } = useUserPreferences();
  const navigate = useNavigate();

  const summary = usePortfolioSummary();
  const indices = useMarketIndices();
  const watchlist = useWatchlist();

  const handleAddSection = (sectionId: string) => {
    setVisibility(sectionId, true);
  };

  // Simple order rendering based on preferences.order
  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case "summary":
        return (
          <Section id="summary" title="Portfolio Summary">
            {summary.isLoading ? (
              <div className="flex items-center"><Loader2 className="mr-2 animate-spin"/>Loading...</div>
            ) : summary.isError ? (
              <p className="text-red-600">Failed to load summary</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>Total Value: ${summary.data.totalValue.toLocaleString()}</div>
                <div>Change: {summary.data.change}%</div>
              </div>
            )}
          </Section>
        );
      case "indices":
        return (
          <Section id="indices" title="Market Indices">
            {indices.isLoading ? (
              <div className="flex items-center"><Loader2 className="mr-2 animate-spin"/>Loading...</div>
            ) : indices.isError ? (
              <p className="text-red-600">Failed to load indices</p>
            ) : (
              <ul className="space-y-1">
                {indices.data.map((i) => (
                  <li key={i.name} className="flex justify-between">
                    <span>{i.name}</span>
                    <span>{i.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        );
      case "watchlist":
        return (
          <Section id="watchlist" title="Watchlist Snapshot">
            {watchlist.isLoading ? (
              <div className="flex items-center"><Loader2 className="mr-2 animate-spin"/>Loading...</div>
            ) : watchlist.isError ? (
              <p className="text-red-600">Failed to load watchlist</p>
            ) : (
              <ul className="space-y-1">
                {watchlist.data.map((w) => (
                  <li key={w.symbol} className="flex justify-between cursor-pointer" onClick={() => navigate(`/markets/${w.symbol}`)}>
                    <span>{w.symbol}</span>
                    <span>${w.price}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        );
      case "labLaunch":
        return (
          <Section id="labLaunch" title="FinSight Lab Quick Launch">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => navigate("/lab/single-investment")} className="p-4 border rounded hover:bg-gray-50">Single Investment</button>
              <button onClick={() => navigate("/lab/recurring-investment")} className="p-4 border rounded hover:bg-gray-50">Recurring Investment</button>
              <button onClick={() => navigate("/lab/portfolio-scenario")} className="p-4 border rounded hover:bg-gray-50">Portfolio Scenario</button>
              <button onClick={() => navigate("/lab/compare")} className="p-4 border rounded hover:bg-gray-50">Compare Scenarios</button>
              <button onClick={() => navigate("/lab/backtest")} className="p-4 border rounded hover:bg-gray-50">Backtest Lab</button>
            </div>
          </Section>
        );
      default:
        return null;
    }
  };

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* Render sections in stored order */}
      {preferences.order.map(renderSection)}

      {/* Show add-section buttons for hidden sections */}
      <div className="mt-4">
        <h2 className="text-lg font-medium mb-2">Add Sections</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(preferences.visible)
            .filter(([, v]) => !v)
            .map(([id]) => (
              <button
                key={id}
                onClick={() => handleAddSection(id)}
                className="px-3 py-1 bg-champagne-600 text-white rounded hover:bg-champagne-700"
              >
                Show {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;
