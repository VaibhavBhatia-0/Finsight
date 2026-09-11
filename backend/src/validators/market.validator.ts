import { z } from 'zod';

const optionalNumber = z.coerce.number().finite().optional();
const nonNegativeNumber = z.coerce.number().finite().nonnegative().optional();

export const screenerQuerySchema = z.object({
  exchange: z.string().trim().max(20).optional(),
  country: z.string().trim().length(2).optional(),
  sector: z.string().trim().max(100).optional(),
  minMarketCap: nonNegativeNumber,
  maxMarketCap: nonNegativeNumber,
  minPrice: nonNegativeNumber,
  maxPrice: nonNegativeNumber,
  minPe: optionalNumber,
  maxPe: optionalNumber,
  minEps: optionalNumber,
  maxEps: optionalNumber,
  minDivYield: optionalNumber,
  maxDivYield: optionalNumber,
  minRevenue: optionalNumber,
  maxRevenue: optionalNumber,
  minProfit: optionalNumber,
  maxProfit: optionalNumber,
  minDebt: nonNegativeNumber,
  maxDebt: nonNegativeNumber,
  minVolume: nonNegativeNumber,
  maxVolume: nonNegativeNumber,
  minRsi: z.coerce.number().min(0).max(100).optional(),
  maxRsi: z.coerce.number().min(0).max(100).optional(),
  minYearPosition: z.coerce.number().min(0).max(100).optional(),
  maxYearPosition: z.coerce.number().min(0).max(100).optional(),
  movingAverageRelation: z.enum(['ABOVE_50', 'BELOW_50', 'ABOVE_200', 'BELOW_200', 'GOLDEN_CROSS', 'DEATH_CROSS']).optional(),
  sortBy: z.enum(['symbol', 'name', 'price', 'marketCap', 'peRatio', 'eps', 'dividendYield', 'revenue', 'profit', 'debt', 'volume', 'rsi14', 'yearPosition']).default('marketCap'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ScreenerFilters = z.infer<typeof screenerQuerySchema>;
