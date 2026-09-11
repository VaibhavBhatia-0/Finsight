import { db, IDatabaseExecutor } from '../database/db';

export class ScenarioRepository {
  static async create(userId: string, data: {
    name: string;
    scenarioType: 'SINGLE_INVESTMENT' | 'RECURRING_INVESTMENT' | 'PORTFOLIO_SCENARIO';
    baseCurrency: string;
    startDate: string;
    endDate: string;
    initialAmount: number;
    contributionFrequency?: string | null;
    taxRuleId?: string | number | null;
    benchmarkId?: string | number | null;
    assumptions?: any;
  }, executor: IDatabaseExecutor = db): Promise<any> {
    const res = await executor.query(`
      INSERT INTO scenarios (
        user_id, name, scenario_type, base_currency, start_date, end_date,
        initial_amount, contribution_frequency, tax_rule_id, benchmark_id, assumptions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `, [
      userId,
      data.name,
      data.scenarioType,
      data.baseCurrency,
      data.startDate,
      data.endDate,
      data.initialAmount,
      data.contributionFrequency || null,
      data.taxRuleId || null,
      data.benchmarkId || null,
      JSON.stringify(data.assumptions || {}),
    ]);
    return res.rows[0];
  }

  static async addAsset(scenarioId: string | number, stockId: string | number, targetWeight?: number, initialAmount?: number, executor: IDatabaseExecutor = db): Promise<{ id: string }> {
    const result = await executor.query<{ id: string }>(`
      INSERT INTO scenario_assets (scenario_id, stock_id, target_weight, initial_amount)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (scenario_id, stock_id) DO UPDATE
      SET target_weight = EXCLUDED.target_weight,
          initial_amount = EXCLUDED.initial_amount
      RETURNING id;
    `, [scenarioId, stockId, targetWeight ?? null, initialAmount ?? null]);
    return result.rows[0];
  }

  static async saveResult(scenarioId: string | number, result: any, executor: IDatabaseExecutor = db): Promise<any> {
    const res = await executor.query(`
      INSERT INTO simulation_results (
        scenario_id, initial_value, final_value, gross_value, gross_profit,
        net_value, net_profit, dividends, fees, estimated_tax, fx_impact,
        return_percentage, cagr, xirr, volatility, sharpe_ratio, max_drawdown,
        benchmark_return, benchmark_difference, asset_return, attribution
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *;
    `, [
      scenarioId,
      result.financials.initial_investment,
      result.financials.net_value,
      result.financials.gross_value,
      result.financials.gross_profit,
      result.financials.net_value,
      result.financials.net_profit,
      result.financials.dividends,
      result.financials.fees,
      result.financials.estimated_tax,
      result.fx?.fx_impact || 0,
      result.financials.net_return_percentage,
      result.risk_metrics?.cagr || 0,
      result.risk_metrics?.xirr || null,
      result.risk_metrics?.volatility || 0,
      result.risk_metrics?.sharpe_ratio || 0,
      result.risk_metrics?.max_drawdown || 0,
      result.risk_metrics?.benchmark_return || 0,
      result.risk_metrics?.benchmark_difference || 0,
      result.attribution?.asset_return_amount || 0,
      JSON.stringify(result.attribution || {}),
    ]);
    return res.rows[0];
  }

  static async addContribution(
    scenarioId: string | number,
    scenarioAssetId: string | number,
    contribution: { date: string; amount: number; currency: string },
    executor: IDatabaseExecutor = db,
  ): Promise<void> {
    await executor.query(`
      INSERT INTO scenario_contributions (scenario_id, scenario_asset_id, contribution_date, amount, currency)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (scenario_id, contribution_date, scenario_asset_id) DO UPDATE
      SET amount = EXCLUDED.amount, currency = EXCLUDED.currency;
    `, [scenarioId, scenarioAssetId, contribution.date, contribution.amount, contribution.currency]);
  }

  static async addComparison(
    scenarioId: string | number,
    comparedScenarioId: string | number,
    executor: IDatabaseExecutor = db,
  ): Promise<void> {
    await executor.query(`
      INSERT INTO scenario_comparisons (scenario_id, compared_scenario_id)
      VALUES ($1, $2)
      ON CONFLICT (scenario_id, compared_scenario_id) DO NOTHING;
    `, [scenarioId, comparedScenarioId]);
  }

  static async findByUserId(userId: string): Promise<any[]> {
    const res = await db.query(`
      SELECT 
        s.*,
        sr.final_value,
        sr.net_profit,
        sr.return_percentage,
        sr.cagr,
        sr.volatility,
        sr.sharpe_ratio,
        sr.max_drawdown,
        b.code as benchmark_code
      FROM scenarios s
      LEFT JOIN simulation_results sr ON s.id = sr.scenario_id
      LEFT JOIN benchmarks b ON s.benchmark_id = b.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC;
    `, [userId]);
    return res.rows;
  }

  static async findById(id: string | number, userId: string): Promise<any | null> {
    const sRes = await db.query(`
      SELECT s.*, b.code as benchmark_code, b.name as benchmark_name
      FROM scenarios s
      LEFT JOIN benchmarks b ON s.benchmark_id = b.id
      WHERE s.id = $1 AND s.user_id = $2;
    `, [id, userId]);

    if (sRes.rows.length === 0) return null;
    const scenario = sRes.rows[0];

    const assetsRes = await db.query(`
      SELECT sa.*, st.symbol, st.company_name, st.currency
      FROM scenario_assets sa
      JOIN stocks st ON sa.stock_id = st.id
      WHERE sa.scenario_id = $1;
    `, [id]);

    const resultRes = await db.query(`
      SELECT * FROM simulation_results
      WHERE scenario_id = $1
      ORDER BY calculated_at DESC
      LIMIT 1;
    `, [id]);

    const contributionsRes = await db.query(`
      SELECT sc.*, sa.stock_id
      FROM scenario_contributions sc
      LEFT JOIN scenario_assets sa ON sc.scenario_asset_id = sa.id
      WHERE sc.scenario_id = $1
      ORDER BY sc.contribution_date ASC, sc.id ASC;
    `, [id]);

    const comparisonsRes = await db.query<{ scenario_id: string }>(`
      SELECT CASE WHEN scenario_id = $1 THEN compared_scenario_id ELSE scenario_id END AS scenario_id
      FROM scenario_comparisons
      WHERE scenario_id = $1 OR compared_scenario_id = $1
      ORDER BY created_at ASC, id ASC;
    `, [id]);

    return {
      ...scenario,
      assets: assetsRes.rows,
      contributions: contributionsRes.rows,
      comparisonIds: comparisonsRes.rows.map(row => row.scenario_id),
      result: resultRes.rows[0] || null,
    };
  }

  static async delete(id: string | number, userId: string): Promise<void> {
    await db.query(`DELETE FROM scenarios WHERE id = $1 AND user_id = $2;`, [id, userId]);
  }
}
