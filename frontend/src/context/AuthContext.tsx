// src/context/AuthContext.tsx
import { createContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/client';

type User = {
  id: string;
  email: string;
  name: string | null;
  baseCurrency: string;
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name?: string; baseCurrency?: string }) => Promise<void>;
  logout: () => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const loadUserFromStorage = () => {
    const token = sessionStorage.getItem('jwt') || localStorage.getItem('jwt');
    if (token) {
      // Token exists – attempt to fetch user profile
      axios
        .get<{ user: User }>('/api/v1/auth/me')
        .then((res) => setUser(res.data.user))
        .catch(() => {
          // Invalid token – clear storage
          sessionStorage.removeItem('jwt');
          localStorage.removeItem('jwt');
          setUser(null);
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
    const res = await axios.post<{ token: string; user: User }>('/api/v1/auth/login', { email, password });
    const { token, user } = res.data;
    // Store token in sessionStorage (default) – fallback to localStorage if needed
    sessionStorage.setItem('jwt', token);
    setUser(user);
    navigate('/dashboard');
  };

  const register = async (input: { email: string; password: string; name?: string; baseCurrency?: string }) => {
    const res = await axios.post<{ token: string; user: User }>('/api/v1/auth/register', input);
    sessionStorage.setItem('jwt', res.data.token);
    setUser(res.data.user);
    navigate('/dashboard');
  };

  const logout = () => {
    sessionStorage.removeItem('jwt');
    localStorage.removeItem('jwt');
    setUser(null);
    navigate('/login');
  };

  const value: AuthContextType = { user, login, register, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
