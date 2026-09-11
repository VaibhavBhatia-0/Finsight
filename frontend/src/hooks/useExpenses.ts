// src/hooks/useExpenses.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";
import type { ApiId, FinanceTransactionRow } from "../api/contracts";
import { endpoints } from "../api/endpoints";

export interface Expense {
  id: ApiId;
  amount: number;
  category: string;
  date: string; // ISO date string
  description?: string;
  currency: string;
}

export type NewExpense = Omit<Expense, 'id'>;

export interface ExpenseQuery {
  category?: string;
  startDate?: string;
  endDate?: string;
}

function toExpense(item: FinanceTransactionRow): Expense {
  return {
    id: item.id,
    amount: Number(item.amount),
    category: item.category,
    date: item.transaction_date.slice(0, 10),
    description: item.description ?? undefined,
    currency: item.currency,
  };
}

export const useExpenses = (params?: ExpenseQuery): UseQueryResult<Expense[], Error> => {
  return useQuery<Expense[], Error>({
    queryKey: ["expenses", params],
    queryFn: async () => {
      const { data } = await api.get<FinanceTransactionRow[]>(endpoints.finance.transactions, { params: { ...params, type: 'EXPENSE' } });
      return data.map(toExpense);
    }
  });
};

export const useCreateExpense = (): UseMutationResult<Expense, Error, NewExpense, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, NewExpense>({
    mutationFn: async (newExpense) => {
      const { data } = await api.post<FinanceTransactionRow>(endpoints.finance.transactions, { transactionType: 'EXPENSE', transactionDate: newExpense.date, category: newExpense.category, amount: newExpense.amount, description: newExpense.description, currency: newExpense.currency });
      return toExpense(data);
    },
    onSuccess: () => Promise.all([["expenses"], ['finance-transactions'], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};

export const useUpdateExpense = (): UseMutationResult<Expense, Error, Expense, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, Expense>({
    mutationFn: async (expense) => {
      const { data } = await api.put<FinanceTransactionRow>(endpoints.finance.transaction(expense.id), { transactionDate: expense.date, category: expense.category, amount: expense.amount, description: expense.description });
      return toExpense(data);
    },
    onSuccess: () => Promise.all([["expenses"], ['finance-transactions'], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};

export const useDeleteExpense = (): UseMutationResult<void, Error, ApiId, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, ApiId>({
    mutationFn: async (expenseId) => {
      await api.delete(endpoints.finance.transaction(expenseId));
    },
    onSuccess: () => Promise.all([["expenses"], ['finance-transactions'], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};
