// src/hooks/useSavings.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";

export interface SavingsGoal {
  id: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // ISO date
  description?: string;
}

/** Fetch list of savings goals */
export const useSavings = (params?: Record<string, any>): UseQueryResult<SavingsGoal[], Error> => {
  return useQuery<SavingsGoal[], Error>(
    ["savings", params],
    async () => {
      const { data } = await api.get<SavingsGoal[]>("/api/v1/finance/savings", { params });
      return data;
    }
  );
};

/** Create a new savings goal */
export const useCreateSavings = (): UseMutationResult<SavingsGoal, Error, Omit<SavingsGoal, 'id'>, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<SavingsGoal, Error, Omit<SavingsGoal, 'id'>>(
    async (newGoal) => {
      const { data } = await api.post<SavingsGoal>("/api/v1/finance/savings", newGoal);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(["savings"]) }
  );
};

/** Update an existing savings goal */
export const useUpdateSavings = (): UseMutationResult<SavingsGoal, Error, SavingsGoal, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<SavingsGoal, Error, SavingsGoal>(
    async (goal) => {
      const { data } = await api.put<SavingsGoal>(`/api/v1/finance/savings/${goal.id}`, goal);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(["savings"]) }
  );
};

/** Delete a savings goal */
export const useDeleteSavings = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>(
    async (goalId) => {
      await api.delete(`/api/v1/finance/savings/${goalId}`);
    },
    { onSuccess: () => queryClient.invalidateQueries(["savings"]) }
  );
};
