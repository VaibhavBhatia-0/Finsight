import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const asset = z.object({ stockId: z.coerce.number().int().positive().optional(), symbol: z.string().trim().min(1).max(20).optional(), weight: z.number().positive().max(1) })
  .refine(value => value.stockId || value.symbol, 'Each asset requires stockId or symbol');

export const scenarioSimulationSchema = z.object({
  scenarioType: z.enum(['SINGLE_INVESTMENT', 'RECURRING_INVESTMENT', 'PORTFOLIO_SCENARIO']).default('SINGLE_INVESTMENT'),
  stockId: z.coerce.number().int().positive().optional(),
  symbol: z.string().trim().min(1).max(20).optional(),
  assets: z.array(asset).min(2).max(20).optional(),
  startDate: isoDate,
  endDate: isoDate,
  initialAmount: z.coerce.number().positive().max(1_000_000_000),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/),
  benchmarkCode: z.string().trim().min(1).max(30).optional(),
  taxRuleId: z.coerce.number().int().positive().optional(),
  taxJurisdiction: z.enum(['IN', 'US']).optional(),
  feeRate: z.coerce.number().min(0).max(0.1).optional(),
  contributionFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
}).passthrough().superRefine((value, context) => {
  if (value.startDate >= value.endDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must be after start date' });
  if (value.scenarioType === 'PORTFOLIO_SCENARIO' && !value.assets) context.addIssue({ code: z.ZodIssueCode.custom, path: ['assets'], message: 'Portfolio assets are required' });
  if (value.scenarioType !== 'PORTFOLIO_SCENARIO' && !value.stockId && !value.symbol) context.addIssue({ code: z.ZodIssueCode.custom, path: ['symbol'], message: 'A stock is required' });
});

export const scenarioComparisonSchema = z.object({
  scenarioIds: z.array(z.coerce.number().int().positive()).min(2).max(20),
}).refine(value => new Set(value.scenarioIds).size === value.scenarioIds.length, { path: ['scenarioIds'], message: 'Scenario IDs must be unique' });
