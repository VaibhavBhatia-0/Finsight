import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { ApiId, MarketAlert, MarketAlertCondition } from '../api/contracts';
import { endpoints } from '../api/endpoints';

export function useMarketAlerts(stockId?: ApiId, enabled = true) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['market-alerts', stockId], queryFn: async () => (await api.get<MarketAlert[]>(endpoints.alerts.list, { params: { stockId } })).data, enabled });
  const invalidate = () => client.invalidateQueries({ queryKey: ['market-alerts', stockId] });
  const create = useMutation({ mutationFn: async (input: { stockId: ApiId; condition: MarketAlertCondition; threshold: number }) => (await api.post<MarketAlert>(endpoints.alerts.create, input)).data, onSuccess: invalidate });
  const update = useMutation({ mutationFn: async (input: { id: ApiId; condition?: MarketAlertCondition; threshold?: number; enabled?: boolean }) => (await api.patch<MarketAlert>(endpoints.alerts.detail(input.id), input)).data, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: async (id: ApiId) => api.delete(endpoints.alerts.detail(id)), onSuccess: invalidate });
  return { ...query, create, update, remove };
}
