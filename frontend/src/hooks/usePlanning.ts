import { useMutation } from '@tanstack/react-query';
import api from '../api/client';
import type { PlanningSimulationResponse, RequiredContributionResult } from '../api/contracts';
import { endpoints } from '../api/endpoints';

export interface PlanningSelection {
  portfolioId?: string;
  stockId?: string;
  symbol?: string;
}

export interface HistoricalPlanningRequest extends PlanningSelection {
  startDate: string;
  endDate: string;
  initialAmount: number;
  baseCurrency: string;
  investmentMode?: 'LUMP_SUM' | 'RECURRING';
  contributionFrequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  contributionGrowthRate?: number;
  benchmarkCode?: string;
  feeRate?: number;
  baselineInitialAmount?: number;
}

export function useRequiredContribution() {
  return useMutation({ mutationFn: async (request: {
    targetAmount: number; currentAmount: number; asOfDate: string; targetDate: string;
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'; assumedAnnualReturn?: number;
  }) => (await api.post<RequiredContributionResult>(endpoints.planning.requiredContribution, request)).data });
}

export function useWhatIf() {
  return useMutation({ mutationFn: async (request: HistoricalPlanningRequest) => (await api.post<PlanningSimulationResponse>(endpoints.planning.whatIf, request)).data });
}

export function useReplay() {
  return useMutation({ mutationFn: async (request: HistoricalPlanningRequest) => (await api.post<PlanningSimulationResponse>(endpoints.planning.replay, request)).data });
}

export function useRecurringPlanner() {
  return useMutation({ mutationFn: async (request: HistoricalPlanningRequest) => (await api.post<PlanningSimulationResponse>(endpoints.planning.recurring, request)).data });
}
