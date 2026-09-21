import { createContext, useEffect, useState, type ReactNode } from 'react';
import { useUserPreferences } from './UserPreferencesContext';

type Theme = 'light' | 'dark';
type ThemeContextType = { theme: Theme; toggleTheme: () => void };

const STORAGE_KEY = 'finsight-theme';
export function resolveTheme(stored: string | null): Theme { return stored === 'light' || stored === 'dark' ? stored : 'dark'; }
export function oppositeTheme(theme: Theme): Theme { return theme === 'dark' ? 'light' : 'dark'; }
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { preferences, updateSettings } = useUserPreferences();
  const [theme, setTheme] = useState<Theme>(() => {
    return resolveTheme(window.localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    if (preferences.theme === 'light' || preferences.theme === 'dark') {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) setTheme(preferences.theme);
    }
  }, [preferences.theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = oppositeTheme(theme);
    setTheme(next);
    void updateSettings({ theme: next }).catch(() => {
      // Local persistence intentionally remains available on public routes/offline sessions.
    });
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};
