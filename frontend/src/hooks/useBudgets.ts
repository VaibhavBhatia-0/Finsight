// src/hooks/useBudgets.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";

export interface Budget {
  id: string;
  category: string;
  amount: number;
  startDate: string;
  endDate: string;
  description?: string;
}

export async function fetchBudgets(params?: Record<string, any>): Promise<Budget[]> {
  const { data } = await api.get<Array<{ id: string; category: string; amount: number; start_date: string; end_date: string }>>("/api/v1/finance/budgets", { params });
  return data.map(item => ({ id: item.id, category: item.category, amount: Number(item.amount), startDate: item.start_date, endDate: item.end_date }));
}

/** Fetch list of budgets */
export const useBudgets = (params?: Record<string, any>): UseQueryResult<Budget[], Error> => {
  return useQuery<Budget[], Error>({
    queryKey: ["budgets", params],
    queryFn: () => fetchBudgets(params),
  });
};

/** Create a new budget */
export const useCreateBudget = (): UseMutationResult<Budget, Error, Omit<Budget, "id">, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, Omit<Budget, "id">>({
    mutationFn: async (newBudget) => {
      const { data } = await api.post<Budget>("/api/v1/finance/budgets", newBudget);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
};

/** Update an existing budget */
export const useUpdateBudget = (): UseMutationResult<Budget, Error, Budget, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, Budget>({
    mutationFn: async (budget) => {
      const { data } = await api.put<Budget>(`/api/v1/finance/budgets/${budget.id}`, budget);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
};

/** Delete a budget */
export const useDeleteBudget = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (budgetId) => {
      await api.delete(`/api/v1/finance/budgets/${budgetId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });
};
