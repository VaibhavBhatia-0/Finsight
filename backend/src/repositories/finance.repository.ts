import { db } from '../database/db';

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
    notes?: string;
  }): Promise<any> {
    const res = await db.query(`
      INSERT INTO finance_transactions (
        user_id, transaction_type, category, amount, currency,
        description, transaction_date, recurring, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      data.notes || null,
    ]);
    return res.rows[0];
  }

  static async getTransactions(userId: string, options?: {
    type?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
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
    const res = await db.query(sql, params);
    return res.rows;
  }

  static async deleteTransaction(id: string | number, userId: string): Promise<void> {
    await db.query(`DELETE FROM finance_transactions WHERE id = $1 AND user_id = $2;`, [id, userId]);
  }

  static async updateTransaction(id: string | number, userId: string, data: { category: string; amount: number; description?: string; transactionDate: string }): Promise<any> {
    const res = await db.query(`UPDATE finance_transactions SET category=$1, amount=$2, description=$3, transaction_date=$4 WHERE id=$5 AND user_id=$6 RETURNING *;`, [data.category, data.amount, data.description || null, data.transactionDate, id, userId]);
    return res.rows[0] || null;
  }

  // --- BUDGETS ---
  static async createBudget(userId: string, data: {
    category: string;
    amount: number;
    startDate: string;
    endDate: string;
  }): Promise<any> {
    const res = await db.query(`
      INSERT INTO budgets (user_id, category, amount, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [userId, data.category, data.amount, data.startDate, data.endDate]);
    return res.rows[0];
  }

  static async getBudgets(userId: string): Promise<any[]> {
    const res = await db.query(`
      SELECT * FROM budgets
      WHERE user_id = $1
      ORDER BY start_date DESC;
    `, [userId]);
    return res.rows;
  }

  static async deleteBudget(id: string | number, userId: string): Promise<void> {
    await db.query(`DELETE FROM budgets WHERE id = $1 AND user_id = $2;`, [id, userId]);
  }

  static async updateBudget(id: string | number, userId: string, data: { category: string; amount: number; startDate: string; endDate: string }): Promise<any> {
    const res = await db.query(`UPDATE budgets SET category=$1, amount=$2, start_date=$3, end_date=$4 WHERE id=$5 AND user_id=$6 RETURNING *;`, [data.category, data.amount, data.startDate, data.endDate, id, userId]);
    return res.rows[0] || null;
  }

  // --- SAVINGS GOALS ---
  static async createSavingsGoal(userId: string, data: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
  }): Promise<any> {
    const res = await db.query(`
      INSERT INTO savings_goals (user_id, name, target_amount, current_amount, target_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [userId, data.name, data.targetAmount, data.currentAmount || 0, data.targetDate || null]);
    return res.rows[0];
  }

  static async getSavingsGoals(userId: string): Promise<any[]> {
    const res = await db.query(`
      SELECT * FROM savings_goals
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `, [userId]);
    return res.rows;
  }

  static async updateSavingsGoalProgress(id: string | number, userId: string, currentAmount: number): Promise<any> {
    const res = await db.query(`
      UPDATE savings_goals
      SET current_amount = $1
      WHERE id = $2 AND user_id = $3
      RETURNING *;
    `, [currentAmount, id, userId]);
    return res.rows[0];
  }

  static async updateSavingsGoal(id: string | number, userId: string, data: { name: string; targetAmount: number; currentAmount: number; targetDate?: string }): Promise<any> {
    const res = await db.query(`UPDATE savings_goals SET name=$1, target_amount=$2, current_amount=$3, target_date=$4 WHERE id=$5 AND user_id=$6 RETURNING *;`, [data.name, data.targetAmount, data.currentAmount, data.targetDate || null, id, userId]);
    return res.rows[0] || null;
  }

  static async deleteSavingsGoal(id: string | number, userId: string): Promise<void> {
    await db.query(`DELETE FROM savings_goals WHERE id = $1 AND user_id = $2;`, [id, userId]);
  }
}
