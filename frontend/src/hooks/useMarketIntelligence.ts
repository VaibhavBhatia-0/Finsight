import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../api/client';
import type { ApiId, HistoricalPriceResponse, MarketComparisonResponse, SecurityQuoteResponse, TechnicalAnalysisResponse } from '../api/contracts';
import { endpoints } from '../api/endpoints';

export function useSecurityQuote(stockId?: ApiId | null) {
  return useQuery({
    queryKey: ['security-quote', stockId],
    queryFn: async () => (await api.get<SecurityQuoteResponse>(endpoints.markets.securityQuote(stockId!))).data,
    enabled: stockId != null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useHistoricalPrice(stockId?: ApiId | null, date?: string) {
  return useQuery({
    queryKey: ['historical-price', stockId, date],
    queryFn: async () => (await api.get<HistoricalPriceResponse>(endpoints.markets.historicalPrice(stockId!), { params: { date } })).data,
    enabled: stockId != null && Boolean(date),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useTechnicalAnalysis(stockId?: ApiId | null, period = '1Y') {
  return useQuery({
    queryKey: ['technical-analysis', stockId, period],
    queryFn: async () => (await api.get<TechnicalAnalysisResponse>(endpoints.markets.technicals(stockId!), { params: { period } })).data,
    enabled: stockId != null,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useMarketComparison() {
  return useMutation({ mutationFn: async (securityIds: ApiId[]) => (await api.post<MarketComparisonResponse>(endpoints.markets.compare, { securityIds })).data });
}
