import { z } from 'zod';

export const marketAlertCondition = z.enum(['PRICE_ABOVE', 'PRICE_BELOW', 'DAILY_CHANGE_ABOVE', 'DAILY_CHANGE_BELOW', 'RSI_ABOVE', 'RSI_BELOW']);
export const marketAlertIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
export const marketAlertQuerySchema = z.object({ stockId: z.coerce.number().int().positive().optional() });
export const createMarketAlertSchema = z.object({
  stockId: z.coerce.number().int().positive(), condition: marketAlertCondition,
  threshold: z.coerce.number().finite(), enabled: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.condition.startsWith('PRICE_') && value.threshold <= 0) context.addIssue({ code: 'custom', path: ['threshold'], message: 'Price thresholds must be positive' });
  if (value.condition.startsWith('RSI_') && (value.threshold < 0 || value.threshold > 100)) context.addIssue({ code: 'custom', path: ['threshold'], message: 'RSI thresholds must be between 0 and 100' });
  if (value.condition.startsWith('DAILY_CHANGE_') && (value.threshold < -100 || value.threshold > 1000)) context.addIssue({ code: 'custom', path: ['threshold'], message: 'Daily-change threshold is outside the supported range' });
});
export const updateMarketAlertSchema = z.object({ condition: marketAlertCondition.optional(), threshold: z.coerce.number().finite().optional(), enabled: z.boolean().optional() }).refine(value => Object.keys(value).length > 0, 'At least one alert setting is required');
