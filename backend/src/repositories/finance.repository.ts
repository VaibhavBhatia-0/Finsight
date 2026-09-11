import { db, IDatabaseExecutor } from '../database/db';

export interface FinanceTransactionRow {
  id: string;
  user_id: string;
  transaction_type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string | null;
  amount: number | string;
  currency: string;
  description: string | null;
  transaction_date: string | Date;
  recurring: boolean;
  notes: string | null;
  created_at: string;
  recurring_rule_id: string | null;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  category: string;
  amount: number | string;
  start_date: string | Date;
  end_date: string | Date;
  created_at: string;
}

export interface SavingsGoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  target_date: string | Date | null;
  created_at: string;
}

export interface FinanceRecurringRuleRow {
  id: string;
  user_id: string;
  transaction_type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string;
  amount: number | string;
  currency: string;
  description: string | null;
  start_date: string | Date;
  end_date: string | Date | null;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalContributionRow {
  id: string;
  goal_id: string;
  amount: number | string;
  contribution_date: string | Date;
  notes: string | null;
  created_at: string;
}

export class FinanceRepository {
  // --- TRANSACTIONS ---
  static async addTransaction(userId: string, data: {
    transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    category: string;
    amount: number;
    currency?: string;
    description?: string;
    transactionDate: string;
    recurring?: boolean;
    recurringRuleId?: string | number;
    notes?: string;
  }, executor: IDatabaseExecutor = db): Promise<FinanceTransactionRow> {
    const res = await executor.query<FinanceTransactionRow>(`
      INSERT INTO finance_transactions (
        user_id, transaction_type, category, amount, currency,
        description, transaction_date, recurring, recurring_rule_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `, [
      userId,
      data.transactionType,
      data.category,
      data.amount,
      data.currency || 'INR',
      data.description || null,
      data.transactionDate,
      data.recurring || false,
      data.recurringRuleId || null,
      data.notes || null,
    ]);
    return res.rows[0];
  }

  static async addRecurringOccurrence(userId: string, rule: FinanceRecurringRuleRow, date: string, executor: IDatabaseExecutor = db): Promise<FinanceTransactionRow | null> {
    const result = await executor.query<FinanceTransactionRow>(`
      INSERT INTO finance_transactions (
        user_id, transaction_type, category, amount, currency, description,
        transaction_date, recurring, recurring_rule_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9)
      ON CONFLICT (recurring_rule_id, transaction_date) WHERE recurring_rule_id IS NOT NULL DO NOTHING
      RETURNING *;
    `, [userId, rule.transaction_type, rule.category, rule.amount, rule.currency, rule.description, date, rule.id, rule.notes]);
    return result.rows[0] || null;
  }

  static async createRecurringRule(userId: string, data: {
    transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    category: string;
    amount: number;
    currency: string;
    description?: string;
    startDate: string;
    endDate?: string;
    frequency: FinanceRecurringRuleRow['frequency'];
    notes?: string;
  }, executor: IDatabaseExecutor = db): Promise<FinanceRecurringRuleRow> {
    const result = await executor.query<FinanceRecurringRuleRow>(`
      INSERT INTO finance_recurring_rules (
        user_id, transaction_type, category, amount, currency, description,
        start_date, end_date, frequency, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `, [userId, data.transactionType, data.category, data.amount, data.currency, data.description || null, data.startDate, data.endDate || null, data.frequency, data.notes || null]);
    return result.rows[0];
  }

  static async getRecurringRules(userId: string, executor: IDatabaseExecutor = db): Promise<FinanceRecurringRuleRow[]> {
    const result = await executor.query<FinanceRecurringRuleRow>(`
      SELECT * FROM finance_recurring_rules WHERE user_id = $1 ORDER BY created_at DESC;
    `, [userId]);
    return result.rows;
  }

  static async deactivateRecurringRule(id: string | number, userId: string): Promise<FinanceRecurringRuleRow | null> {
    const result = await db.query<FinanceRecurringRuleRow>(`
      UPDATE finance_recurring_rules SET active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 RETURNING *;
    `, [id, userId]);
    return result.rows[0] || null;
  }

  static async getTransactions(userId: string, options?: {
    type?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FinanceTransactionRow[]> {
    let sql = `SELECT * FROM finance_transactions WHERE user_id = $1`;
    const params: any[] = [userId];

    if (options?.type) {
      params.push(options.type);
      sql += ` AND transaction_type = $${params.length}`;
    }
    if (options?.category) {
      params.push(options.category);
      sql += ` AND category = $${params.length}`;
    }
    if (options?.startDate) {
      params.push(options.startDate);
      sql += ` AND transaction_date >= $${params.length}`;
    }
    if (options?.endDate) {
      params.push(options.endDate);
      sql += ` AND transaction_date <= $${params.length}`;
    }

    sql += ` ORDER BY transaction_date DESC, created_at DESC;`;
    const res = await db.query<FinanceTransactionRow>(sql, params);
    return res.rows;
  }

  static async deleteTransaction(id: string | number, userId: string): Promise<void> {
    await db.query(`DELETE FROM finance_transactions WHERE id = $1 AND user_id = $2;`, [id, userId]);
  }

  static async updateTransaction(id: string | number, userId: string, data: { category: string; amount: number; description?: string; transactionDate: string }): Promise<FinanceTransactionRow | null> {
    const res = await db.query<FinanceTransactionRow>(`UPDATE finance_transactions SET category=$1, amount=$2, description=$3, transaction_date=$4 WHERE id=$5 AND user_id=$6 RETURNING *;`, [data.category, data.amount, data.description || null, data.transactionDate, id, userId]);
    return res.rows[0] || null;
  }

  // --- BUDGETS ---
  static async createBudget(userId: string, data: {
    category: string;
    amount: number;
    startDate: string;
    endDate: string;
  }): Promise<BudgetRow> {
    const res = await db.query<BudgetRow>(`
      INSERT INTO budgets (user_id, category, amount, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [userId, data.category, data.amount, data.startDate, data.endDate]);
    return res.rows[0];
  }

  static async getBudgets(userId: string): Promise<BudgetRow[]> {
    const res = await db.query<BudgetRow>(`
      SELECT * FROM budgets
      WHERE user_id = $1
      ORDER BY start_date DESC;
    `, [userId]);
    return res.rows;
  }

  static async deleteBudget(id: string | number, userId: string): Promise<void> {
    await db.query(`DELETE FROM budgets WHERE id = $1 AND user_id = $2;`, [id, userId]);
  }

  static async updateBudget(id: string | number, userId: string, data: { category: string; amount: number; startDate: string; endDate: string }): Promise<BudgetRow | null> {
    const res = await db.query<BudgetRow>(`UPDATE budgets SET category=$1, amount=$2, start_date=$3, end_date=$4 WHERE id=$5 AND user_id=$6 RETURNING *;`, [data.category, data.amount, data.startDate, data.endDate, id, userId]);
    return res.rows[0] || null;
  }

  // --- SAVINGS GOALS ---
  static async createSavingsGoal(userId: string, data: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
  }): Promise<SavingsGoalRow> {
    const res = await db.query<SavingsGoalRow>(`
      INSERT INTO savings_goals (user_id, name, target_amount, current_amount, target_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [userId, data.name, data.targetAmount, data.currentAmount || 0, data.targetDate || null]);
    return res.rows[0];
  }

  static async getSavingsGoals(userId: string): Promise<SavingsGoalRow[]> {
    const res = await db.query<SavingsGoalRow>(`
      SELECT * FROM savings_goals
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `, [userId]);
    return res.rows;
  }

  static async updateSavingsGoalProgress(id: string | number, userId: string, currentAmount: number): Promise<SavingsGoalRow | null> {
    const res = await db.query<SavingsGoalRow>(`
      UPDATE savings_goals
      SET current_amount = $1
      WHERE id = $2 AND user_id = $3
      RETURNING *;
    `, [currentAmount, id, userId]);
    return res.rows[0];
  }

  static async updateSavingsGoal(id: string | number, userId: string, data: { name: string; targetAmount: number; currentAmount: number; targetDate?: string }): Promise<SavingsGoalRow | null> {
    const res = await db.query<SavingsGoalRow>(`UPDATE savings_goals SET name=$1, target_amount=$2, current_amount=$3, target_date=$4 WHERE id=$5 AND user_id=$6 RETURNING *;`, [data.name, data.targetAmount, data.currentAmount, data.targetDate || null, id, userId]);
    return res.rows[0] || null;
  }

  static async deleteSavingsGoal(id: string | number, userId: string): Promise<void> {
    await db.query(`DELETE FROM savings_goals WHERE id = $1 AND user_id = $2;`, [id, userId]);
  }

  static async getSavingsGoalContributions(userId: string): Promise<SavingsGoalContributionRow[]> {
    const result = await db.query<SavingsGoalContributionRow>(`
      SELECT sgc.* FROM savings_goal_contributions sgc
      JOIN savings_goals sg ON sg.id = sgc.goal_id
      WHERE sg.user_id = $1
      ORDER BY sgc.contribution_date ASC, sgc.created_at ASC;
    `, [userId]);
    return result.rows;
  }

  static async addSavingsGoalContribution(id: string | number, userId: string, data: { amount: number; contributionDate: string; notes?: string }) {
    return db.transaction(async executor => {
      const goal = await executor.query<SavingsGoalRow>('SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2 FOR UPDATE;', [id, userId]);
      if (!goal.rows[0]) return null;
      const contribution = await executor.query<SavingsGoalContributionRow>(`
        INSERT INTO savings_goal_contributions (goal_id, amount, contribution_date, notes)
        VALUES ($1, $2, $3, $4) RETURNING *;
      `, [id, data.amount, data.contributionDate, data.notes || null]);
      const updated = await executor.query<SavingsGoalRow>(`
        UPDATE savings_goals SET current_amount = current_amount + $1 WHERE id = $2 RETURNING *;
      `, [data.amount, id]);
      return { contribution: contribution.rows[0], goal: updated.rows[0] };
    });
  }
}
