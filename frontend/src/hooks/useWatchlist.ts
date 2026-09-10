import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export interface WatchlistItem {
  stock_id: string;
  symbol: string;
  company_name: string;
  currency: string;
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
}

export function useWatchlist() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['watchlists'],
    queryFn: async () => (await api.get<Watchlist[]>('/api/v1/watchlists')).data,
  });
  const mutation = useMutation({
    mutationFn: async ({ watchlistId, stockId }: { watchlistId: string; stockId: string }) =>
      (await api.post(`/api/v1/watchlists/${watchlistId}/items`, { stockId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlists'] }),
  });
  const removal = useMutation({
    mutationFn: async ({ watchlistId, stockId }: { watchlistId: string; stockId: string }) => api.delete(`/api/v1/watchlists/${watchlistId}/items/${stockId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlists'] }),
  });

  return {
    ...query,
    addToWatchlist: (stockId: string) => {
      const watchlistId = query.data?.[0]?.id;
      if (!watchlistId) throw new Error('Create or load a watchlist before adding a stock');
      mutation.mutate({ watchlistId, stockId });
    },
    addError: mutation.error,
    removeFromWatchlist: (watchlistId: string, stockId: string) => removal.mutate({ watchlistId, stockId }),
    removeError: removal.error,
  };
}
