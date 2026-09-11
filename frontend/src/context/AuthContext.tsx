// src/context/AuthContext.tsx
import { createContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { endpoints } from '../api/endpoints';
import type { AuthResponse, ProfileResponse, User, UserPreferences } from '../api/contracts';

type AuthContextType = {
  user: User | null;
  preferences: UserPreferences | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name?: string; baseCurrency?: string }) => Promise<void>;
  completeOAuth: (token: string) => Promise<void>;
  logout: () => void;
  updatePreferences: (updates: Partial<Pick<UserPreferences, 'theme' | 'default_currency' | 'default_benchmark_id' | 'dashboard_layout' | 'selected_market_indices' | 'watchlist_preferences' | 'tax_residency' | 'tax_status'>>) => Promise<UserPreferences>;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const loadUserFromStorage = () => {
    const token = sessionStorage.getItem('jwt') || localStorage.getItem('jwt');
    if (token) {
      // Token exists – attempt to fetch user profile
      api
        .get<ProfileResponse>(endpoints.auth.me)
        .then((res) => {
          setUser(res.data.user);
          setPreferences(res.data.preferences);
        })
        .catch(() => {
          // Invalid token – clear storage
          sessionStorage.removeItem('jwt');
          localStorage.removeItem('jwt');
          setUser(null);
          setPreferences(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserFromStorage();
    // Listen for storage events (e.g., logout in another tab)
    const handleStorage = () => loadUserFromStorage();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthResponse>(endpoints.auth.login, { email, password });
    const { token, user } = res.data;
    // Store token in sessionStorage (default) – fallback to localStorage if needed
    sessionStorage.setItem('jwt', token);
    setUser(user);
    setPreferences(res.data.preferences);
    navigate('/dashboard');
  };

  const register = async (input: { email: string; password: string; name?: string; baseCurrency?: string }) => {
    const res = await api.post<AuthResponse>(endpoints.auth.register, input);
    sessionStorage.setItem('jwt', res.data.token);
    setUser(res.data.user);
    setPreferences(res.data.preferences);
    navigate('/dashboard');
  };

  const completeOAuth = async (token: string) => {
    sessionStorage.setItem('jwt', token);
    try {
      const response = await api.get<ProfileResponse>(endpoints.auth.me);
      setUser(response.data.user);
      setPreferences(response.data.preferences);
      navigate('/dashboard');
    } catch (error) {
      sessionStorage.removeItem('jwt');
      throw error;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('jwt');
    localStorage.removeItem('jwt');
    setUser(null);
    setPreferences(null);
    navigate('/login');
  };

  const updatePreferences = async (updates: Partial<Pick<UserPreferences, 'theme' | 'default_currency' | 'default_benchmark_id' | 'dashboard_layout' | 'selected_market_indices' | 'watchlist_preferences' | 'tax_residency' | 'tax_status'>>) => {
    const response = await api.put<UserPreferences>(endpoints.auth.preferences, updates);
    setPreferences(response.data);
    return response.data;
  };

  const value: AuthContextType = { user, preferences, login, register, completeOAuth, logout, updatePreferences, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
