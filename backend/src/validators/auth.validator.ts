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

export const emailActionRequestSchema = z.object({ email: z.string().email('Valid email is required') });
export const verifyEmailSchema = z.object({ token: z.string().min(32).max(200) });
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(200), password: z.string().min(8).max(128) });
export const googleCallbackQuerySchema = z.object({ code: z.string().min(1).max(4096), state: z.string().min(32).max(200) });

export const updatePreferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  default_currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  default_benchmark_id: z.coerce.number().int().positive().nullable().optional(),
  dashboard_layout: z.object({
    sections: z.array(z.object({
      id: z.string().trim().min(1).max(50),
      order: z.number().int().nonnegative(),
      visible: z.boolean(),
    })).max(20),
  }).optional(),
  selected_market_indices: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  watchlist_preferences: z.object({
    sortBy: z.enum(['symbol', 'company_name', 'added_at']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).optional(),
  tax_residency: z.enum(['IN', 'US']).nullable().optional(),
  tax_status: z.string().trim().max(40).nullable().optional(),
});
