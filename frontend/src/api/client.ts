// src/api/client.ts
import axios from 'axios';

// Base URL comes from environment variable VITE_API_URL or defaults to same origin
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/',
  withCredentials: true,
});

// Request interceptor – attach JWT if present
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('jwt') || localStorage.getItem('jwt');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor – optional global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized, clear stored token and optionally redirect
    if (error.response?.status === 401) {
      sessionStorage.removeItem('jwt');
      localStorage.removeItem('jwt');
    }
    return Promise.reject(error);
  }
);

export default api;

