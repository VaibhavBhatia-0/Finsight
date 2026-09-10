import { AppError } from '../middleware/errorHandler';
import { BacktestRepository } from '../repositories/backtest.repository';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { AnalyticsService } from './analytics.service';
import { FXService } from './fx.service';
import { MarketDataService } from './marketData.service';

export class BacktestService {
  static async run(userId: string, input: any) {
    const portfolio = await PortfolioRepository.findById(input.portfolioId, userId);
    if (!portfolio) throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');
    const holdings = await PortfolioRepository.getHoldings(portfolio.id);
    if (!holdings.length) throw new AppError('Portfolio has no holdings to backtest', 400, 'EMPTY_PORTFOLIO');
    const bases = holdings.map(row => Number(row.quantity) * Number(row.average_cost));
    const total = bases.reduce((sum, value) => sum + value, 0);
    if (total <= 0) throw new AppError('Portfolio holdings have no usable cost basis', 400, 'INVALID_PORTFOLIO');

    const assets = await Promise.all(holdings.map(async (holding, index) => {
      const prices = await MarketDataService.getPriceHistory(holding.stock_id, holding.symbol, input.startDate, input.endDate);
      const exchangeRates = await Promise.all(prices.map(async row => ({
        date: row.date,
        rate: await FXService.getRate(holding.asset_currency, portfolio.base_currency, row.date),
      })));
      return {
        symbol: holding.symbol,
        weight: bases[index] / total,
        asset_currency: holding.asset_currency,
        price_history: prices,
        exchange_rates: exchangeRates,
      };
    }));

    const strategyType = input.strategyType || 'BUY_AND_HOLD';
    const calculated = await AnalyticsService.runScript('backtesting/engine.py', {
      strategy_type: strategyType,
      initial_amount: input.initialAmount,
      base_currency: portfolio.base_currency,
      assets,
    });
    const backtest = await BacktestRepository.create(userId, {
      name: input.name || `${portfolio.name} backtest`,
      strategyType,
      baseCurrency: portfolio.base_currency,
      startDate: input.startDate,
      endDate: input.endDate,
      initialAmount: input.initialAmount,
      parameters: { portfolioId: portfolio.id },
    });
    await BacktestRepository.saveResult(backtest.id, calculated);
    return this.present(await BacktestRepository.find(backtest.id, userId));
  }

  static present(row: any) {
    return {
      id: String(row.canonical_backtest_id),
      status: 'completed',
      createdAt: row.created_at,
      completedAt: row.calculated_at,
      summary: {
        totalInvested: Number(row.total_invested),
        finalValue: Number(row.final_value),
        absoluteReturn: Number(row.absolute_return),
        returnPercentage: Number(row.return_percentage),
        cagr: row.cagr === null ? null : Number(row.cagr),
        volatility: row.volatility === null ? null : Number(row.volatility),
        maxDrawdown: row.max_drawdown === null ? null : Number(row.max_drawdown),
        sharpeRatio: row.sharpe_ratio === null ? null : Number(row.sharpe_ratio),
      },
      details: { timeSeries: row.time_series, strategyType: row.strategy_type },
    };
  }
}
