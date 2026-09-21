import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { ApiId, PortfolioBenchmark, PortfolioComparison, PortfolioIntelligence, PortfolioTransactionRequest, PortfolioTransactionResponse, PortfolioTransactionRow, PortfolioValuation } from '../api/contracts';
import { endpoints } from '../api/endpoints';

export function usePortfolios() {
  return useQuery({ queryKey: ['portfolios'], queryFn: async () => (await api.get<PortfolioValuation[]>(endpoints.portfolios.list)).data });
}
export function usePortfolio(id?: string) {
  return useQuery({ queryKey: ['portfolio', id], queryFn: async () => (await api.get<PortfolioValuation>(endpoints.portfolios.detail(id!))).data, enabled: Boolean(id) });
}
export function useCreatePortfolio() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (data: { name: string; baseCurrency: string; benchmarkId?: number; initialDeposit?: { amount: number; date: string } }) => (await api.post<PortfolioValuation>(endpoints.portfolios.create, data)).data, onSuccess: () => client.invalidateQueries({ queryKey: ['portfolios'] }) });
}

export function usePortfolioIntelligence(id?: ApiId) {
  return useQuery({
    queryKey: ['portfolio-intelligence', id],
    queryFn: async () => (await api.get<PortfolioIntelligence>(endpoints.portfolios.intelligence(id!))).data,
    enabled: id !== undefined,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function usePortfolioBenchmarks() {
  return useQuery({
    queryKey: ['portfolio-benchmarks'],
    queryFn: async () => (await api.get<PortfolioBenchmark[]>(endpoints.portfolios.benchmarks)).data,
    staleTime: Infinity,
  });
}

export function useUpdatePortfolio(id?: ApiId) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name?: string; benchmarkId?: ApiId | null; allocationTargets?: Record<string, number> }) => {
      if (id === undefined) throw new Error('Portfolio ID is required');
      return (await api.patch<PortfolioValuation>(endpoints.portfolios.detail(id), data)).data;
    },
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['portfolio', String(id)] }),
      client.invalidateQueries({ queryKey: ['portfolio-intelligence', id] }),
      client.invalidateQueries({ queryKey: ['portfolios'] }),
    ]),
  });
}

export function useComparePortfolios() {
  return useMutation({
    mutationFn: async (portfolioIds: ApiId[]) => (await api.post<PortfolioComparison>(endpoints.portfolios.compare, { portfolioIds })).data,
  });
}

export function usePortfolioTransactions(id?: ApiId) {
  return useQuery({
    queryKey: ['portfolio-transactions', id],
    queryFn: async () => (await api.get<PortfolioTransactionRow[]>(endpoints.portfolios.transactions(id!))).data,
    enabled: id !== undefined,
  });
}

export function useAddPortfolioTransaction(id?: ApiId) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: PortfolioTransactionRequest) => {
      if (id === undefined) throw new Error('Portfolio ID is required');
      return (await api.post<PortfolioTransactionResponse>(endpoints.portfolios.transactions(id), request)).data;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['portfolio', String(id)] });
      void client.invalidateQueries({ queryKey: ['portfolio-transactions', id] });
      void client.invalidateQueries({ queryKey: ['portfolios'] });
      void client.invalidateQueries({ queryKey: ['portfolio-intelligence', id] });
    },
  });
}

export type { PortfolioValuation } from '../api/contracts';
