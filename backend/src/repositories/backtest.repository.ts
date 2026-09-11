import { db, IDatabaseExecutor } from '../database/db';

export class BacktestRepository {
  static async create(userId: string, data: any, executor: IDatabaseExecutor = db) {
    const result = await executor.query(`INSERT INTO backtests (user_id,name,strategy_type,base_currency,start_date,end_date,initial_amount,parameters) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;`, [userId, data.name, data.strategyType, data.baseCurrency, data.startDate, data.endDate, data.initialAmount, JSON.stringify(data.parameters || {})]);
    return result.rows[0];
  }
  static async saveResult(backtestId: string | number, value: any, executor: IDatabaseExecutor = db) {
    const result = await executor.query(`INSERT INTO backtest_results (backtest_id,total_invested,final_value,absolute_return,return_percentage,cagr,xirr,volatility,max_drawdown,sharpe_ratio,benchmark_return,benchmark_difference,time_series) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *;`, [backtestId,value.total_invested,value.final_value,value.absolute_return,value.return_percentage,value.cagr,value.xirr,value.volatility,value.max_drawdown,value.sharpe_ratio,value.benchmark_return,value.benchmark_difference,JSON.stringify(value.time_series)]);
    return result.rows[0];
  }
  static async list(userId: string) { return (await db.query(`SELECT b.id AS canonical_backtest_id, b.*, r.* FROM backtests b LEFT JOIN backtest_results r ON r.backtest_id=b.id WHERE b.user_id=$1 ORDER BY b.created_at DESC;`, [userId])).rows; }
  static async find(id: string | number, userId: string, executor: IDatabaseExecutor = db) { return (await executor.query(`SELECT b.id AS canonical_backtest_id, b.*, r.* FROM backtests b LEFT JOIN backtest_results r ON r.backtest_id=b.id WHERE b.id=$1 AND b.user_id=$2;`, [id,userId])).rows[0] || null; }
  static async delete(id: string | number, userId: string) { await db.query(`DELETE FROM backtests WHERE id=$1 AND user_id=$2;`, [id,userId]); }
}
