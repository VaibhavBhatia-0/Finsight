import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { ApiId, SavedScenario, ScenarioComparisonResponse, ScenarioRequest, ScenarioResult } from '../api/contracts';
import { endpoints } from '../api/endpoints';

export function useRunScenario() {
  return useMutation({
    mutationFn: async (payload: ScenarioRequest) =>
      (await api.post<ScenarioResult>(endpoints.scenarios.simulate, payload)).data,
  });
}

export function useScenarios() {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: async () => (await api.get<SavedScenario[]>(endpoints.scenarios.list)).data,
  });
}

export function useSaveScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ScenarioRequest) =>
      (await api.post<{ scenario: SavedScenario; result: Record<string, unknown>; simulation: ScenarioResult }>(endpoints.scenarios.save, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

export function useCompareScenarios() {
  return useMutation({
    mutationFn: async (scenarioIds: ApiId[]) =>
      (await api.post<ScenarioComparisonResponse>(endpoints.scenarios.compare, { scenarioIds })).data,
  });
}

export type { ScenarioRequest, ScenarioResult } from '../api/contracts';
