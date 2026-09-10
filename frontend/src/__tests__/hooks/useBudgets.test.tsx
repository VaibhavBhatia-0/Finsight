// src/__tests__/hooks/useBudgets.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useBudgets } from '../../hooks/useBudgets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server, handlers } from '../server';
import { render } from '@testing-library/react';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useBudgets', () => {
  test('fetches budgets successfully', async () => {
    const { result } = renderHook(() => useBudgets(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBeTruthy());
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({ id: 1, name: 'Monthly Budget' });
  });
});
