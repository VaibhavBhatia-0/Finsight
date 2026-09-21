import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import api from '../../api/client';
import type { RequiredContributionResult } from '../../api/contracts';
import { endpoints } from '../../api/endpoints';
import { server } from '../server';

describe('planning API contract', () => {
  test('sends an explicit return assumption and receives separate no-growth output', async () => {
    server.use(http.post(`http://localhost${endpoints.planning.requiredContribution}`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      expect(body).toMatchObject({ targetAmount: 1200, assumedAnnualReturn: 0.08, frequency: 'MONTHLY' });
      return HttpResponse.json({
        success: true,
        data: {
          targetAmount: 1200, currentAmount: 0, remainingAmount: 1200, frequency: 'MONTHLY', contributionCount: 12,
          contributionDates: [], noGrowth: { requiredContribution: 100, totalContributions: 1200, estimatedGrowth: 0 },
          growthAssumption: { assumedAnnualReturn: 8, requiredContribution: 96, totalContributions: 1152, estimatedGrowth: 48, disclaimer: 'Hypothetical.' },
        },
        error: null, meta: { timestamp: '2026-01-01T00:00:00Z', freshness: 'Historical' },
      });
    }));
    const response = await api.post<RequiredContributionResult>(endpoints.planning.requiredContribution, {
      targetAmount: 1200, currentAmount: 0, asOfDate: '2026-01-01', targetDate: '2027-01-01', frequency: 'MONTHLY', assumedAnnualReturn: 0.08,
    });
    expect(response.data.noGrowth.requiredContribution).toBe(100);
    expect(response.data.growthAssumption?.assumedAnnualReturn).toBe(8);
  });
});
