import { type FormEvent, useContext, useEffect, useRef, useState } from 'react';
import { ChevronDown, LogIn, LogOut, Moon, Search, Settings, Sun } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

interface NavItem { to: string; label: string }
interface NavGroup { label: string; match: string[]; items: NavItem[] }

const groups: NavGroup[] = [
  { label: 'Overview', match: ['/dashboard'], items: [{ to: '/dashboard', label: 'Dashboard' }] },
  {
    label: 'Invest',
    match: ['/markets', '/watchlist', '/portfolios', '/screener'],
    items: [
      { to: '/markets', label: 'Markets' },
      { to: '/markets/compare', label: 'Compare stocks' },
      { to: '/watchlist', label: 'Watchlist' },
      { to: '/portfolios', label: 'Portfolios' },
      { to: '/screener', label: 'Screener' },
    ],
  },
  {
    label: 'Lab',
    match: ['/lab'],
    items: [
      { to: '/lab', label: 'Lab overview' },
      { to: '/lab/single-investment', label: 'Single investment' },
      { to: '/lab/recurring-investment', label: 'Recurring / DCA' },
      { to: '/lab/portfolio-scenario', label: 'Portfolio scenario' },
    ],
  },
  {
    label: 'Money',
    match: ['/finance', '/planning'],
    items: [
      { to: '/finance', label: 'Budgets, expenses & goals' },
      { to: '/finance/transactions', label: 'Transactions' },
      { to: '/planning', label: 'Investment planning' },
    ],
  },
  {
    label: 'Analyze',
    match: ['/insights', '/backtesting', '/reports'],
    items: [
      { to: '/insights', label: 'Insights' },
      { to: '/backtesting', label: 'Backtesting' },
      { to: '/reports', label: 'Reports' },
    ],
  },
];

export default function AppHeader() {
  const { user, logout } = useAuth();
  const theme = useContext(ThemeContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const within = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const active = groups.find(group => group.match.some(within));
  // The longest matching path wins, so /markets/123 highlights Markets but /markets/compare highlights Compare.
  const activeItem = active?.items.filter(item => within(item.to)).sort((a, b) => b.to.length - a.to.length)[0];
  const initials = (user?.name ?? 'Guest').split(/\s+/).slice(0, 2).map(value => value[0]).join('').toUpperCase();

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/markets?q=${encodeURIComponent(query)}` : '/markets');
    setSearch('');
    setSearchOpen(false);
  };

  return (
    <header className="app-header" aria-label="Application header">
      <div className="header-row">
        <Link to="/dashboard" className="brand-lockup" aria-label="FinSight dashboard"><BrandLogo /></Link>

        <nav className="primary-nav pill-group" aria-label="Primary navigation">
          {groups.map(group => (
            <Link key={group.label} to={group.items[0].to} className={`pill${group === active ? ' active' : ''}`} aria-current={group === active ? 'page' : undefined}>
              {group.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <form className={`header-search${searchOpen ? ' open' : ''}`} onSubmit={submit} role="search">
            <input ref={searchInput} value={search} onChange={event => setSearch(event.target.value)} onBlur={() => { if (!search.trim()) setSearchOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); }} aria-label="Search stocks" placeholder="Search stocks and companies" tabIndex={searchOpen ? 0 : -1} />
            <button type={searchOpen ? 'submit' : 'button'} className="round-button" onClick={searchOpen ? undefined : () => setSearchOpen(true)} aria-label={searchOpen ? 'Search' : 'Open search'}><Search size={18} /></button>
          </form>
          <button type="button" className="round-button theme-toggle" onClick={theme?.toggleTheme} aria-label="Toggle theme">
            {theme?.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {user ? (
            <div className="user-menu" ref={menu}>
              <button type="button" className="user-chip" onClick={() => setMenuOpen(open => !open)} aria-expanded={menuOpen} aria-haspopup="menu">
                <span className="avatar-ring">{initials}</span>
                <span className="user-meta"><span className="user-name">{user.name}</span><span className="user-email">{user.email}</span></span>
                <ChevronDown size={15} aria-hidden />
              </button>
              {menuOpen && (
                <div className="user-dropdown" role="menu">
                  <Link to="/settings" role="menuitem"><Settings size={15} /> Settings</Link>
                  <button type="button" role="menuitem" onClick={logout}><LogOut size={15} /> Log out</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary sign-in-link"><LogIn size={15} /> Sign in</Link>
          )}
        </div>
      </div>

      {active && active.items.length > 1 && (
        <nav className="section-nav pill-group" aria-label={`${active.label} sections`}>
          {active.items.map(item => (
            <Link key={item.to} to={item.to} className={`pill${item === activeItem ? ' active' : ''}`} aria-current={item === activeItem ? 'page' : undefined}>{item.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
