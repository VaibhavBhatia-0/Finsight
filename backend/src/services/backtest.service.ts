import { AppError } from '../middleware/errorHandler';
import { BacktestRepository } from '../repositories/backtest.repository';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { AnalyticsService } from './analytics.service';
import { FXService } from './fx.service';
import { MarketDataService } from './marketData.service';
import { db } from '../database/db';
import { BENCHMARKS_BY_SYMBOL } from '../config/benchmarks';

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
      const prices = await MarketDataService.getPriceHistory(holding.stock_id, holding.symbol, input.startDate, input.endDate, holding.exchange_code);
      const exchangeRates = (await FXService.getRateSeries(
        holding.asset_currency,
        portfolio.base_currency,
        prices.map(row => row.date),
      )).map(({ date, rate }) => ({ date, rate }));
      return {
        symbol: holding.symbol,
        weight: bases[index] / total,
        asset_currency: holding.asset_currency,
        // Backtests use adjusted close as the total-return series so provider-reported
        // splits and cash distributions are not mistaken for strategy losses.
        price_history: prices.map(row => ({ ...row, close: row.adjusted_close ?? row.close })),
        exchange_rates: exchangeRates,
      };
    }));

    const strategyType = input.strategyType || 'BUY_AND_HOLD';
    const benchmarkConfig = input.benchmarkSymbol ? BENCHMARKS_BY_SYMBOL[input.benchmarkSymbol as keyof typeof BENCHMARKS_BY_SYMBOL] : undefined;
    const benchmarkPrices = benchmarkConfig
      ? await MarketDataService.getExternalPriceHistory(input.benchmarkSymbol, benchmarkConfig.exchange, input.startDate, input.endDate)
      : [];
    const benchmarkRates = benchmarkConfig
      ? await FXService.getRateSeries(benchmarkConfig.currency, portfolio.base_currency, benchmarkPrices.map(row => row.date))
      : [];
    const benchmark = benchmarkConfig ? {
      symbol: input.benchmarkSymbol,
      asset_currency: benchmarkConfig.currency,
      price_history: benchmarkPrices.map(row => ({ ...row, close: row.adjusted_close ?? row.close })),
      exchange_rates: benchmarkRates.map(({ date, rate }) => ({ date, rate })),
    } : undefined;
    const calculated = await AnalyticsService.runScript('backtesting/engine.py', {
      strategy_type: strategyType,
      initial_amount: input.initialAmount,
      base_currency: portfolio.base_currency,
      assets,
      benchmark,
      fee_rate: input.feeRate,
      fixed_fee: input.fixedFee,
    });
    return db.transaction(async executor => {
      const benchmarkRow = benchmarkConfig
        ? (await executor.query<{ id: string }>('SELECT id FROM benchmarks WHERE code = $1;', [benchmarkConfig.code])).rows[0]
        : undefined;
      const backtest = await BacktestRepository.create(userId, {
        name: input.name || `${portfolio.name} backtest`,
        strategyType,
        baseCurrency: portfolio.base_currency,
        startDate: input.startDate,
        endDate: input.endDate,
        initialAmount: input.initialAmount,
        benchmarkId: benchmarkRow?.id,
        parameters: { portfolioId: portfolio.id, benchmarkSymbol: input.benchmarkSymbol || null, feeRate: input.feeRate, fixedFee: input.fixedFee },
      }, executor);
      await BacktestRepository.saveResult(backtest.id, calculated, executor);
      return this.present(await BacktestRepository.find(backtest.id, userId, executor));
    });
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
        xirr: row.xirr === null ? null : Number(row.xirr),
        benchmarkReturn: row.benchmark_return === null ? null : Number(row.benchmark_return),
        benchmarkCagr: row.benchmark_cagr === null ? null : Number(row.benchmark_cagr),
        benchmarkDifference: row.benchmark_difference === null ? null : Number(row.benchmark_difference),
        relativePerformance: row.relative_performance === null ? null : Number(row.relative_performance),
        feesPaid: row.fees_paid === null ? 0 : Number(row.fees_paid),
        grossFinalValue: row.gross_final_value === null ? Number(row.final_value) : Number(row.gross_final_value),
      },
      details: {
        timeSeries: row.time_series,
        strategyType: row.strategy_type,
        benchmarkSymbol: typeof row.parameters === 'string' ? JSON.parse(row.parameters).benchmarkSymbol : row.parameters?.benchmarkSymbol,
        feeRate: Number((typeof row.parameters === 'string' ? JSON.parse(row.parameters).feeRate : row.parameters?.feeRate) || 0),
        fixedFee: Number((typeof row.parameters === 'string' ? JSON.parse(row.parameters).fixedFee : row.parameters?.fixedFee) || 0),
        attribution: row.attribution || {},
        methodology: 'Provider adjusted-close total-return series with valuation-date FX. Entry and exit trading fees reduce shares and liquidation value; the optional benchmark is fee-free and FX-normalized to the portfolio currency.',
      },
    };
  }
}
