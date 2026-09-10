// src/hooks/useGoals.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // ISO date
  description?: string;
}

export async function fetchGoals(params?: Record<string, any>): Promise<Goal[]> {
  const { data } = await api.get<Array<{ id: string; name: string; target_amount: number; current_amount: number; target_date: string }>>("/api/v1/finance/goals", { params });
  return data.map(item => ({ id: item.id, name: item.name, description: item.name, targetAmount: Number(item.target_amount), currentAmount: Number(item.current_amount), targetDate: item.target_date }));
}

/** Fetch list of goals */
export const useGoals = (params?: Record<string, any>): UseQueryResult<Goal[], Error> => {
  return useQuery<Goal[], Error>({
    queryKey: ["goals", params],
    queryFn: () => fetchGoals(params),
  });
};

/** Create a new goal */
export const useCreateGoal = (): UseMutationResult<Goal, Error, Omit<Goal, 'id'>, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Goal, Error, Omit<Goal, 'id'>>({
    mutationFn: async (newGoal) => {
      const { data } = await api.post<Goal>("/api/v1/finance/goals", newGoal);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
};

/** Update an existing goal */
export const useUpdateGoal = (): UseMutationResult<Goal, Error, Goal, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Goal, Error, Goal>({
    mutationFn: async (goal) => {
      const { data } = await api.put<Goal>(`/api/v1/finance/goals/${goal.id}`, goal);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
};

/** Delete a goal */
export const useDeleteGoal = (): UseMutationResult<void, Error, string, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (goalId) => {
      await api.delete(`/api/v1/finance/goals/${goalId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
};
