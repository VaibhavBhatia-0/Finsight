import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportQuerySchema = z.object({
  reportType: z.enum(['portfolios', 'portfolio_transactions', 'scenarios', 'backtests', 'finance_summary', 'finance_transactions']),
  format: z.enum(['csv', 'pdf']),
  portfolioId: z.coerce.number().int().positive().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
}).superRefine((value, context) => {
  if (value.reportType === 'portfolio_transactions' && !value.portfolioId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['portfolioId'], message: 'Portfolio ID is required' });
  }
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must not precede start date' });
  }
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
