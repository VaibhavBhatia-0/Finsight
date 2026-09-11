import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import type { InsightsResponse } from '../api/contracts';
import { endpoints } from '../api/endpoints';

export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: async () => (await api.get<InsightsResponse>(endpoints.insights.list)).data,
  });
}
