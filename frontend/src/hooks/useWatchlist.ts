import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { ApiId, Watchlist } from '../api/contracts';
import { endpoints } from '../api/endpoints';

export function useWatchlist(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['watchlists'],
    queryFn: async () => (await api.get<Watchlist[]>(endpoints.watchlists.list)).data,
    enabled,
  });
  const mutation = useMutation({
    mutationFn: async ({ watchlistId, stockId }: { watchlistId: ApiId; stockId: ApiId }) =>
      (await api.post<{ added: true; watchlistId: ApiId; stockId: ApiId }>(endpoints.watchlists.items(watchlistId), { stockId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlists'] }),
  });
  const removal = useMutation({
    mutationFn: async ({ watchlistId, stockId }: { watchlistId: ApiId; stockId: ApiId }) =>
      api.delete<{ removed: true; watchlistId: ApiId; stockId: ApiId }>(endpoints.watchlists.item(watchlistId, stockId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlists'] }),
  });

  return {
    ...query,
    addToWatchlist: (stockId: ApiId) => {
      const watchlistId = query.data?.[0]?.id;
      if (!watchlistId) throw new Error('Create or load a watchlist before adding a stock');
      mutation.mutate({ watchlistId, stockId });
    },
    addError: mutation.error,
    removeFromWatchlist: (watchlistId: ApiId, stockId: ApiId) => removal.mutate({ watchlistId, stockId }),
    removeError: removal.error,
  };
}
