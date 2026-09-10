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
  return useQuery<Expense[], Error>({
    queryKey: ["expenses", params],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; amount: number; category: string; transaction_date: string; description?: string }>>("/api/v1/finance/transactions", { params: { ...params, type: 'EXPENSE' } });
      return data.map(item => ({ id: item.id, amount: Number(item.amount), category: item.category, date: item.transaction_date, description: item.description }));
    }
  });
};

export const useCreateExpense = (): UseMutationResult<Expense, Error, Omit<Expense, 'id'>, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, Omit<Expense, 'id'>>({
    mutationFn: async (newExpense) => {
      const { data } = await api.post<any>("/api/v1/finance/transactions", { transactionType: 'EXPENSE', transactionDate: newExpense.date, category: newExpense.category, amount: newExpense.amount, description: newExpense.description, currency: 'INR' });
      return { id: data.id, amount: Number(data.amount), category: data.category, date: data.transaction_date, description: data.description };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });
};

export const useUpdateExpense = (): UseMutationResult<Expense, Error, Expense, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, Expense>({
    mutationFn: async (expense) => {
      const { data } = await api.put<any>(`/api/v1/finance/transactions/${expense.id}`, { transactionDate: expense.date, category: expense.category, amount: expense.amount, description: expense.description });
      return { id: data.id, amount: Number(data.amount), category: data.category, date: data.transaction_date, description: data.description };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });
};

export const useDeleteExpense = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (expenseId) => {
      await api.delete(`/api/v1/finance/transactions/${expenseId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });
};
