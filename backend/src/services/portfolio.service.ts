import { PortfolioRepository, PortfolioTxRow } from '../repositories/portfolio.repository';
import { MarketDataService } from './marketData.service';
import { FXService } from './fx.service';
import { AppError } from '../middleware/errorHandler';
import { StockRepository } from '../repositories/stock.repository';
import { db, IDatabaseExecutor } from '../database/db';
import { AnalyticsService } from './analytics.service';
import { BENCHMARKS_BY_SYMBOL, BENCHMARK_SYMBOL_BY_CODE } from '../config/benchmarks';

export class PortfolioService {
  /**
   * Replays all portfolio transactions to compute cash balance and derived holdings.
   */
  public static async calculateState(portfolioId: string | number, baseCurrency: string, syncHoldings = false, executor: IDatabaseExecutor = db) {
    const transactions = await PortfolioRepository.getTransactions(portfolioId, executor);

    let cashBalance = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalFees = 0;
    let totalDividends = 0;
    let totalTaxes = 0;
    let realizedPnL = 0;

    // Stock ID -> { quantity, totalCost, avgCost }
    const holdingsMap = new Map<string | number, { quantity: number; totalCost: number; avgCost: number }>();

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const fee = Number(tx.fee_amount || 0);
      const qty = Number(tx.quantity || 0);
      const price = Number(tx.price || 0);
      const txCurrency = tx.currency.toUpperCase();
      const fxRate = txCurrency === baseCurrency.toUpperCase()
        ? 1
        : Number(tx.fx_rate) || await FXService.getRate(txCurrency, baseCurrency, isoDate(tx.transaction_date));
      const amountBase = amount * fxRate;
      const feeBase = fee * fxRate;

      totalFees += feeBase;

      switch (tx.transaction_type) {
        case 'DEPOSIT':
          cashBalance += amountBase - feeBase;
          totalDeposited += amountBase;
          break;

        case 'WITHDRAWAL':
          cashBalance -= (amountBase + feeBase);
          totalWithdrawn += amountBase;
          break;

        case 'BUY':
          if (!tx.stock_id) break;
          cashBalance -= (amountBase + feeBase);
          const currentH = holdingsMap.get(tx.stock_id) || { quantity: 0, totalCost: 0, avgCost: 0 };
          const newQty = currentH.quantity + qty;
          const newTotalCost = currentH.totalCost + amountBase + feeBase;
          holdingsMap.set(tx.stock_id, {
            quantity: newQty,
            totalCost: newTotalCost,
            avgCost: newQty > 0 ? newTotalCost / newQty : 0,
          });
          break;

        case 'SELL':
          if (!tx.stock_id) break;
          cashBalance += (amountBase - feeBase);
          const holding = holdingsMap.get(tx.stock_id);
          if (holding && holding.quantity > 0) {
            const costOfSoldShares = holding.avgCost * Math.min(qty, holding.quantity);
            const proceeds = amountBase - feeBase;
            realizedPnL += (proceeds - costOfSoldShares);

            const remainingQty = Math.max(0, holding.quantity - qty);
            const remainingCost = remainingQty * holding.avgCost;
            holdingsMap.set(tx.stock_id, {
              quantity: remainingQty,
              totalCost: remainingCost,
              avgCost: remainingQty > 0 ? holding.avgCost : 0,
            });
          }
          break;

        case 'DIVIDEND':
          cashBalance += (amountBase - feeBase);
          totalDividends += amountBase;
          break;

        case 'SPLIT':
          if (!tx.stock_id || !qty) break;
          // In SPLIT, quantity holds the split ratio (e.g. 2 for 2-for-1 split)
          const splitH = holdingsMap.get(tx.stock_id);
          if (splitH && splitH.quantity > 0) {
            const splitQty = splitH.quantity * qty;
            holdingsMap.set(tx.stock_id, {
              quantity: splitQty,
              totalCost: splitH.totalCost,
              avgCost: splitH.totalCost / splitQty,
            });
          }
          break;

        case 'FEE':
          cashBalance -= amountBase;
          break;

        case 'TAX':
          cashBalance -= amountBase;
          totalTaxes += amountBase;
          break;
      }
    }

    // Sync to portfolio_holdings table
    const syncData = new Map<string | number, { quantity: number; avgCost: number }>();
    for (const [stockId, data] of holdingsMap.entries()) {
      syncData.set(stockId, { quantity: data.quantity, avgCost: data.avgCost });
    }
    if (syncHoldings) await PortfolioRepository.syncHoldings(portfolioId, syncData, executor);

    return {
      cashBalance,
      totalDeposited,
      totalWithdrawn,
      totalFees,
      totalDividends,
      totalTaxes,
      realizedPnL,
      holdingsMap,
    };
  }

  /**
   * Complete portfolio valuation in base currency with live quotes and risk metrics.
   */
  public static async getValuation(portfolioId: string | number, userId: string) {
    const portfolio = await PortfolioRepository.findById(portfolioId, userId);
    if (!portfolio) {
      throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');
    }

    const state = await this.calculateState(portfolioId, portfolio.base_currency);
    const holdings = await PortfolioRepository.getHoldings(portfolioId);

    let totalHoldingsValueBase = 0;
    let totalCostBasisBase = 0;

    const enrichedHoldings = await Promise.all(
      holdings.map(async (h) => {
        const quote = await MarketDataService.getQuote(h.symbol, h.exchange_code);
        const qty = Number(h.quantity);
        const avgCost = Number(h.average_cost);

        // Convert quote and cost to portfolio base currency
        const fx = await FXService.getLatestRate(h.asset_currency, portfolio.base_currency);
        const currentPriceBase = quote.price * fx.rate;
        // average_cost is persisted in the portfolio base currency by ledger replay.
        const avgCostBase = avgCost;

        const marketValueBase = qty * currentPriceBase;
        const costBasisBase = qty * avgCostBase;
        const unrealizedPnL = marketValueBase - costBasisBase;
        const unrealizedPnLPct = costBasisBase > 0 ? (unrealizedPnL / costBasisBase) * 100 : 0;

        totalHoldingsValueBase += marketValueBase;
        totalCostBasisBase += costBasisBase;

        return {
          stockId: h.stock_id,
          symbol: h.symbol,
          companyName: h.company_name,
          sector: h.sector,
          exchange: h.exchange_code,
          assetCurrency: h.asset_currency,
          quantity: qty,
          averageCost: avgCost,
          currentPrice: quote.price,
          currentPriceBase: round2(currentPriceBase),
          marketValue: round2(marketValueBase),
          costBasis: round2(costBasisBase),
          unrealizedPnL: round2(unrealizedPnL),
          unrealizedPnLPct: round2(unrealizedPnLPct),
          dailyChangePct: quote.changePercent,
        };
      })
    );

    const totalPortfolioValue = state.cashBalance + totalHoldingsValueBase;
    const totalInvested = state.totalDeposited - state.totalWithdrawn;
    const totalAbsolutePnL = totalPortfolioValue - totalInvested;
    const totalReturnPct = totalInvested > 0 ? (totalAbsolutePnL / totalInvested) * 100 : 0;

    // Asset allocation weights
    const holdingsWithWeights = enrichedHoldings.map(h => ({
      ...h,
      weight: totalPortfolioValue > 0 ? round2((h.marketValue / totalPortfolioValue) * 100) : 0,
    }));

    return {
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        baseCurrency: portfolio.base_currency,
        benchmarkCode: portfolio.benchmark_code,
        benchmarkName: portfolio.benchmark_name,
        createdAt: portfolio.created_at,
        allocationTargets: portfolio.allocation_targets || {},
      },
      summary: {
        totalValue: round2(totalPortfolioValue),
        cashBalance: round2(state.cashBalance),
        holdingsValue: round2(totalHoldingsValueBase),
        costBasis: round2(totalCostBasisBase),
        totalInvested: round2(totalInvested),
        unrealizedPnL: round2(totalHoldingsValueBase - totalCostBasisBase),
        realizedPnL: round2(state.realizedPnL),
        totalReturnAmount: round2(totalAbsolutePnL),
        totalReturnPercentage: round2(totalReturnPct),
        dividendsEarned: round2(state.totalDividends),
        feesPaid: round2(state.totalFees),
        taxesPaid: round2(state.totalTaxes),
      },
      holdings: holdingsWithWeights,
      risk: {
        volatility: null,
        sharpeRatio: null,
        maxDrawdown: null,
        beta: null,
        status: 'INSUFFICIENT_DATED_PORTFOLIO_SERIES',
      },
    };
  }

  public static async addTransaction(userId: string, portfolioId: string | number, txData: any) {
    const portfolio = await PortfolioRepository.findById(portfolioId, userId);
    if (!portfolio) {
      throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');
    }

    const transactionType = String(txData.transactionType || '').toUpperCase();
    const supportedTypes = ['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX'];
    if (!supportedTypes.includes(transactionType)) throw new AppError('Unsupported transaction type', 400, 'INVALID_TRANSACTION');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(txData.transactionDate || ''))) throw new AppError('A valid transaction date is required', 400, 'INVALID_TRANSACTION');

    const quantity = Number(txData.quantity ?? 0);
    const price = Number(txData.price ?? 0);
    const submittedAmount = Number(txData.amount ?? 0);
    const feeAmount = Number(txData.feeAmount ?? 0);
    if (!Number.isFinite(feeAmount) || feeAmount < 0) throw new AppError('Fee amount cannot be negative', 400, 'INVALID_TRANSACTION');

    let amount = submittedAmount;
    let stock: any = null;
    if (['BUY', 'SELL'].includes(transactionType)) {
      if (!txData.stockId || quantity <= 0 || price <= 0) throw new AppError('BUY and SELL require a stock, positive quantity, and positive price', 400, 'INVALID_TRANSACTION');
      stock = await StockRepository.findById(txData.stockId);
      if (!stock) throw new AppError('Stock not found', 400, 'INVALID_STOCK');
      amount = quantity * price;
      if (txData.amount !== undefined && Math.abs(submittedAmount - amount) > Math.max(0.01, amount * 1e-8)) {
        throw new AppError('Transaction amount must equal quantity multiplied by price', 400, 'AMOUNT_MISMATCH');
      }
    } else if (transactionType === 'SPLIT') {
      if (!txData.stockId || quantity <= 0) throw new AppError('SPLIT requires a stock and positive split ratio in quantity', 400, 'INVALID_TRANSACTION');
      amount = 0;
    } else if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Transaction amount must be positive', 400, 'INVALID_TRANSACTION');
    }

    const currency = String(txData.currency || stock?.currency || portfolio.base_currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new AppError('Currency must be a three-letter ISO code', 400, 'INVALID_CURRENCY');
    const fxRate = currency === portfolio.base_currency
      ? 1
      : (txData.fxRate ? Number(txData.fxRate) : await FXService.getRate(currency, portfolio.base_currency, txData.transactionDate));
    if (!Number.isFinite(fxRate) || fxRate <= 0) throw new AppError('FX rate must be positive', 400, 'INVALID_FX_RATE');

    const state = await this.calculateState(portfolioId, portfolio.base_currency);
    const amountBase = amount * fxRate;
    const feeBase = feeAmount * fxRate;
    if (transactionType === 'SELL') {
      const held = state.holdingsMap.get(txData.stockId)?.quantity ?? 0;
      if (quantity > held + 1e-8) throw new AppError('Cannot sell more shares than the portfolio holds', 409, 'INSUFFICIENT_HOLDINGS');
    }
    if (transactionType === 'BUY' && amountBase + feeBase > state.cashBalance + 0.01) throw new AppError('Insufficient portfolio cash for this purchase', 409, 'INSUFFICIENT_CASH');
    if (transactionType === 'WITHDRAWAL' && amountBase + feeBase > state.cashBalance + 0.01) throw new AppError('Insufficient portfolio cash for this withdrawal', 409, 'INSUFFICIENT_CASH');

    return db.transaction(async executor => {
      await executor.query('SELECT id FROM portfolios WHERE id = $1 AND user_id = $2 FOR UPDATE;', [portfolioId, userId]);
      const lockedState = await this.calculateState(portfolioId, portfolio.base_currency, false, executor);
      if (transactionType === 'SELL') {
        const held = lockedState.holdingsMap.get(txData.stockId)?.quantity ?? 0;
        if (quantity > held + 1e-8) throw new AppError('Cannot sell more shares than the portfolio holds', 409, 'INSUFFICIENT_HOLDINGS');
      }
      if (transactionType === 'BUY' && amountBase + feeBase > lockedState.cashBalance + 0.01) throw new AppError('Insufficient portfolio cash for this purchase', 409, 'INSUFFICIENT_CASH');
      if (transactionType === 'WITHDRAWAL' && amountBase + feeBase > lockedState.cashBalance + 0.01) throw new AppError('Insufficient portfolio cash for this withdrawal', 409, 'INSUFFICIENT_CASH');
      const tx = await PortfolioRepository.addTransaction({
        portfolioId,
        stockId: txData.stockId,
        transactionType,
        transactionDate: txData.transactionDate,
        quantity: quantity || null,
        price: price || null,
        amount,
        currency,
        feeAmount,
        fxRate,
        notes: txData.notes,
      }, executor);
      await this.calculateState(portfolioId, portfolio.base_currency, true, executor);
      return tx;
    });
  }

  public static async updatePortfolio(userId: string, portfolioId: string | number, data: {
    name?: string;
    benchmarkId?: string | number | null;
    allocationTargets?: Record<string, number>;
  }) {
    if (data.benchmarkId != null) {
      const benchmarks = await PortfolioRepository.listBenchmarks();
      if (!benchmarks.some(row => String(row.id) === String(data.benchmarkId))) {
        throw new AppError('Unsupported benchmark', 400, 'INVALID_BENCHMARK');
      }
    }
    const updated = await PortfolioRepository.update(portfolioId, userId, data);
    if (!updated) throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');
    return this.getValuation(portfolioId, userId);
  }

  public static async getIntelligence(portfolioId: string | number, userId: string) {
    const portfolio = await PortfolioRepository.findById(portfolioId, userId);
    if (!portfolio) throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');
    const transactions = await PortfolioRepository.getTransactions(portfolioId);
    if (!transactions.length) {
      return this.runPortfolioAnalytics(portfolio, transactions, []);
    }

    const startDate = isoDate(transactions[0].transaction_date);
    const endDate = new Date().toISOString().slice(0, 10);
    const stockRows = new Map<string, any>();
    for (const tx of transactions) {
      if (tx.stock_id && !stockRows.has(String(tx.stock_id))) stockRows.set(String(tx.stock_id), tx);
    }
    const assets = await Promise.all([...stockRows.entries()].map(async ([stockId, tx]) => {
      const prices = await MarketDataService.getPriceHistory(stockId, tx.symbol!, startDate, endDate, tx.exchange_code || undefined);
      if (!prices.length) throw new AppError(`Historical prices are unavailable for ${tx.symbol}`, 503, 'PORTFOLIO_HISTORY_UNAVAILABLE');
      const fxRates = await FXService.getRateSeries(tx.asset_currency!, portfolio.base_currency, prices.map(row => row.date));
      return {
        stock_id: stockId,
        symbol: tx.symbol,
        name: tx.company_name,
        sector: tx.sector,
        industry: tx.industry,
        country: tx.country_code,
        currency: tx.asset_currency,
        exchange: tx.exchange_code,
        asset_class: 'Equity',
        prices: prices.map(row => ({ date: row.date, close: row.close })),
        fx_rates: fxRates.map(row => ({ date: row.date, rate: row.rate })),
      };
    }));
    return this.runPortfolioAnalytics(portfolio, transactions, assets);
  }

  private static async runPortfolioAnalytics(portfolio: any, transactions: PortfolioTxRow[], assets: any[]) {
    const benchmarkSymbol = portfolio.benchmark_code ? BENCHMARK_SYMBOL_BY_CODE[portfolio.benchmark_code] : undefined;
    const startDate = transactions[0] ? isoDate(transactions[0].transaction_date) : undefined;
    const endDate = new Date().toISOString().slice(0, 10);
    let benchmark: any = undefined;
    if (benchmarkSymbol && startDate) {
      const config = BENCHMARKS_BY_SYMBOL[benchmarkSymbol];
      const prices = await MarketDataService.getExternalPriceHistory(benchmarkSymbol, config.exchange, startDate, endDate);
      const fxRates = await FXService.getRateSeries(config.currency, portfolio.base_currency, prices.map(row => row.date));
      benchmark = {
        code: config.code, name: config.name, currency: config.currency,
        prices: prices.map(row => ({ date: row.date, close: row.adjusted_close ?? row.close })),
        fx_rates: fxRates.map(row => ({ date: row.date, rate: row.rate })),
      };
    }
    const result = await AnalyticsService.runScript('portfolio/intelligence.py', {
      base_currency: portfolio.base_currency,
      end_date: endDate,
      allocation_targets: typeof portfolio.allocation_targets === 'string' ? JSON.parse(portfolio.allocation_targets) : portfolio.allocation_targets,
      source: process.env.NODE_ENV === 'test' ? 'FINSIGHT_TEST_FIXTURE' : 'YAHOO_FINANCE_CHART',
      transactions: transactions.map(tx => ({
        id: tx.id, type: tx.transaction_type, date: isoDate(tx.transaction_date), stock_id: tx.stock_id,
        quantity: nullableNumber(tx.quantity), price: nullableNumber(tx.price), amount: Number(tx.amount),
        fee_amount: Number(tx.fee_amount || 0), fx_rate: tx.fx_rate == null ? 1 : Number(tx.fx_rate),
      })),
      assets,
      benchmark,
    });
    return {
      portfolio: {
        id: portfolio.id, name: portfolio.name, baseCurrency: portfolio.base_currency,
        benchmarkId: portfolio.benchmark_id, benchmarkCode: portfolio.benchmark_code,
        benchmarkName: portfolio.benchmark_name, allocationTargets: portfolio.allocation_targets || {},
      },
      ...result,
      methodology: {
        prices: 'Provider historical closes; ledger split entries are applied chronologically and are not applied twice.',
        fx: 'Transaction-date FX for ledger cash flows and valuation-date FX for historical positions.',
        attribution: 'FIFO lots; price return + FX impact + dividends - fees - taxes reconciles to net P&L.',
        disclaimer: 'Historical analysis and hypothetical planning are educational, not investment or tax advice.',
      },
    };
  }

  public static async comparePortfolios(userId: string, portfolioIds: Array<string | number>) {
    const ids = [...new Set(portfolioIds.map(String))];
    if (ids.length < 2 || ids.length > 4) throw new AppError('Select between two and four unique portfolios', 400, 'INVALID_COMPARISON');
    const results = await Promise.all(ids.map(id => this.getIntelligence(id, userId)));
    const contributionHistories = await Promise.all(ids.map(async (id, index) => {
      const baseCurrency = results[index].portfolio.baseCurrency;
      const transactions = await PortfolioRepository.getTransactions(id);
      return Promise.all(transactions
        .filter(tx => tx.transaction_type === 'DEPOSIT' || tx.transaction_type === 'WITHDRAWAL')
        .map(async tx => {
          const date = isoDate(tx.transaction_date);
          const currency = tx.currency.toUpperCase();
          const fxRate = currency === baseCurrency
            ? 1
            : Number(tx.fx_rate) || await FXService.getRate(currency, baseCurrency, date);
          const direction = tx.transaction_type === 'DEPOSIT' ? 1 : -1;
          return {
            date,
            type: tx.transaction_type,
            currency,
            amount: round2(Number(tx.amount)),
            baseCurrency,
            baseAmount: round2(Number(tx.amount) * fxRate * direction),
          };
        }));
    }));
    const starts = results.map(item => item.performance?.startDate).filter(Boolean).sort();
    const ends = results.map(item => item.performance?.endDate).filter(Boolean).sort();
    const synchronizedStart = starts.length ? starts[starts.length - 1] : null;
    const synchronizedEnd = ends.length ? ends[0] : null;
    const currencies = [...new Set(results.map(item => item.portfolio.baseCurrency))];
    const benchmarks = [...new Set(results.map(item => item.portfolio.benchmarkCode || 'NONE'))];
    const seriesByPortfolio = results.map(item => {
      const series = (item.performance?.series || []).filter((row: any) =>
        (!synchronizedStart || row.date >= synchronizedStart) && (!synchronizedEnd || row.date <= synchronizedEnd),
      );
      const origin = series[0]?.portfolioNormalized || 100;
      return {
        portfolioId: item.portfolio.id,
        name: item.portfolio.name,
        values: series.map((row: any) => ({ date: row.date, value: round2(row.portfolioNormalized / origin * 100) })),
      };
    });
    return {
      portfolios: results.map((item, index) => ({
        portfolio: item.portfolio,
        performance: item.performance,
        risk: item.risk,
        allocation: item.allocation,
        contributionHistory: contributionHistories[index],
      })),
      synchronizedPeriod: { startDate: synchronizedStart, endDate: synchronizedEnd },
      comparisonSeries: seriesByPortfolio,
      compatibility: {
        currencies, benchmarks,
        sameCurrency: currencies.length === 1,
        sameBenchmark: benchmarks.length === 1,
        differentStartDates: new Set(starts).size > 1,
        note: 'The chart is rebased to 100 over the common overlapping period. Absolute values are only directly comparable when base currencies match.',
      },
    };
  }
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}
