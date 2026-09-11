// src/context/ThemeContext.tsx
import { createContext, useEffect, useState, ReactNode } from 'react';
import { useUserPreferences } from './UserPreferencesContext';

type Theme = 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { preferences, updateSettings } = useUserPreferences();
  const [systemTheme, setSystemTheme] = useState<Theme>(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const theme: Theme = preferences.theme === 'system' ? systemTheme : preferences.theme;

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // Apply theme class to <html> element and persist
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const toggleTheme = () => { void updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' }).catch(() => undefined); };

  const value: ThemeContextType = { theme, toggleTheme };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
