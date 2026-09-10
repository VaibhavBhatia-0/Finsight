// src/hooks/useBacktest.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import api from '../api/client';

export interface BacktestPayload {
  portfolioId: string;
  initialAmount: number;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  // Additional parameters such as strategy config can be added here
  name?: string;
  strategyType?: 'BUY_AND_HOLD';
}

export interface BacktestResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  summary?: Record<string, number | null>;
  details?: { timeSeries?: Array<{ date: string; value: number }>; strategyType?: string };
  mode?: string;
  financials?: Record<string, number>;
  attribution?: Record<string, number>;
  risk_metrics?: Record<string, number | null>;
}

/**
 * Fetch a single backtest result by ID.
 */
export const useBacktest = (backtestId: string, enabled: boolean = true): UseQueryResult<BacktestResult, Error> => {
  return useQuery<BacktestResult, Error>({
    queryKey: ['backtest', backtestId],
    queryFn: async () => {
      const { data } = await api.get<BacktestResult>(`/api/v1/backtests/${backtestId}`);
      return data;
    },
    enabled,
  });
};

/**
 * Fetch a list of backtests.
 */
export const useBacktests = (params?: Record<string, any>): UseQueryResult<BacktestResult[], Error> => {
  return useQuery<BacktestResult[], Error>({
    queryKey: ['backtests', params],
    queryFn: async () => {
      const { data } = await api.get<BacktestResult[]>('/api/v1/backtests', { params });
      return data;
    },
  });
};

/**
 * Run (create) a new backtest.
 */
export const useRunBacktest = (): UseMutationResult<BacktestResult, Error, BacktestPayload, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<BacktestResult, Error, BacktestPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<BacktestResult>('/api/v1/backtests', payload);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backtests'] }),
  });
};

/**
 * Delete an existing backtest.
 */
export const useDeleteBacktest = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (backtestId) => {
      await api.delete(`/api/v1/backtests/${backtestId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backtests'] }),
  });
};
