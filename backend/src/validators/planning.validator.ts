import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const selection = z.object({
  portfolioId: z.coerce.number().int().positive().optional(),
  stockId: z.coerce.number().int().positive().optional(),
  symbol: z.string().trim().min(1).max(20).optional(),
}).refine(value => [value.portfolioId, value.stockId, value.symbol].filter(Boolean).length === 1, {
  message: 'Select exactly one portfolio or asset',
});

const historical = selection.and(z.object({
  startDate: isoDate,
  endDate: isoDate,
  initialAmount: z.coerce.number().positive().max(1_000_000_000),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/),
  investmentMode: z.enum(['LUMP_SUM', 'RECURRING']).default('LUMP_SUM'),
  contributionFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']).default('MONTHLY'),
  contributionGrowthRate: z.coerce.number().min(0).max(10).default(0),
  benchmarkCode: z.string().trim().min(1).max(30).optional(),
  feeRate: z.coerce.number().min(0).max(0.1).default(0),
  taxJurisdiction: z.enum(['IN', 'US']).optional(),
})).refine(value => value.startDate < value.endDate, { path: ['endDate'], message: 'End date must be after start date' });

export const whatIfSchema = historical.and(z.object({
  baselineInitialAmount: z.coerce.number().positive().max(1_000_000_000).optional(),
}));

export const replaySchema = historical;

export const recurringPlannerSchema = selection.and(z.object({
  startDate: isoDate,
  endDate: isoDate,
  initialAmount: z.coerce.number().positive().max(1_000_000_000),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/),
  contributionFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
  contributionGrowthRate: z.coerce.number().min(0).max(10).default(0),
  benchmarkCode: z.string().trim().min(1).max(30).optional(),
  feeRate: z.coerce.number().min(0).max(0.1).default(0),
  taxJurisdiction: z.enum(['IN', 'US']).optional(),
})).refine(value => value.startDate < value.endDate, { path: ['endDate'], message: 'End date must be after start date' });

export const requiredContributionSchema = z.object({
  targetAmount: z.coerce.number().positive().max(1_000_000_000_000),
  currentAmount: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  asOfDate: isoDate,
  targetDate: isoDate,
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  assumedAnnualReturn: z.coerce.number().gt(-1).max(10).optional(),
}).refine(value => value.asOfDate < value.targetDate, { path: ['targetDate'], message: 'Target date must be after the as-of date' });
