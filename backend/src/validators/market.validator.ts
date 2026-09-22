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
  maxVolatility: nonNegativeNumber,
  minRsi: z.coerce.number().min(0).max(100).optional(),
  maxRsi: z.coerce.number().min(0).max(100).optional(),
  minYearPosition: z.coerce.number().min(0).max(100).optional(),
  maxYearPosition: z.coerce.number().min(0).max(100).optional(),
  movingAverageRelation: z.enum(['ABOVE_50', 'BELOW_50', 'ABOVE_200', 'BELOW_200', 'GOLDEN_CROSS', 'DEATH_CROSS']).optional(),
  sortBy: z.enum(['symbol', 'name', 'price', 'marketCap', 'peRatio', 'eps', 'dividendYield', 'revenue', 'profit', 'debt', 'volume', 'volatility', 'rsi14', 'yearPosition']).default('marketCap'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ScreenerFilters = z.infer<typeof screenerQuerySchema>;

export const stockListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  exchange: z.string().trim().max(20).optional(),
  country: z.string().trim().length(2).optional(),
  sector: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['symbol', 'company']).default('symbol'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const securitySearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const securityIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
export const stockIdentityParamsSchema = z.object({ id: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9.^=_-]+$/) });
export const historicalPriceQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const stockPricesQuerySchema = z.object({
  period: z.enum(['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(value => !value.startDate === !value.endDate, { message: 'startDate and endDate must be provided together' })
  .refine(value => !value.startDate || !value.endDate || value.startDate <= value.endDate, { path: ['endDate'], message: 'endDate must not precede startDate' });
export const fxQuerySchema = z.object({
  from: z.string().trim().regex(/^[A-Za-z]{3}$/).default('USD').transform(value => value.toUpperCase()),
  to: z.string().trim().regex(/^[A-Za-z]{3}$/).default('INR').transform(value => value.toUpperCase()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export const technicalQuerySchema = z.object({ period: z.enum(['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX']).default('1Y') });
export const marketComparisonSchema = z.object({
  securityIds: z.array(z.coerce.number().int().positive()).min(2).max(5),
}).refine(value => new Set(value.securityIds).size === value.securityIds.length, { path: ['securityIds'], message: 'Security IDs must be unique' });
