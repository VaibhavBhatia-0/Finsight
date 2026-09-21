import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const portfolioIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createPortfolioSchema = z.object({
  name: z.string().trim().min(1).max(100),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/).default('INR'),
  benchmarkId: z.coerce.number().int().positive().optional(),
  initialDeposit: z.object({
    amount: z.coerce.number().positive().max(1_000_000_000_000),
    date: isoDate,
  }).optional(),
});

export const updatePortfolioSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  benchmarkId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  allocationTargets: z.record(z.string().trim().min(1).max(30), z.coerce.number().min(0).max(100)).optional(),
}).refine(value => Object.keys(value).length > 0, 'At least one portfolio setting is required')
  .refine(value => !value.allocationTargets || Object.values(value.allocationTargets).reduce((sum, amount) => sum + amount, 0) <= 100.000001, {
    path: ['allocationTargets'], message: 'Allocation targets cannot exceed 100%',
  });

export const portfolioComparisonSchema = z.object({
  portfolioIds: z.array(z.coerce.number().int().positive()).min(2).max(4),
}).refine(value => new Set(value.portfolioIds).size === value.portfolioIds.length, {
  path: ['portfolioIds'], message: 'Portfolio IDs must be unique',
});

export const portfolioTransactionSchema = z.object({
  stockId: z.coerce.number().int().positive().optional(),
  transactionType: z.enum(['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX']),
  transactionDate: isoDate,
  quantity: z.coerce.number().positive().optional(),
  price: z.coerce.number().positive().optional(),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  feeAmount: z.coerce.number().nonnegative().optional(),
  fxRate: z.coerce.number().positive().optional(),
  notes: z.string().max(1000).optional(),
});
