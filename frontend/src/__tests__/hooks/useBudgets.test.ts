import { describe, expect, test } from 'vitest';
import { fetchBudgets } from '../../hooks/useBudgets';

describe('budget API contract', () => {
  test('unwraps the canonical envelope and maps database fields', async () => {
    const budgets = await fetchBudgets();
    expect(budgets).toHaveLength(2);
    expect(budgets[0]).toEqual({ id: '1', category: 'Housing', amount: 2000, startDate: '2024-01-01', endDate: '2024-01-31' });
  });
});
