// src/hooks/useBudgets.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";
import type { ApiId, BudgetRow } from "../api/contracts";
import { endpoints } from "../api/endpoints";

export interface Budget {
  id: ApiId;
  category: string;
  amount: number;
  startDate: string;
  endDate: string;
  description?: string;
}

function toBudget(item: BudgetRow): Budget {
  return { id: item.id, category: item.category, amount: Number(item.amount), startDate: item.start_date.slice(0, 10), endDate: item.end_date.slice(0, 10) };
}

export async function fetchBudgets(): Promise<Budget[]> {
  const { data } = await api.get<BudgetRow[]>(endpoints.finance.budgets);
  return data.map(toBudget);
}

/** Fetch list of budgets */
export const useBudgets = (): UseQueryResult<Budget[], Error> => {
  return useQuery<Budget[], Error>({
    queryKey: ["budgets"],
    queryFn: fetchBudgets,
  });
};

/** Create a new budget */
export const useCreateBudget = (): UseMutationResult<Budget, Error, Omit<Budget, "id">, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, Omit<Budget, "id">>({
    mutationFn: async (newBudget) => {
      const { data } = await api.post<BudgetRow>(endpoints.finance.budgets, newBudget);
      return toBudget(data);
    },
    onSuccess: () => Promise.all([["budgets"], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};

/** Update an existing budget */
export const useUpdateBudget = (): UseMutationResult<Budget, Error, Budget, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, Budget>({
    mutationFn: async (budget) => {
      const { data } = await api.put<BudgetRow>(endpoints.finance.budget(budget.id), budget);
      return toBudget(data);
    },
    onSuccess: () => Promise.all([["budgets"], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};

/** Delete a budget */
export const useDeleteBudget = (): UseMutationResult<void, Error, ApiId, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, ApiId>({
    mutationFn: async (budgetId) => {
      await api.delete(endpoints.finance.budget(budgetId));
    },
    onSuccess: () => Promise.all([["budgets"], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};
