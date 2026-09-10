// src/hooks/useGoals.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";

export interface Goal {
  id: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // ISO date
  description?: string;
}

/** Fetch list of goals */
export const useGoals = (params?: Record<string, any>): UseQueryResult<Goal[], Error> => {
  return useQuery<Goal[], Error>(
    ["goals", params],
    async () => {
      const { data } = await api.get<Goal[]>("/api/v1/finance/goals", { params });
      return data;
    }
  );
};

/** Create a new goal */
export const useCreateGoal = (): UseMutationResult<Goal, Error, Omit<Goal, 'id'>, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Goal, Error, Omit<Goal, 'id'>>(
    async (newGoal) => {
      const { data } = await api.post<Goal>("/api/v1/finance/goals", newGoal);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(["goals"]) }
  );
};

/** Update an existing goal */
export const useUpdateGoal = (): UseMutationResult<Goal, Error, Goal, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Goal, Error, Goal>(
    async (goal) => {
      const { data } = await api.put<Goal>(`/api/v1/finance/goals/${goal.id}`, goal);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(["goals"]) }
  );
};

/** Delete a goal */
export const useDeleteGoal = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>(
    async (goalId) => {
      await api.delete(`/api/v1/finance/goals/${goalId}`);
    },
    { onSuccess: () => queryClient.invalidateQueries(["goals"]) }
  );
};
