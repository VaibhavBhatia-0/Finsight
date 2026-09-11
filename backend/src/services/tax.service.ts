import { db } from '../database/db';
import { AppError } from '../middleware/errorHandler';

interface TaxRuleRow {
  id: string;
  jurisdiction: 'IN' | 'US';
  tax_type: string;
  asset_type: string | null;
  holding_period_min_days: number | null;
  rate: number | string | null;
  applicability: { exemption_limit?: number; description?: string };
  source_reference: string | null;
}

export class TaxService {
  static async resolve(input: {
    jurisdiction?: 'IN' | 'US';
    taxRuleId?: string | number;
    assetType: 'EQUITY';
    acquisitionDate: string;
    disposalDate: string;
  }) {
    const holdingPeriodDays = daysBetween(input.acquisitionDate, input.disposalDate);
    if (!input.jurisdiction && !input.taxRuleId) {
      return {
        applied: false, ruleId: null, jurisdiction: null, taxType: null, rate: 0,
        exemptionAmount: 0, holdingPeriodDays, sourceReference: null,
        methodology: 'NO_TAX_JURISDICTION_SELECTED' as const,
        disclaimer: 'Educational estimate only; not tax advice.',
      };
    }

    const result = input.taxRuleId
      ? await db.query<TaxRuleRow>(`
          SELECT * FROM tax_rules WHERE id = $1 AND asset_type = $2
            AND effective_from <= $3 AND (effective_to IS NULL OR effective_to >= $3)
            AND COALESCE(holding_period_min_days, 0) <= $4;
        `, [input.taxRuleId, input.assetType, input.disposalDate, holdingPeriodDays])
      : await db.query<TaxRuleRow>(`
          SELECT * FROM tax_rules WHERE jurisdiction = $1 AND asset_type = $2
            AND effective_from <= $3 AND (effective_to IS NULL OR effective_to >= $3)
            AND COALESCE(holding_period_min_days, 0) <= $4
          ORDER BY holding_period_min_days DESC NULLS LAST, effective_from DESC LIMIT 1;
        `, [input.jurisdiction, input.assetType, input.disposalDate, holdingPeriodDays]);
    const rule = result.rows[0];
    if (!rule) throw new AppError('No applicable effective-dated tax rule was found', 400, 'TAX_RULE_NOT_FOUND');
    if (input.jurisdiction && rule.jurisdiction !== input.jurisdiction) throw new AppError('Tax rule jurisdiction does not match the selected residency', 400, 'TAX_RULE_MISMATCH');

    return {
      applied: true,
      ruleId: rule.id,
      jurisdiction: rule.jurisdiction,
      taxType: rule.tax_type,
      rate: Number(rule.rate || 0),
      exemptionAmount: Number(rule.applicability?.exemption_limit || 0),
      holdingPeriodDays,
      sourceReference: rule.source_reference,
      methodology: 'EFFECTIVE_DATE_AND_HOLDING_PERIOD' as const,
      disclaimer: 'Educational estimate only; not tax advice.',
    };
  }
}

function daysBetween(start: string, end: string): number {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}
