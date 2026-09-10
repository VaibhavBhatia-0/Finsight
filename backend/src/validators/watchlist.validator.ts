import { z } from 'zod';

export const watchlistIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
export const watchlistItemParamsSchema = watchlistIdParamsSchema.extend({ stockId: z.coerce.number().int().positive() });
export const createWatchlistSchema = z.object({ name: z.string().trim().min(1).max(100) });
export const addWatchlistItemSchema = z.object({ stockId: z.coerce.number().int().positive() });
