// src/layout/TopBar.tsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ThemeContext } from '../context/ThemeContext';
import { useContext } from 'react';
import { Moon, Sun, LogOut } from 'lucide-react';

const TopBar: React.FC = () => {
  const { user, logout } = useAuth();
  const themeCtx = useContext(ThemeContext);
  const isDark = themeCtx?.theme === 'dark';

  return (
    <header
      className="flex items-center justify-between px-4 py-2 bg-card-light dark:bg-card-dark border-b border-border-light dark:border-border-dark"
      aria-label="Top navigation"
    >
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">FinSight</h1>
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={themeCtx?.toggleTheme}
          className="p-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        {/* User avatar / name */}
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
            <button
              onClick={logout}
              className="p-1 rounded hover:bg-gold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;

