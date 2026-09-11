import { FinanceService } from './finance.service';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { PortfolioService } from './portfolio.service';

export type InsightSeverity = 'positive' | 'warning' | 'info';
export type InsightBasis = 'LEDGER' | 'SYNTHETIC_MARKET_DATA';

export interface Insight {
  id: string;
  category: 'CASH_FLOW' | 'BUDGET' | 'GOAL' | 'PORTFOLIO';
  severity: InsightSeverity;
  title: string;
  message: string;
  basis: InsightBasis;
  metric?: { label: string; value: number; unit: string };
}

export class InsightsService {
  static async getInsights(userId: string) {
    const [finance, portfolios] = await Promise.all([
      FinanceService.getSummary(userId),
      PortfolioRepository.findByUserId(userId),
    ]);
    const insights: Insight[] = [];

    if (finance.overview.totalIncome === 0 && finance.overview.totalExpense > 0) {
      insights.push({
        id: 'cash-flow:no-recorded-income',
        category: 'CASH_FLOW',
        severity: 'warning',
        title: 'No income recorded',
        message: `Expenses total ${formatAmount(finance.overview.totalExpense, finance.currency)}, but no income transactions are recorded.`,
        basis: 'LEDGER',
        metric: { label: 'Net savings', value: finance.overview.netSavings, unit: finance.currency },
      });
    } else if (finance.overview.savingsRate < 0) {
      insights.push({
        id: 'cash-flow:negative-savings',
        category: 'CASH_FLOW',
        severity: 'warning',
        title: 'Spending exceeds income',
        message: `Recorded net savings are ${formatAmount(finance.overview.netSavings, finance.currency)}.`,
        basis: 'LEDGER',
        metric: { label: 'Savings rate', value: finance.overview.savingsRate, unit: '%' },
      });
    } else if (finance.overview.totalIncome > 0 && finance.overview.savingsRate >= 20) {
      insights.push({
        id: 'cash-flow:savings-rate',
        category: 'CASH_FLOW',
        severity: 'positive',
        title: 'Positive savings margin',
        message: `${finance.overview.savingsRate.toFixed(2)}% of recorded income remains after recorded expenses.`,
        basis: 'LEDGER',
        metric: { label: 'Savings rate', value: finance.overview.savingsRate, unit: '%' },
      });
    }

    for (const budget of finance.budgets.filter(item => item.isExceeded)) {
      insights.push({
        id: `budget:${budget.id}:exceeded`,
        category: 'BUDGET',
        severity: 'warning',
        title: `${budget.category} budget exceeded`,
        message: `Spending is ${formatAmount(Math.abs(budget.remainingAmount), finance.currency)} above the recorded budget.`,
        basis: 'LEDGER',
        metric: { label: 'Budget used', value: budget.spentPercentage, unit: '%' },
      });
    }

    for (const goal of finance.goals.filter(item => item.progressPercentage >= 100)) {
      insights.push({
        id: `goal:${goal.id}:complete`,
        category: 'GOAL',
        severity: 'positive',
        title: `${goal.name} is funded`,
        message: 'Recorded savings have reached or exceeded this goal target.',
        basis: 'LEDGER',
        metric: { label: 'Goal progress', value: goal.progressPercentage, unit: '%' },
      });
    }

    for (const portfolio of portfolios) {
      const valuation = await PortfolioService.getValuation(portfolio.id, userId);
      const largest = valuation.holdings.reduce<(typeof valuation.holdings)[number] | null>(
        (current, holding) => !current || holding.weight > current.weight ? holding : current,
        null,
      );
      if (largest && largest.weight >= 40) {
        insights.push({
          id: `portfolio:${portfolio.id}:concentration`,
          category: 'PORTFOLIO',
          severity: 'warning',
          title: `${portfolio.name} is concentrated`,
          message: `${largest.symbol} represents ${largest.weight.toFixed(2)}% of current portfolio value.`,
          basis: 'SYNTHETIC_MARKET_DATA',
          metric: { label: `${largest.symbol} weight`, value: largest.weight, unit: '%' },
        });
      }
    }

    insights.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id));
    const usesSyntheticMarketData = insights.some(item => item.basis === 'SYNTHETIC_MARKET_DATA');
    return {
      currency: finance.currency,
      calculation: {
        method: 'DETERMINISTIC_RULES' as const,
        usesSyntheticMarketData,
        hasSyntheticFx: finance.calculation.hasSyntheticFx,
      },
      insights,
    };
  }
}

function severityRank(severity: InsightSeverity): number {
  return severity === 'warning' ? 0 : severity === 'positive' ? 1 : 2;
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${Math.abs(amount).toFixed(2)}`;
}
