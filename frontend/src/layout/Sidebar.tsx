// src/layout/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BarChart2, List, FolderKanban, Coins, Settings, CreditCard, Wallet, TrendingUp } from 'lucide-react';

// Simplified navigation config – matches the locked route hierarchy
const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/markets', label: 'Markets', icon: BarChart2 },
  { to: '/watchlist', label: 'Watchlist', icon: List },
  { to: '/portfolios', label: 'Portfolios', icon: FolderKanban },
  { to: '/lab', label: 'FinSight Lab', icon: Coins },
  { to: '/finance/transactions', label: 'Finance', icon: Wallet },
  { to: '/insights', label: 'Insights', icon: TrendingUp },
  { to: '/backtesting', label: 'Backtesting', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  return (
    <nav className="flex flex-col h-full p-4 bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark" aria-label="Primary navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex items-center gap-2 p-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${
              isActive ? 'bg-gold-100 text-gold-800' : 'text-gray-700 dark:text-gray-300 hover:bg-gold-50 hover:text-gold-800'
            }`
          }
        >
          <item.icon className="w-5 h-5" aria-hidden="true" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default Sidebar;
