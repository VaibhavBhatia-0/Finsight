import { FinanceRecurringRuleRow, FinanceRepository } from '../repositories/finance.repository';
import { UserPreferencesRepository } from '../repositories/userPreferences.repository';
import { UserRepository } from '../repositories/user.repository';
import { FXService } from './fx.service';
import { AppError } from '../middleware/errorHandler';
import { db, IDatabaseExecutor } from '../database/db';

export class FinanceService {
  public static async getTransactions(userId: string, options?: { type?: string; category?: string; startDate?: string; endDate?: string }) {
    await this.materializeRecurringTransactions(userId);
    return FinanceRepository.getTransactions(userId, options);
  }

  public static async createRecurringRule(userId: string, data: Parameters<typeof FinanceRepository.createRecurringRule>[1]) {
    return db.transaction(async executor => {
      const rule = await FinanceRepository.createRecurringRule(userId, data, executor);
      const occurrences = await this.materializeRule(userId, rule, executor);
      return { rule, occurrences };
    });
  }

  public static async materializeRecurringTransactions(userId: string): Promise<number> {
    return db.transaction(async executor => {
      const rules = (await FinanceRepository.getRecurringRules(userId, executor)).filter(rule => rule.active);
      let created = 0;
      for (const rule of rules) created += (await this.materializeRule(userId, rule, executor)).length;
      return created;
    });
  }

  private static async materializeRule(userId: string, rule: FinanceRecurringRuleRow, executor: IDatabaseExecutor) {
    const today = new Date().toISOString().slice(0, 10);
    const ruleEnd = rule.end_date ? toIsoDate(rule.end_date) : today;
    const throughDate = ruleEnd < today ? ruleEnd : today;
    const dates = recurrenceDates(toIsoDate(rule.start_date), throughDate, rule.frequency);
    const created = [];
    for (const date of dates) {
      const occurrence = await FinanceRepository.addRecurringOccurrence(userId, rule, date, executor);
      if (occurrence) created.push(occurrence);
    }
    return created;
  }

  /**
   * Rule-based category suggestion engine.
   */
  public static suggestCategory(description: string): { suggestedCategory: string; confidence: number } {
    const desc = description.toLowerCase();

    const rules: Array<{ keywords: string[]; category: string; confidence: number }> = [
      { keywords: ['salary', 'payroll', 'stipend', 'bonus', 'dividend', 'interest'], category: 'Income', confidence: 0.95 },
      { keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'starbucks', 'mcdonalds', 'dining', 'food'], category: 'Food & Dining', confidence: 0.90 },
      { keywords: ['uber', 'ola', 'metro', 'petrol', 'fuel', 'railway', 'irctc', 'flight', 'cab'], category: 'Transportation', confidence: 0.90 },
      { keywords: ['rent', 'maintenance', 'electricity', 'water', 'gas bill', 'broadband', 'wifi'], category: 'Housing & Utilities', confidence: 0.90 },
      { keywords: ['amazon', 'flipkart', 'myntra', 'zara', 'shopping', 'clothing', 'retail'], category: 'Shopping', confidence: 0.85 },
      { keywords: ['netflix', 'spotify', 'prime', 'cinema', 'movie', 'concert', 'gaming'], category: 'Entertainment', confidence: 0.85 },
      { keywords: ['hospital', 'pharmacy', 'medicine', 'doctor', 'clinic', 'health', 'apollo'], category: 'Healthcare', confidence: 0.85 },
      { keywords: ['course', 'udemy', 'tuition', 'books', 'education', 'college'], category: 'Education', confidence: 0.85 },
      { keywords: ['mutual fund', 'sip', 'stock', 'investment', 'zerodha', 'groww'], category: 'Investments', confidence: 0.90 },
    ];

    for (const rule of rules) {
      if (rule.keywords.some(kw => desc.includes(kw))) {
        return { suggestedCategory: rule.category, confidence: rule.confidence };
      }
    }

    return { suggestedCategory: 'Miscellaneous', confidence: 0.50 };
  }

  /**
   * Financial Summary & Investable Surplus.
   */
  public static async getSummary(userId: string) {
    await this.materializeRecurringTransactions(userId);
    const [transactions, budgets, goals, goalContributions, preferences, user] = await Promise.all([
      FinanceRepository.getTransactions(userId),
      FinanceRepository.getBudgets(userId),
      FinanceRepository.getSavingsGoals(userId),
      FinanceRepository.getSavingsGoalContributions(userId),
      UserPreferencesRepository.getByUserId(userId),
      UserRepository.findById(userId),
    ]);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const currency = (preferences?.default_currency || user.base_currency).toUpperCase();
    let hasSyntheticFx = false;
    const convertedAmounts = new Map<string, number>();
    for (const tx of transactions) {
      const sourceCurrency = tx.currency.toUpperCase();
      const amount = Number(tx.amount);
      if (sourceCurrency === currency) {
        convertedAmounts.set(tx.id, amount);
        continue;
      }
      const rateInfo = await FXService.getRateInfo(sourceCurrency, currency, toIsoDate(tx.transaction_date));
      hasSyntheticFx ||= rateInfo.freshness === 'Synthetic';
      convertedAmounts.set(tx.id, amount * rateInfo.rate);
    }

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown: Record<string, number> = {};

    for (const tx of transactions) {
      const amt = convertedAmounts.get(tx.id) ?? 0;
      if (tx.transaction_type === 'INCOME') {
        totalIncome += amt;
      } else if (tx.transaction_type === 'EXPENSE') {
        totalExpense += amt;
        const cat = tx.category || 'Uncategorized';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
      }
    }

    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Active savings goals commitment
    let totalGoalsTarget = 0;
    let totalGoalsSaved = 0;
    for (const g of goals) {
      totalGoalsTarget += Number(g.target_amount);
      totalGoalsSaved += Number(g.current_amount);
    }

    // Estimated Investable Surplus for FinSight Lab
    const estimatedInvestableSurplus = Math.max(0, netSavings);

    // Budget performance
    const budgetPerformance = budgets.map((b) => {
      const budgetAmt = Number(b.amount);
      // Filter expenses in this budget's category and date range
      const spent = transactions
        .filter(t => {
          const date = toIsoDate(t.transaction_date);
          return t.transaction_type === 'EXPENSE' && t.category === b.category && date >= toIsoDate(b.start_date) && date <= toIsoDate(b.end_date);
        })
        .reduce((sum, t) => sum + (convertedAmounts.get(t.id) ?? 0), 0);

      const remaining = budgetAmt - spent;
      const spentPercent = budgetAmt > 0 ? (spent / budgetAmt) * 100 : 0;

      return {
        id: b.id,
        category: b.category,
        budgetAmount: budgetAmt,
        spentAmount: round2(spent),
        remainingAmount: round2(remaining),
        spentPercentage: round2(spentPercent),
        isExceeded: spent > budgetAmt,
        startDate: toIsoDate(b.start_date),
        endDate: toIsoDate(b.end_date),
      };
    });

    const asOfDate = new Date().toISOString().slice(0, 10);
    const goalsWithProgress = goals.map((g) => {
      const target = Number(g.target_amount);
      const current = Number(g.current_amount);
      const progressPct = target > 0 ? (current / target) * 100 : 0;
      const projection = calculateGoalProjection(
        { currentAmount: current, targetAmount: target, targetDate: g.target_date ? toIsoDate(g.target_date) : null },
        goalContributions.filter(contribution => contribution.goal_id === g.id).map(contribution => ({ amount: Number(contribution.amount), date: toIsoDate(contribution.contribution_date) })),
        asOfDate,
      );
      return {
        id: g.id,
        name: g.name,
        targetAmount: target,
        currentAmount: current,
        remainingAmount: Math.max(0, target - current),
        progressPercentage: round2(progressPct),
        targetDate: g.target_date ? toIsoDate(g.target_date) : null,
        ...projection,
      };
    });

    return {
      currency,
      calculation: {
        method: 'HISTORICAL_TRANSACTION_DATE_FX',
        hasSyntheticFx,
      },
      overview: {
        totalIncome: round2(totalIncome),
        totalExpense: round2(totalExpense),
        netSavings: round2(netSavings),
        savingsRate: round2(savingsRate),
        estimatedInvestableSurplus: round2(estimatedInvestableSurplus),
      },
      categoryBreakdown,
      budgets: budgetPerformance,
      goals: goalsWithProgress,
    };
  }
}

export function calculateGoalProjection(
  goal: { currentAmount: number; targetAmount: number; targetDate: string | null },
  contributions: Array<{ amount: number; date: string }>,
  asOfDate: string,
) {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const ordered = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
  const monthlyContributionRate = ordered.length
    ? round2(ordered.reduce((sum, item) => sum + item.amount, 0) / inclusiveMonths(ordered[0].date, ordered[ordered.length - 1].date))
    : 0;
  const monthsToGoal = remaining === 0 ? 0 : monthlyContributionRate > 0 ? Math.ceil(remaining / monthlyContributionRate) : null;
  const projectedCompletionDate = monthsToGoal === null ? null : addMonths(asOfDate, monthsToGoal);
  const availableMonths = goal.targetDate && goal.targetDate > asOfDate ? Math.max(1, inclusiveMonths(asOfDate, goal.targetDate) - 1) : null;
  const requiredMonthlyContribution = remaining === 0 ? 0 : availableMonths ? round2(remaining / availableMonths) : null;
  return { monthlyContributionRate, monthsToGoal, projectedCompletionDate, requiredMonthlyContribution };
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function toIsoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function recurrenceDates(startDate: string, endDate: string, frequency: FinanceRecurringRuleRow['frequency']): string[] {
  if (startDate > endDate) return [];
  const results: string[] = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const originalDay = cursor.getUTCDate();
  while (cursor <= end) {
    results.push(cursor.toISOString().slice(0, 10));
    if (results.length >= 1200) throw new AppError('Recurring rule exceeds 1,200 occurrences', 400, 'RECURRENCE_TOO_LARGE');
    if (frequency === 'WEEKLY') {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      const months = frequency === 'MONTHLY' ? 1 : frequency === 'QUARTERLY' ? 3 : 12;
      cursor = addMonthsUtc(cursor, months, originalDay);
    }
  }
  return results;
}

function addMonthsUtc(value: Date, months: number, day: number): Date {
  const target = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function inclusiveMonths(start: string, end: string): number {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  return Math.max(1, (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1);
}

function addMonths(date: string, months: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  return addMonthsUtc(value, months, value.getUTCDate()).toISOString().slice(0, 10);
}
