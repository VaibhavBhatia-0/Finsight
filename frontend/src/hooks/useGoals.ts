// src/hooks/useGoals.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import api from "../api/client";
import type { ApiId, GoalRow } from "../api/contracts";
import { endpoints } from "../api/endpoints";

export interface Goal {
  id: ApiId;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
}

function toGoal(item: GoalRow): Goal {
  return { id: item.id, name: item.name, targetAmount: Number(item.target_amount), currentAmount: Number(item.current_amount), targetDate: item.target_date?.slice(0, 10) ?? null };
}

export async function fetchGoals(): Promise<Goal[]> {
  const { data } = await api.get<GoalRow[]>(endpoints.finance.goals);
  return data.map(toGoal);
}

/** Fetch list of goals */
export const useGoals = (): UseQueryResult<Goal[], Error> => {
  return useQuery<Goal[], Error>({
    queryKey: ["goals"],
    queryFn: fetchGoals,
  });
};

/** Create a new goal */
export const useCreateGoal = (): UseMutationResult<Goal, Error, Omit<Goal, 'id'>, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Goal, Error, Omit<Goal, 'id'>>({
    mutationFn: async (newGoal) => {
      const { data } = await api.post<GoalRow>(endpoints.finance.goals, { ...newGoal, targetDate: newGoal.targetDate ?? undefined });
      return toGoal(data);
    },
    onSuccess: () => Promise.all([["goals"], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};

/** Update an existing goal */
export const useUpdateGoal = (): UseMutationResult<Goal, Error, Goal, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<Goal, Error, Goal>({
    mutationFn: async (goal) => {
      const { data } = await api.put<GoalRow>(endpoints.finance.goal(goal.id), { ...goal, targetDate: goal.targetDate ?? undefined });
      return toGoal(data);
    },
    onSuccess: () => Promise.all([["goals"], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};

/** Delete a goal */
export const useDeleteGoal = (): UseMutationResult<void, Error, ApiId, unknown> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, ApiId>({
    mutationFn: async (goalId) => {
      await api.delete(endpoints.finance.goal(goalId));
    },
    onSuccess: () => Promise.all([["goals"], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};

export const useAddGoalContribution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { goalId: ApiId; amount: number; contributionDate: string; notes?: string }) => (
      await api.post<{ contribution: { id: ApiId; amount: number | string; contribution_date: string }; goal: GoalRow }>(endpoints.finance.goalContributions(input.goalId), input)
    ).data,
    onSuccess: () => Promise.all([["goals"], ['finance-summary'], ['insights']].map(queryKey => queryClient.invalidateQueries({ queryKey }))),
  });
};
