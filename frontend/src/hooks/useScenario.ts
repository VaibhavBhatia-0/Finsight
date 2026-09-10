import { useMutation } from '@tanstack/react-query';
import api from '../api/client';
import type { LabResult } from '../pages/lab/LabResultView';

export interface ScenarioPayload {
  scenarioType: 'SINGLE_INVESTMENT' | 'RECURRING_INVESTMENT' | 'PORTFOLIO_SCENARIO';
  symbol?: string;
  startDate: string;
  endDate: string;
  initialAmount: number;
  baseCurrency: string;
  benchmarkCode?: string;
  contributionFrequency?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
}

export function useRunScenario() {
  return useMutation({
    mutationFn: async (payload: ScenarioPayload) =>
      (await api.post<LabResult>('/api/v1/scenarios/simulate', payload)).data,
  });
}
