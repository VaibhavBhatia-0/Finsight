import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, BriefcaseBusiness, ChartNoAxesCombined, FileDown, FlaskConical,
  Gauge, Landmark, LineChart, ListChecks, ReceiptText, Repeat2, SearchCode,
  Settings, Sparkles, Star, Target, WalletCards,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const groups: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: Gauge }] },
  {
    label: 'Invest',
    items: [
      { to: '/markets', label: 'Markets', icon: LineChart, end: true },
      { to: '/watchlist', label: 'Watchlist', icon: Star },
      { to: '/portfolios', label: 'Portfolios', icon: BriefcaseBusiness },
      { to: '/screener', label: 'Stock screener', icon: SearchCode },
    ],
  },
  {
    label: 'FinSight Lab',
    items: [
      { to: '/lab', label: 'Lab overview', icon: FlaskConical, end: true },
      { to: '/lab/single-investment', label: 'Single investment', icon: Landmark },
      { to: '/lab/recurring-investment', label: 'Recurring / DCA', icon: Repeat2 },
      { to: '/lab/portfolio-scenario', label: 'Portfolio scenario', icon: BarChart3 },
    ],
  },
  {
    label: 'Plan',
    items: [
      { to: '/planning', label: 'Investment planning', icon: Target },
      { to: '/finance/goals', label: 'Goals', icon: Sparkles },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance/transactions', label: 'Transactions', icon: WalletCards },
      { to: '/finance/expenses', label: 'Expenses', icon: ReceiptText },
      { to: '/finance/budgets', label: 'Budgets', icon: ListChecks },
      { to: '/finance/savings', label: 'Savings', icon: Sparkles },
    ],
  },
  {
    label: 'Analyze',
    items: [
      { to: '/insights', label: 'Insights', icon: Sparkles },
      { to: '/backtesting', label: 'Backtesting', icon: ChartNoAxesCombined },
      { to: '/reports', label: 'Reports', icon: FileDown },
    ],
  },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="sidebar-shell" aria-label="Primary navigation">
      <NavLink to="/dashboard" className="brand-lockup" onClick={onNavigate}>
        <BrandLogo variant="lockup" />
      </NavLink>

      {groups.map((group, groupIndex) => (
        <section className="nav-section" key={group.label} aria-label={group.label}>
          <p className="nav-section-label"><span>{String(groupIndex + 1).padStart(2, '0')}</span>{group.label}</p>
          <div className="nav-stack">
            {group.items.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <item.icon aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </section>
      ))}

      <div className="sidebar-foot">
        <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <Settings aria-hidden />
          <span>Settings</span>
        </NavLink>
        <div className="sidebar-status">
          <strong>Research workspace</strong>
          Simulations are educational. Provider provenance is shown at every decision point.
        </div>
      </div>
    </nav>
  );
}
