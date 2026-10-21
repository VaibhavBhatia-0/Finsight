import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/database/db';
import { UserPreferencesRepository } from '../../src/repositories/userPreferences.repository';

const storedRow = {
  id: '1', user_id: 'user-1', theme: 'system', default_currency: 'INR', default_benchmark_id: null,
  dashboard_layout: { sections: [{ id: 'summary', order: 1, visible: true }] },
  selected_market_indices: ['NIFTY_50', 'SENSEX'],
  watchlist_preferences: { sortBy: 'symbol', sortOrder: 'asc' },
  tax_residency: null, tax_status: null, created_at: '2026-01-01', updated_at: '2026-01-01',
};

describe('UserPreferencesRepository.update', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends untouched JSONB columns as JSON text, not as node-postgres array literals', async () => {
    const query = vi.spyOn(db, 'query')
      .mockResolvedValueOnce({ rows: [storedRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [storedRow], rowCount: 1 });

    await UserPreferencesRepository.update('user-1', { theme: 'dark' });

    const params = query.mock.calls[1][1] as unknown[];
    expect(params[3]).toBe(JSON.stringify(storedRow.dashboard_layout));
    expect(params[4]).toBe('["NIFTY_50","SENSEX"]');
    expect(params[5]).toBe(JSON.stringify(storedRow.watchlist_preferences));
  });
});
