import { type FormEvent, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';
import type { MarketOverview } from '../api/contracts';
import { endpoints } from '../api/endpoints';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const routeLabels: Array<[RegExp, string, string]> = [
  [/^\/dashboard/, 'Overview', 'Dashboard'],
  [/^\/markets\/compare/, 'Invest', 'Compare securities'],
  [/^\/markets\//, 'Invest', 'Stock detail'],
  [/^\/markets/, 'Invest', 'Markets'],
  [/^\/watchlist/, 'Invest', 'Watchlist'],
  [/^\/portfolios\/compare/, 'Invest', 'Compare portfolios'],
  [/^\/portfolios\//, 'Invest', 'Portfolio detail'],
  [/^\/portfolios/, 'Invest', 'Portfolios'],
  [/^\/screener/, 'Invest', 'Stock screener'],
  [/^\/lab\/single/, 'FinSight Lab', 'Single investment'],
  [/^\/lab\/recurring/, 'FinSight Lab', 'Recurring / DCA'],
  [/^\/lab\/portfolio/, 'FinSight Lab', 'Portfolio scenario'],
  [/^\/lab\/compare/, 'FinSight Lab', 'Compare scenarios'],
  [/^\/lab\/backtest/, 'FinSight Lab', 'Backtest strategy'],
  [/^\/lab/, 'FinSight Lab', 'Workspace'],
  [/^\/finance/, 'Personal finance', 'Money management'],
  [/^\/insights/, 'Analyze', 'Insights'],
  [/^\/backtesting/, 'Analyze', 'Backtesting'],
  [/^\/reports/, 'Analyze', 'Reports'],
  [/^\/settings/, 'System', 'Settings'],
];

export default function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const theme = useContext(ThemeContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const markets = useQuery({
    queryKey: ['markets-overview'],
    queryFn: async () => (await api.get<MarketOverview>(endpoints.markets.overview)).data,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const context = useMemo(() => routeLabels.find(([pattern]) => pattern.test(location.pathname)) ?? ['' as never, 'FinSight', 'Workspace'], [location.pathname]);
  const initials = (user?.name ?? 'Guest').split(/\s+/).slice(0, 2).map(value => value[0]).join('').toUpperCase();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/markets?q=${encodeURIComponent(query)}` : '/markets');
  };

  return (
    <header className="topbar-shell" aria-label="Application header">
      <div className="market-tape" aria-label="Market overview">
        <span className="tape-status"><span className="status-dot" />Market overview · provider feed</span>
        {markets.data?.indices.slice(0, 6).map(index => (
          <span className="tape-item" key={index.code}>
            <span className="tape-symbol">{index.name}</span>
            <span className="tape-price">{index.price.toLocaleString()}</span>
            <span className={movementClass(index.changePercent)}>{formatChange(index.changePercent)}</span>
          </span>
        ))}
        {markets.isError && <span className="tape-item movement-down">Market feed unavailable</span>}
      </div>

      <div className="topbar-main">
        <div className="topbar-context">
          <button className="topbar-icon mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={18} /></button>
          <div><p className="context-kicker">{context[1]}</p><p className="context-title">{context[2]}</p></div>
        </div>

        <form className="global-search" onSubmit={submit} role="search">
          <Search aria-hidden />
          <input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search stocks" placeholder="Search stocks and companies" />
          <span className="search-key">↵</span>
        </form>

        <div className="topbar-actions">
          <button className="topbar-icon theme-toggle" onClick={theme?.toggleTheme} aria-label="Toggle theme">
            {theme?.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div className="user-chip">
            <span className="avatar-ring">{initials}</span>
            <div className="user-meta"><p className="user-name">{user?.name ?? 'Explore markets'}</p><p className="user-role">{user ? 'Personal workspace' : 'Public access'}</p></div>
          </div>
          {user && <button className="topbar-icon" onClick={logout} aria-label="Log out"><LogOut size={16} /></button>}
        </div>
      </div>
    </header>
  );
}

function movementClass(value: number | null) { return value == null ? '' : value >= 0 ? 'movement-up' : 'movement-down'; }
function formatChange(value: number | null) { return value == null ? 'N/A' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
