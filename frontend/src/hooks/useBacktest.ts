// src/hooks/useBacktest.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import api from '../api/client';

export interface BacktestPayload {
  portfolioId: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  // Additional parameters such as strategy config can be added here
  [key: string]: any;
}

export interface BacktestResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  summary?: any;
  details?: any;
}

/**
 * Fetch a single backtest result by ID.
 */
export const useBacktest = (backtestId: string, enabled: boolean = true): UseQueryResult<BacktestResult, Error> => {
  return useQuery<BacktestResult, Error>(
    ['backtest', backtestId],
    async () => {
      const { data } = await api.get<BacktestResult>(`/api/v1/backtesting/${backtestId}`);
      return data;
    },
    { enabled }
  );
};

/**
 * Fetch a list of backtests.
 */
export const useBacktests = (params?: Record<string, any>): UseQueryResult<BacktestResult[], Error> => {
  return useQuery<BacktestResult[], Error>(
    ['backtests', params],
    async () => {
      const { data } = await api.get<BacktestResult[]>('/api/v1/backtesting', { params });
      return data;
    }
  );
};

/**
 * Run (create) a new backtest.
 */
export const useRunBacktest = (): UseMutationResult<BacktestResult, Error, BacktestPayload, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<BacktestResult, Error, BacktestPayload>(
    async (payload) => {
      const { data } = await api.post<BacktestResult>('/api/v1/backtesting', payload);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(['backtests']) }
  );
};

/**
 * Delete an existing backtest.
 */
export const useDeleteBacktest = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>(
    async (backtestId) => {
      await api.delete(`/api/v1/backtesting/${backtestId}`);
    },
    { onSuccess: () => queryClient.invalidateQueries(['backtests']) }
  );
};

