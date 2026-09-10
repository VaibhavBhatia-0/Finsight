import { describe, expect, test } from 'vitest';
import { fetchGoals } from '../../hooks/useGoals';

describe('goal API contract', () => {
  test('unwraps and normalizes savings goals', async () => {
    const goals = await fetchGoals();
    expect(goals[0]).toEqual({ id: '1', name: 'Emergency Fund', description: 'Emergency Fund', targetAmount: 5000, currentAmount: 1000, targetDate: '2025-01-01' });
  });
});
