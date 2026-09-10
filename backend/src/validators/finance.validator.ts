import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const transactionSchema = z.object({ transactionType: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']), category: z.string().trim().min(1).max(100), amount: z.coerce.number().positive(), currency: z.string().regex(/^[A-Z]{3}$/).default('INR'), description: z.string().max(500).optional(), transactionDate: isoDate, recurring: z.boolean().optional(), notes: z.string().max(1000).optional() });
export const transactionUpdateSchema = transactionSchema.pick({ category: true, amount: true, description: true, transactionDate: true });
export const budgetSchema = z.object({ category: z.string().trim().min(1).max(100), amount: z.coerce.number().positive(), startDate: isoDate, endDate: isoDate }).refine(value => value.startDate <= value.endDate, { path: ['endDate'], message: 'End date must not precede start date' });
export const goalSchema = z.object({ name: z.string().trim().min(1).max(150), targetAmount: z.coerce.number().positive(), currentAmount: z.coerce.number().nonnegative().default(0), targetDate: isoDate.optional() });
export const idSchema = z.object({ id: z.coerce.number().int().positive() });
