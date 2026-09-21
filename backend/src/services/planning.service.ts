import { AppError } from '../middleware/errorHandler';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { AnalyticsService } from './analytics.service';
import { ScenarioService } from './scenario.service';

export class PlanningService {
  static async requiredContribution(input: any) {
    return AnalyticsService.runScript('planning/engine.py', {
      operation: 'REQUIRED_CONTRIBUTION',
      target_amount: input.targetAmount,
      current_amount: input.currentAmount,
      as_of_date: input.asOfDate,
      target_date: input.targetDate,
      frequency: input.frequency,
      assumed_annual_return: input.assumedAnnualReturn,
    });
  }

  static async whatIf(userId: string, input: any) {
    const request = await this.scenarioRequest(userId, input);
    const result = await ScenarioService.runSimulation(request);
    const baseline = input.baselineInitialAmount
      ? await ScenarioService.runSimulation({ ...request, initialAmount: input.baselineInitialAmount })
      : null;
    return {
      hypothetical: true,
      result,
      baseline,
      comparison: baseline ? {
        finalValueDifference: numberAt(result, 'financials.net_value') - numberAt(baseline, 'financials.net_value'),
        contributionDifference: numberAt(result, 'financials.initial_investment') - numberAt(baseline, 'financials.initial_investment'),
      } : null,
      disclaimer: 'Hypothetical historical scenario. Results are not a forecast or guaranteed outcome.',
    };
  }

  static async replay(userId: string, input: any) {
    const result = await ScenarioService.runSimulation(await this.scenarioRequest(userId, input));
    return {
      historicalReplay: true,
      result,
      disclaimer: 'Historical replay uses available provider observations and does not predict future performance.',
    };
  }

  static async recurring(userId: string, input: any) {
    const result = await ScenarioService.runSimulation(await this.scenarioRequest(userId, { ...input, investmentMode: 'RECURRING' }));
    return {
      hypothetical: true,
      result,
      disclaimer: 'Historical recurring-investment illustration; future market and FX outcomes may differ.',
    };
  }

  private static async scenarioRequest(userId: string, input: any) {
    const recurring = input.investmentMode === 'RECURRING';
    const common = {
      startDate: input.startDate, endDate: input.endDate, initialAmount: input.initialAmount,
      baseCurrency: input.baseCurrency, benchmarkCode: input.benchmarkCode,
      taxJurisdiction: input.taxJurisdiction, feeRate: input.feeRate,
      contributionFrequency: input.contributionFrequency,
      contributionGrowthRate: input.contributionGrowthRate,
    };
    if (input.portfolioId) {
      const portfolio = await PortfolioRepository.findById(input.portfolioId, userId);
      if (!portfolio) throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');
      const holdings = await PortfolioRepository.getHoldings(portfolio.id);
      if (!holdings.length) throw new AppError('Portfolio has no holdings to model', 400, 'EMPTY_PORTFOLIO');
      const bases = holdings.map(row => Number(row.quantity) * Number(row.average_cost));
      const total = bases.reduce((sum, value) => sum + value, 0);
      if (total <= 0) throw new AppError('Portfolio has no usable allocation basis', 400, 'INVALID_PORTFOLIO');
      return {
        ...common,
        scenarioType: 'PORTFOLIO_SCENARIO',
        portfolioRecurring: recurring,
        assets: holdings.map((row, index) => ({ stockId: row.stock_id, weight: bases[index] / total })),
      };
    }
    return {
      ...common,
      scenarioType: recurring ? 'RECURRING_INVESTMENT' : 'SINGLE_INVESTMENT',
      stockId: input.stockId,
      symbol: input.symbol,
    };
  }
}

function numberAt(value: any, path: string): number {
  return path.split('.').reduce((current, key) => current?.[key], value) ?? 0;
}
