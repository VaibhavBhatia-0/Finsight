// src/context/UserPreferencesContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface DashboardPreferences {
  // Order of sections (by key) and visibility flags
  order: string[]; // e.g. ['summary','indices','watchlist','labLaunch']
  visible: Record<string, boolean>;
}

interface UserPreferencesContextValue {
  preferences: DashboardPreferences;
  setOrder: (order: string[]) => void;
  setVisibility: (section: string, visible: boolean) => void;
}

const defaultPreferences: DashboardPreferences = {
  order: ['summary', 'indices', 'watchlist', 'labLaunch'],
  visible: {
    summary: true,
    indices: true,
    watchlist: true,
    labLaunch: true,
  },
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined);

export const UserPreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultPreferences);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('dashboardPreferences');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as DashboardPreferences;
        setPreferences(parsed);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // Persist changes
  useEffect(() => {
    localStorage.setItem('dashboardPreferences', JSON.stringify(preferences));
  }, [preferences]);

  const setOrder = (order: string[]) => {
    setPreferences((prev) => ({ ...prev, order }));
  };

  const setVisibility = (section: string, visible: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      visible: { ...prev.visible, [section]: visible },
    }));
  };

  return (
    <UserPreferencesContext.Provider value={{ preferences, setOrder, setVisibility }}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = (): UserPreferencesContextValue => {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return ctx;
};

