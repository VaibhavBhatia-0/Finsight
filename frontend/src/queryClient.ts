import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  if (error instanceof ApiError && ['MARKET_DATA_UNAVAILABLE', 'MARKET_UNIVERSE_UNAVAILABLE'].includes(error.code)) return false;
  return true;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: attempt => Math.min(1_000 * 2 ** attempt, 5_000),
        refetchOnWindowFocus: false,
      },
    },
  });
}
