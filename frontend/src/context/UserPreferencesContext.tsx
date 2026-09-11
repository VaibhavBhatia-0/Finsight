import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { UserPreferences } from '../api/contracts';

export const dashboardSectionIds = ['summary', 'indices', 'watchlist', 'insights', 'labLaunch'] as const;
export type DashboardSectionId = typeof dashboardSectionIds[number];

interface DashboardPreferences {
  order: DashboardSectionId[];
  visible: Record<DashboardSectionId, boolean>;
  theme: 'dark' | 'light' | 'system';
  defaultCurrency: string;
  selectedMarketIndices: string[];
  taxResidency: 'IN' | 'US' | null;
  taxStatus: string | null;
}

interface SettingsUpdate {
  theme?: DashboardPreferences['theme'];
  defaultCurrency?: string;
  selectedMarketIndices?: string[];
  taxResidency?: 'IN' | 'US' | null;
  taxStatus?: string | null;
}

interface UserPreferencesContextValue {
  preferences: DashboardPreferences;
  saving: boolean;
  error: Error | null;
  setOrder: (order: DashboardSectionId[]) => Promise<void>;
  setVisibility: (section: DashboardSectionId, visible: boolean) => Promise<void>;
  updateSettings: (updates: SettingsUpdate) => Promise<void>;
}

const defaultPreferences: DashboardPreferences = {
  order: [...dashboardSectionIds],
  visible: { summary: true, indices: true, watchlist: true, insights: true, labLaunch: true },
  theme: 'system',
  defaultCurrency: 'INR',
  selectedMarketIndices: ['NIFTY_50', 'SENSEX', 'SP500', 'NASDAQ_COMP'],
  taxResidency: null,
  taxStatus: null,
};

function fromServer(value: UserPreferences | null): DashboardPreferences {
  if (!value) return defaultPreferences;
  const aliases: Record<string, DashboardSectionId> = {
    portfolio_summary: 'summary', finance_summary: 'summary', market_overview: 'indices',
    summary: 'summary', indices: 'indices', watchlist: 'watchlist', insights: 'insights', labLaunch: 'labLaunch',
  };
  const configured = (value.dashboard_layout.sections ?? [])
    .map(section => ({ ...section, id: aliases[section.id] }))
    .filter((section): section is { id: DashboardSectionId; order: number; visible: boolean } => Boolean(section.id))
    .sort((left, right) => left.order - right.order);
  const order = [...new Set(configured.map(section => section.id))];
  for (const id of dashboardSectionIds) if (!order.includes(id)) order.push(id);
  const visible = { ...defaultPreferences.visible };
  for (const section of configured) visible[section.id] = section.visible;
  return {
    order,
    visible,
    theme: value.theme,
    defaultCurrency: value.default_currency,
    selectedMarketIndices: value.selected_market_indices,
    taxResidency: value.tax_residency,
    taxStatus: value.tax_status,
  };
}

function layout(preferences: DashboardPreferences): UserPreferences['dashboard_layout'] {
  return { sections: preferences.order.map((id, order) => ({ id, order, visible: preferences.visible[id] })) };
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined);

export const UserPreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { preferences: serverPreferences, updatePreferences } = useAuth();
  const [preferences, setPreferences] = useState(() => fromServer(serverPreferences));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => setPreferences(fromServer(serverPreferences)), [serverPreferences]);

  const persist = async (next: DashboardPreferences, updates: Parameters<typeof updatePreferences>[0]) => {
    const previous = preferences;
    setPreferences(next);
    setSaving(true);
    setError(null);
    try {
      await updatePreferences(updates);
    } catch (reason) {
      setPreferences(previous);
      setError(reason instanceof Error ? reason : new Error('Unable to save preferences'));
      throw reason;
    } finally {
      setSaving(false);
    }
  };

  const setOrder = async (order: DashboardSectionId[]) => {
    const next = { ...preferences, order };
    await persist(next, { dashboard_layout: layout(next) });
  };

  const setVisibility = async (section: DashboardSectionId, visible: boolean) => {
    const next = { ...preferences, visible: { ...preferences.visible, [section]: visible } };
    await persist(next, { dashboard_layout: layout(next) });
  };

  const updateSettings = async (updates: SettingsUpdate) => {
    const next = {
      ...preferences,
      ...(updates.theme ? { theme: updates.theme } : {}),
      ...(updates.defaultCurrency ? { defaultCurrency: updates.defaultCurrency } : {}),
      ...(updates.selectedMarketIndices ? { selectedMarketIndices: updates.selectedMarketIndices } : {}),
      ...(updates.taxResidency !== undefined ? { taxResidency: updates.taxResidency } : {}),
      ...(updates.taxStatus !== undefined ? { taxStatus: updates.taxStatus } : {}),
    };
    await persist(next, {
      ...(updates.theme ? { theme: updates.theme } : {}),
      ...(updates.defaultCurrency ? { default_currency: updates.defaultCurrency } : {}),
      ...(updates.selectedMarketIndices ? { selected_market_indices: updates.selectedMarketIndices } : {}),
      ...(updates.taxResidency !== undefined ? { tax_residency: updates.taxResidency } : {}),
      ...(updates.taxStatus !== undefined ? { tax_status: updates.taxStatus } : {}),
    });
  };

  return <UserPreferencesContext.Provider value={{ preferences, saving, error, setOrder, setVisibility, updateSettings }}>{children}</UserPreferencesContext.Provider>;
};

export const useUserPreferences = (): UserPreferencesContextValue => {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return ctx;
};
