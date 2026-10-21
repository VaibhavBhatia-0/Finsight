import { describe, expect, it } from 'vitest';
import { trailingDividendYield } from '../../src/services/marketData.service';

describe('trailingDividendYield', () => {
  const dividends = [
    { ex_date: '2025-08-14', amount: 5.5, currency: 'INR' },
    { ex_date: '2026-06-05', amount: 6, currency: 'INR' },
    { ex_date: '2024-08-19', amount: 5, currency: 'INR' },
  ];

  it('sums only dividends in the trailing year before the quote date', () => {
    expect(trailingDividendYield(dividends, 1200, 'INR', '2026-10-21T10:00:00.000Z')).toBe(0.5);
  });

  it('returns null rather than 0% when nothing was reported in the window', () => {
    expect(trailingDividendYield(dividends, 1200, 'INR', '2028-01-01')).toBeNull();
  });

  it('ignores dividends in another currency and non-positive prices', () => {
    expect(trailingDividendYield([{ ex_date: '2026-06-05', amount: 1, currency: 'USD' }], 100, 'INR', '2026-10-21')).toBeNull();
    expect(trailingDividendYield(dividends, 0, 'INR', '2026-10-21')).toBeNull();
  });
});
