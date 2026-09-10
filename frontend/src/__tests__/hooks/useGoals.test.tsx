// src/__tests__/hooks/useGoals.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useGoals } from '../../hooks/useGoals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useGoals', () => {
  test('fetches goals successfully', async () => {
    const { result } = renderHook(() => useGoals(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBeTruthy());
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({ id: 1, description: 'Emergency Fund' });
  });
});
