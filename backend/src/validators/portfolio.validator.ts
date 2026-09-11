import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const portfolioIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createPortfolioSchema = z.object({
  name: z.string().trim().min(1).max(100),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/).default('INR'),
  benchmarkId: z.coerce.number().int().positive().optional(),
});

export const portfolioTransactionSchema = z.object({
  stockId: z.coerce.number().int().positive().optional(),
  transactionType: z.enum(['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'DEPOSIT', 'WITHDRAWAL', 'FEE']),
  transactionDate: isoDate,
  quantity: z.coerce.number().positive().optional(),
  price: z.coerce.number().positive().optional(),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  feeAmount: z.coerce.number().nonnegative().optional(),
  fxRate: z.coerce.number().positive().optional(),
  notes: z.string().max(1000).optional(),
});
