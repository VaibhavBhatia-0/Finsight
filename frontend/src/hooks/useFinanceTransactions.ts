import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { ApiId, FinanceRecurringRule, FinanceRecurringRuleRequest, FinanceTransactionRequest, FinanceTransactionRow } from '../api/contracts';
import { endpoints } from '../api/endpoints';

const relatedQueries = [['finance-transactions'], ['expenses'], ['finance-summary'], ['insights']] as const;

function useInvalidateFinance() {
  const client = useQueryClient();
  return () => Promise.all(relatedQueries.map(queryKey => client.invalidateQueries({ queryKey: [...queryKey] })));
}

export function useFinanceTransactions() {
  return useQuery({
    queryKey: ['finance-transactions'],
    queryFn: async () => (await api.get<FinanceTransactionRow[]>(endpoints.finance.transactions)).data,
  });
}

export function useCreateFinanceTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: async (request: FinanceTransactionRequest) => (await api.post<FinanceTransactionRow>(endpoints.finance.transactions, request)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteFinanceTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: async (id: ApiId) => { await api.delete(endpoints.finance.transaction(id)); },
    onSuccess: invalidate,
  });
}

export function useRecurringRules() {
  return useQuery({
    queryKey: ['finance-recurring-rules'],
    queryFn: async () => (await api.get<FinanceRecurringRule[]>(endpoints.finance.recurringRules)).data,
  });
}

export function useCreateRecurringRule() {
  const invalidate = useInvalidateFinance();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: FinanceRecurringRuleRequest) => (await api.post<{ rule: FinanceRecurringRule; occurrences: FinanceTransactionRow[] }>(endpoints.finance.recurringRules, request)).data,
    onSuccess: async () => { await invalidate(); await client.invalidateQueries({ queryKey: ['finance-recurring-rules'] }); },
  });
}

export function useDeactivateRecurringRule() {
  const invalidate = useInvalidateFinance();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: ApiId) => (await api.delete<FinanceRecurringRule>(endpoints.finance.recurringRule(id))).data,
    onSuccess: async () => { await invalidate(); await client.invalidateQueries({ queryKey: ['finance-recurring-rules'] }); },
  });
}
