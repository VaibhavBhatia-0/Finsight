import { ScenarioRepository } from '../repositories/scenario.repository';
import { StockRepository } from '../repositories/stock.repository';
import { MarketDataService } from './marketData.service';
import { FXService } from './fx.service';
import { AnalyticsService } from './analytics.service';
import { db } from '../database/db';
import { AppError } from '../middleware/errorHandler';

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

    // Fetch tax rule if applicable
    let taxRate = 0.125; // default 12.5% LTCG
    if (input.taxRuleId) {
      const taxRes = await db.query(`SELECT rate FROM tax_rules WHERE id = $1;`, [input.taxRuleId]);
      if (taxRes.rows.length > 0 && taxRes.rows[0].rate) {
        taxRate = parseFloat(taxRes.rows[0].rate);
      }
    }

    const payload = {
      mode,
      initial_amount: input.initialAmount,
      base_currency: input.baseCurrency,
      start_date: input.startDate,
      end_date: input.endDate,
      benchmark_price_history: benchmarkPrices,
      fee_rate: input.feeRate ?? 0.001,
      tax_rate: taxRate,
      contribution_frequency: input.contributionFrequency || 'MONTHLY',
    };

    if (mode === 'PORTFOLIO_SCENARIO') {
      if (!input.assets || input.assets.length < 2) throw new AppError('Portfolio scenarios require at least two assets', 400, 'INVALID_PORTFOLIO_ASSETS');
      const weightTotal = input.assets.reduce((total, asset) => total + Number(asset.weight), 0);
      if (input.assets.some(asset => !(Number(asset.weight) > 0)) || Math.abs(weightTotal - 1) > 1e-8) throw new AppError('Portfolio weights must be positive and sum to 1', 400, 'INVALID_PORTFOLIO_WEIGHTS');
      const preparedAssets = await Promise.all(input.assets.map(asset => this.prepareAsset(asset, input)));
      const simulationResult = await AnalyticsService.runScript('simulations/simulator.py', { ...payload, assets: preparedAssets.map(({ stock: _stock, ...data }) => data) });
      return { assets: preparedAssets.map(({ stock, weight }) => ({ ...stock, weight })), ...simulationResult };
    }

    const prepared = await this.prepareAsset({ stockId: input.stockId, symbol: input.symbol, weight: 1 }, input);
    const { stock, weight: _weight, ...assetPayload } = prepared;
    const simulationResult = await AnalyticsService.runScript('simulations/simulator.py', { ...payload, ...assetPayload });
    return { stock, ...simulationResult };
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
    // 1. Run simulation to get fresh computed results
    const simulationResult = await this.runSimulation(data);

    // 2. Insert into scenarios table
    const scenario = await ScenarioRepository.create(userId, {
      name: data.name || `${data.symbol} Simulation`,
      scenarioType: data.scenarioType || 'SINGLE_INVESTMENT',
      baseCurrency: data.baseCurrency || 'INR',
      startDate: data.startDate,
      endDate: data.endDate,
      initialAmount: data.initialAmount,
      contributionFrequency: data.contributionFrequency,
      taxRuleId: data.taxRuleId,
      benchmarkId: data.benchmarkId,
      assumptions: data.assumptions,
    });

    // 3. Insert scenario asset
    if (data.stockId) {
      await ScenarioRepository.addAsset(scenario.id, data.stockId, 1.0, data.initialAmount);
    }

    // 4. Save result
    const savedResult = await ScenarioRepository.saveResult(scenario.id, simulationResult);

    return {
      scenario,
      result: savedResult,
      simulation: simulationResult,
    };
  }
}
