import { FinanceRepository } from '../repositories/finance.repository';

export class FinanceService {
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
    const transactions = await FinanceRepository.getTransactions(userId);
    const budgets = await FinanceRepository.getBudgets(userId);
    const goals = await FinanceRepository.getSavingsGoals(userId);

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown: Record<string, number> = {};

    for (const tx of transactions) {
      const amt = Number(tx.amount);
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
        .filter(t => t.transaction_type === 'EXPENSE' && t.category === b.category && t.transaction_date >= b.start_date && t.transaction_date <= b.end_date)
        .reduce((sum, t) => sum + Number(t.amount), 0);

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
        startDate: b.start_date,
        endDate: b.end_date,
      };
    });

    const goalsWithProgress = goals.map((g) => {
      const target = Number(g.target_amount);
      const current = Number(g.current_amount);
      const progressPct = target > 0 ? (current / target) * 100 : 0;
      return {
        id: g.id,
        name: g.name,
        targetAmount: target,
        currentAmount: current,
        remainingAmount: Math.max(0, target - current),
        progressPercentage: round2(progressPct),
        targetDate: g.target_date,
      };
    });

    return {
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

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

