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
  }) {
    let stock: any = null;
    if (input.stockId) {
      stock = await StockRepository.findById(input.stockId);
    } else if (input.symbol) {
      stock = await StockRepository.findBySymbol(input.symbol);
    }

    if (!stock) {
      throw new AppError('A valid stock must be selected for the simulation', 400, 'INVALID_STOCK');
    }

    // Fetch price history
    const prices = await MarketDataService.getPriceHistory(stock.id, stock.symbol, input.startDate, input.endDate);
    if (prices.length === 0) {
      throw new AppError(`No price observations found for ${stock.symbol} in the given period`, 400, 'NO_DATA');
    }

    // Fetch benchmark prices if benchmark specified
    let benchmarkPrices: any[] = [];
    if (input.benchmarkCode) {
      const benchStock = await StockRepository.findBySymbol(input.benchmarkCode);
      if (benchStock) {
        benchmarkPrices = await MarketDataService.getPriceHistory(benchStock.id, benchStock.symbol, input.startDate, input.endDate);
      }
    }

    // Fetch exchange rates for start and end dates
    const startFx = await FXService.getRate('USD', 'INR', input.startDate);
    const endFx = await FXService.getRate('USD', 'INR', input.endDate);
    const fxRates = [
      { base_currency: 'USD', quote_currency: 'INR', date: input.startDate, rate: startFx },
      { base_currency: 'USD', quote_currency: 'INR', date: input.endDate, rate: endFx },
    ];

    // Fetch dividends and corporate actions
    const dividends = await StockRepository.getDividends(stock.id);
    const corporateActions = await StockRepository.getCorporateActions(stock.id);

    // Fetch tax rule if applicable
    let taxRate = 0.125; // default 12.5% LTCG
    if (input.taxRuleId) {
      const taxRes = await db.query(`SELECT rate FROM tax_rules WHERE id = $1;`, [input.taxRuleId]);
      if (taxRes.rows.length > 0 && taxRes.rows[0].rate) {
        taxRate = parseFloat(taxRes.rows[0].rate);
      }
    }

    const payload = {
      mode: input.scenarioType || 'SINGLE_INVESTMENT',
      initial_amount: input.initialAmount,
      base_currency: input.baseCurrency,
      asset_currency: stock.currency,
      start_date: input.startDate,
      end_date: input.endDate,
      price_history: prices,
      exchange_rates: fxRates,
      dividends,
      corporate_actions: corporateActions,
      benchmark_price_history: benchmarkPrices,
      fee_rate: input.feeRate ?? 0.001,
      tax_rate: taxRate,
    };

    const simulationResult = await AnalyticsService.runScript('simulations/simulator.py', payload);
    return {
      stock: {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.company_name,
        currency: stock.currency,
      },
      ...simulationResult,
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

