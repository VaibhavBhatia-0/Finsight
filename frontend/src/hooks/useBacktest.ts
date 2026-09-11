// src/hooks/useBacktest.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import api from '../api/client';
import type { BacktestRequest, BacktestResult } from '../api/contracts';
import { endpoints } from '../api/endpoints';

/**
 * Fetch a single backtest result by ID.
 */
export const useBacktest = (backtestId: string, enabled: boolean = true): UseQueryResult<BacktestResult, Error> => {
  return useQuery<BacktestResult, Error>({
    queryKey: ['backtest', backtestId],
    queryFn: async () => {
      const { data } = await api.get<BacktestResult>(endpoints.backtests.detail(backtestId));
      return data;
    },
    enabled,
  });
};

/**
 * Fetch a list of backtests.
 */
export const useBacktests = (): UseQueryResult<BacktestResult[], Error> => {
  return useQuery<BacktestResult[], Error>({
    queryKey: ['backtests'],
    queryFn: async () => {
      const { data } = await api.get<BacktestResult[]>(endpoints.backtests.list);
      return data;
    },
  });
};

/**
 * Run (create) a new backtest.
 */
export const useRunBacktest = (): UseMutationResult<BacktestResult, Error, BacktestRequest, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<BacktestResult, Error, BacktestRequest>({
    mutationFn: async (payload) => {
      const { data } = await api.post<BacktestResult>(endpoints.backtests.run, payload);
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
      await api.delete(endpoints.backtests.detail(backtestId));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backtests'] }),
  });
};

export type { BacktestRequest, BacktestResult } from '../api/contracts';
