import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name cannot be empty').optional(),
  baseCurrency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
});

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  default_currency: z.string().length(3).optional(),
  default_benchmark_id: z.string().nullable().optional(),
  dashboard_layout: z.any().optional(),
  selected_market_indices: z.array(z.string()).optional(),
  watchlist_preferences: z.any().optional(),
});

