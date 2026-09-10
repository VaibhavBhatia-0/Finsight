import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export interface PortfolioValuation {
  portfolio: { id: string; name: string; baseCurrency: string };
  summary: { totalValue: number; cashBalance: number; holdingsValue: number; costBasis: number; totalReturnAmount: number; totalReturnPercentage: number };
  holdings: Array<{ stockId: string; symbol: string; companyName: string; quantity: number; averageCost: number; marketValue: number; unrealizedPnL: number; weight: number }>;
  risk: { volatility: number | null; sharpeRatio: number | null; maxDrawdown: number | null; beta: number | null; status?: string };
}

export function usePortfolios() {
  return useQuery({ queryKey: ['portfolios'], queryFn: async () => (await api.get<PortfolioValuation[]>('/api/v1/portfolios')).data });
}
export function usePortfolio(id?: string) {
  return useQuery({ queryKey: ['portfolio', id], queryFn: async () => (await api.get<PortfolioValuation>(`/api/v1/portfolios/${id}`)).data, enabled: Boolean(id) });
}
export function useCreatePortfolio() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (data: { name: string; baseCurrency: string }) => (await api.post<PortfolioValuation>('/api/v1/portfolios', data)).data, onSuccess: () => client.invalidateQueries({ queryKey: ['portfolios'] }) });
}
