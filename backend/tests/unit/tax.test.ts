import { beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';
import { TaxService } from '../../src/services/tax.service';

describe('effective-dated educational tax rules', () => {
  beforeAll(async () => {
    await runMigrations();
    await runSeeds();
  });

  it('selects Indian LTCG at exactly 365 holding days with the seeded exemption', async () => {
    const value = await TaxService.resolve({ jurisdiction: 'IN', assetType: 'EQUITY', acquisitionDate: '2024-07-24', disposalDate: '2025-07-24' });
    expect(value).toMatchObject({ taxType: 'LTCG', rate: 0.125, exemptionAmount: 125000, holdingPeriodDays: 365, methodology: 'EFFECTIVE_DATE_AND_HOLDING_PERIOD' });
  });

  it('selects Indian STCG below the long-term holding threshold', async () => {
    const value = await TaxService.resolve({ jurisdiction: 'IN', assetType: 'EQUITY', acquisitionDate: '2024-07-24', disposalDate: '2025-07-23' });
    expect(value).toMatchObject({ taxType: 'STCG', rate: 0.2, exemptionAmount: 0, holdingPeriodDays: 364 });
  });
});
