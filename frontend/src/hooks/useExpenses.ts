// src/hooks/useExpenses.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";

export interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string; // ISO date string
  description?: string;
}

export const useExpenses = (params?: Record<string, any>): UseQueryResult<Expense[], Error> => {
  return useQuery<Expense[], Error>(
    ["expenses", params],
    async () => {
      const { data } = await api.get<Expense[]>("/api/v1/finance/expenses", { params });
      return data;
    }
  );
};

export const useCreateExpense = (): UseMutationResult<Expense, Error, Omit<Expense, 'id'>, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, Omit<Expense, 'id'>>(
    async (newExpense) => {
      const { data } = await api.post<Expense>("/api/v1/finance/expenses", newExpense);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(["expenses"]) }
  );
};

export const useUpdateExpense = (): UseMutationResult<Expense, Error, Expense, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, Expense>(
    async (expense) => {
      const { data } = await api.put<Expense>(`/api/v1/finance/expenses/${expense.id}`, expense);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(["expenses"]) }
  );
};

export const useDeleteExpense = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>(
    async (expenseId) => {
      await api.delete(`/api/v1/finance/expenses/${expenseId}`);
    },
    { onSuccess: () => queryClient.invalidateQueries(["expenses"]) }
  );
};
