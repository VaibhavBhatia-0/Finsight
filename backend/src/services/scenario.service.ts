import { ScenarioRepository } from '../repositories/scenario.repository';
import { StockRepository } from '../repositories/stock.repository';
import { MarketDataService } from './marketData.service';
import { FXService } from './fx.service';
import { AnalyticsService } from './analytics.service';
import { db } from '../database/db';
import { AppError } from '../middleware/errorHandler';
import { TaxService } from './tax.service';
import { UserPreferencesRepository } from '../repositories/userPreferences.repository';

export class ScenarioService {
  /**
   * Runs the simulation through Python analytics engine and returns the breakdown.
   */
  public static async runSimulation(input: {
    scenarioType?: string;
    stockId?: string | number;
    symbol?: string;
    startDate: string;
    endDate: string;
    initialAmount: number;
    baseCurrency: string;
    benchmarkCode?: string;
    taxRuleId?: string | number;
    taxJurisdiction?: 'IN' | 'US';
    feeRate?: number;
    contributionFrequency?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
    assets?: Array<{ stockId?: string | number; symbol?: string; weight: number }>;
  }) {
    const mode = input.scenarioType || 'SINGLE_INVESTMENT';
    if (!['SINGLE_INVESTMENT', 'RECURRING_INVESTMENT', 'PORTFOLIO_SCENARIO'].includes(mode)) {
      throw new AppError('Unsupported scenario type', 400, 'INVALID_SCENARIO_TYPE');
    }
    if (!input.startDate || !input.endDate || input.startDate >= input.endDate || !(input.initialAmount > 0)) {
      throw new AppError('A positive amount and valid date range are required', 400, 'INVALID_SCENARIO');
    }

    let benchmarkPrices: any[] = [];
    if (input.benchmarkCode) {
      const benchStock = await StockRepository.findBySymbol(input.benchmarkCode);
      if (benchStock) {
        benchmarkPrices = await MarketDataService.getPriceHistory(benchStock.id, benchStock.symbol, input.startDate, input.endDate);
      }
    }

    const tax = await TaxService.resolve({ jurisdiction: input.taxJurisdiction, taxRuleId: input.taxRuleId, assetType: 'EQUITY', acquisitionDate: input.startDate, disposalDate: input.endDate });

    const payload = {
      mode,
      initial_amount: input.initialAmount,
      base_currency: input.baseCurrency,
      start_date: input.startDate,
      end_date: input.endDate,
      benchmark_price_history: benchmarkPrices,
      fee_rate: input.feeRate ?? 0.001,
      tax_rate: tax.rate,
      tax_exemption: tax.exemptionAmount,
      contribution_frequency: input.contributionFrequency || 'MONTHLY',
    };

    if (mode === 'PORTFOLIO_SCENARIO') {
      if (!input.assets || input.assets.length < 2) throw new AppError('Portfolio scenarios require at least two assets', 400, 'INVALID_PORTFOLIO_ASSETS');
      const weightTotal = input.assets.reduce((total, asset) => total + Number(asset.weight), 0);
      if (input.assets.some(asset => !(Number(asset.weight) > 0)) || Math.abs(weightTotal - 1) > 1e-8) throw new AppError('Portfolio weights must be positive and sum to 1', 400, 'INVALID_PORTFOLIO_WEIGHTS');
      const preparedAssets = await Promise.all(input.assets.map(asset => this.prepareAsset(asset, input)));
      const simulationResult = await AnalyticsService.runScript('simulations/simulator.py', { ...payload, assets: preparedAssets.map(({ stock: _stock, ...data }) => data) });
      const { assets: assetResults, ...portfolioResult } = simulationResult;
      return { ...portfolioResult, taxMethodology: tax, assets: preparedAssets.map(({ stock, weight }) => ({ ...stock, weight })), assetResults };
    }

    const prepared = await this.prepareAsset({ stockId: input.stockId, symbol: input.symbol, weight: 1 }, input);
    const { stock, weight: _weight, ...assetPayload } = prepared;
    const simulationResult = await AnalyticsService.runScript('simulations/simulator.py', { ...payload, ...assetPayload });
    return { stock, taxMethodology: tax, ...simulationResult };
  }

  private static async prepareAsset(
    selection: { stockId?: string | number; symbol?: string; weight: number },
    input: { startDate: string; endDate: string; baseCurrency: string; scenarioType?: string; contributionFrequency?: string },
  ) {
    const stock = selection.stockId ? await StockRepository.findById(selection.stockId) : selection.symbol ? await StockRepository.findBySymbol(selection.symbol) : null;
    if (!stock) throw new AppError('A valid stock must be selected for the simulation', 400, 'INVALID_STOCK');
    const prices = await MarketDataService.getPriceHistory(stock.id, stock.symbol, input.startDate, input.endDate);
    if (!prices.length) throw new AppError(`No price observations found for ${stock.symbol} in the given period`, 400, 'NO_DATA');
    const dividends = (await StockRepository.getDividends(stock.id)).filter(row => row.ex_date > input.startDate && row.ex_date <= input.endDate);
    const corporateActions = (await StockRepository.getCorporateActions(stock.id)).filter(row => row.action_date > input.startDate && row.action_date <= input.endDate);
    const fxDates = new Set<string>([input.startDate, input.endDate, ...dividends.map(row => row.ex_date)]);
    if (input.scenarioType === 'RECURRING_INVESTMENT') {
      const step = input.contributionFrequency === 'QUARTERLY' ? 3 : input.contributionFrequency === 'ANNUALLY' ? 12 : 1;
      let cursor = new Date(`${input.startDate}T00:00:00Z`);
      const end = new Date(`${input.endDate}T00:00:00Z`);
      while (cursor <= end) {
        const scheduled = cursor.toISOString().slice(0, 10);
        const trade = prices.find(row => row.date >= scheduled);
        if (trade && trade.date <= input.endDate) fxDates.add(trade.date);
        const day = cursor.getUTCDate();
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + step, 1));
        const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
        cursor.setUTCDate(Math.min(day, lastDay));
      }
    }
    const exchangeRates = await Promise.all([...fxDates].map(async date => ({
      base_currency: stock.currency,
      quote_currency: input.baseCurrency,
      date,
      rate: await FXService.getRate(stock.currency, input.baseCurrency, date),
    })));
    return {
      stock: {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.company_name,
        currency: stock.currency,
      },
      symbol: stock.symbol,
      weight: Number(selection.weight),
      asset_currency: stock.currency,
      price_history: prices,
      exchange_rates: exchangeRates,
      dividends,
      corporate_actions: corporateActions,
    };
  }

  /**
   * Saves a scenario and its simulation results.
   */
  public static async saveScenario(userId: string, data: any) {
    if (!data.taxJurisdiction && !data.taxRuleId) {
      const preferences = await UserPreferencesRepository.getByUserId(userId);
      if (preferences?.tax_residency) data = { ...data, taxJurisdiction: preferences.tax_residency };
    }
    // 1. Run simulation to get fresh computed results
    const simulationResult = await this.runSimulation(data);

    return db.transaction(async executor => {
      // Persist the scenario, resolved assets, recurring ledger, and result as one unit.
      const scenario = await ScenarioRepository.create(userId, {
        name: data.name || `${data.symbol || data.scenarioType} Simulation`,
        scenarioType: data.scenarioType || 'SINGLE_INVESTMENT',
        baseCurrency: data.baseCurrency || 'INR',
        startDate: data.startDate,
        endDate: data.endDate,
        initialAmount: data.initialAmount,
        contributionFrequency: data.contributionFrequency,
        taxRuleId: data.taxRuleId,
        benchmarkId: data.benchmarkId,
        assumptions: data.assumptions,
      }, executor);

      if (data.scenarioType === 'PORTFOLIO_SCENARIO' && Array.isArray(simulationResult.assets)) {
        for (const asset of simulationResult.assets) {
          await ScenarioRepository.addAsset(scenario.id, asset.id, asset.weight, data.initialAmount * asset.weight, executor);
        }
      } else if (simulationResult.stock?.id) {
        const scenarioAsset = await ScenarioRepository.addAsset(scenario.id, simulationResult.stock.id, 1.0, data.initialAmount, executor);
        if (data.scenarioType === 'RECURRING_INVESTMENT' && Array.isArray(simulationResult.contributions)) {
          for (const contribution of simulationResult.contributions) {
            await ScenarioRepository.addContribution(scenario.id, scenarioAsset.id, {
              date: String(contribution.trade_date),
              amount: Number(contribution.amount),
              currency: data.baseCurrency,
            }, executor);
          }
        }
      }

      const savedResult = await ScenarioRepository.saveResult(scenario.id, simulationResult, executor);
      return { scenario, result: savedResult, simulation: simulationResult };
    });
  }

  public static async compareScenarios(userId: string, scenarioIds: Array<string | number>) {
    const uniqueIds = [...new Set(scenarioIds.map(String))];
    const scenarios = await Promise.all(uniqueIds.map(id => ScenarioRepository.findById(id, userId)));
    if (scenarios.some(scenario => !scenario)) {
      throw new AppError('One or more scenarios were not found', 404, 'SCENARIO_NOT_FOUND');
    }
    await db.transaction(async executor => {
      const anchor = uniqueIds[0];
      for (const compared of uniqueIds.slice(1)) {
        await ScenarioRepository.addComparison(anchor, compared, executor);
      }
    });
    const comparisonRows = scenarios.map(scenario => ({
      ...scenario,
      final_value: scenario.result?.final_value ?? null,
      net_profit: scenario.result?.net_profit ?? null,
      return_percentage: scenario.result?.return_percentage ?? null,
      cagr: scenario.result?.cagr ?? null,
      xirr: scenario.result?.xirr ?? null,
      volatility: scenario.result?.volatility ?? null,
      sharpe_ratio: scenario.result?.sharpe_ratio ?? null,
      max_drawdown: scenario.result?.max_drawdown ?? null,
    }));
    const currencies = [...new Set(comparisonRows.map(scenario => scenario.base_currency))];
    return {
      comparisons: comparisonRows,
      metrics: comparisonRows.map(scenario => ({
        scenarioId: scenario.id,
        name: scenario.name,
        scenarioType: scenario.scenario_type,
        currency: scenario.base_currency,
        finalValue: nullableNumber(scenario.final_value),
        netProfit: nullableNumber(scenario.net_profit),
        returnPercentage: nullableNumber(scenario.return_percentage),
        cagr: nullableNumber(scenario.cagr),
        xirr: nullableNumber(scenario.xirr),
        volatility: nullableNumber(scenario.volatility),
        sharpeRatio: nullableNumber(scenario.sharpe_ratio),
        maxDrawdown: nullableNumber(scenario.max_drawdown),
      })),
      normalization: {
        basis: 'PERCENTAGE_METRICS',
        currencies,
        absoluteValuesComparable: currencies.length === 1,
      },
    };
  }
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
