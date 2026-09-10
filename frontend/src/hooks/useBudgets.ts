// src/hooks/useBudgets.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";

export interface Budget {
  id: string;
  category: string;
  amount: number;
  period: string; // e.g., 'monthly', 'yearly'
  description?: string;
}

/** Fetch list of budgets */
export const useBudgets = (params?: Record<string, any>): UseQueryResult<Budget[], Error> => {
  return useQuery<Budget[], Error>(
    ["budgets", params],
    async () => {
      const { data } = await api.get<Budget[]>("/api/v1/finance/budgets", { params });
      return data;
    }
  );
};

/** Create a new budget */
export const useCreateBudget = (): UseMutationResult<Budget, Error, Omit<Budget, "id">, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, Omit<Budget, "id">>(
    async (newBudget) => {
      const { data } = await api.post<Budget>("/api/v1/finance/budgets", newBudget);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(["budgets"]) }
  );
};

/** Update an existing budget */
export const useUpdateBudget = (): UseMutationResult<Budget, Error, Budget, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, Budget>(
    async (budget) => {
      const { data } = await api.put<Budget>(`/api/v1/finance/budgets/${budget.id}`, budget);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(["budgets"]) }
  );
};

/** Delete a budget */
export const useDeleteBudget = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>(
    async (budgetId) => {
      await api.delete(`/api/v1/finance/budgets/${budgetId}`);
    },
    { onSuccess: () => queryClient.invalidateQueries(["budgets"]) }
  );
};
