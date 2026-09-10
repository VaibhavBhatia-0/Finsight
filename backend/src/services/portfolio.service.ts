import { PortfolioRepository, PortfolioTxRow } from '../repositories/portfolio.repository';
import { MarketDataService } from './marketData.service';
import { FXService } from './fx.service';
import { AppError } from '../middleware/errorHandler';
import { StockRepository } from '../repositories/stock.repository';

export class PortfolioService {
  /**
   * Replays all portfolio transactions to compute cash balance and derived holdings.
   */
  public static async calculateState(portfolioId: string | number, baseCurrency: string, syncHoldings = false) {
    const transactions = await PortfolioRepository.getTransactions(portfolioId);

    let cashBalance = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalFees = 0;
    let totalDividends = 0;
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
        : Number(tx.fx_rate) || await FXService.getRate(txCurrency, baseCurrency, tx.transaction_date);
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
      }
    }

    // Sync to portfolio_holdings table
    const syncData = new Map<string | number, { quantity: number; avgCost: number }>();
    for (const [stockId, data] of holdingsMap.entries()) {
      syncData.set(stockId, { quantity: data.quantity, avgCost: data.avgCost });
    }
    if (syncHoldings) await PortfolioRepository.syncHoldings(portfolioId, syncData);

    return {
      cashBalance,
      totalDeposited,
      totalWithdrawn,
      totalFees,
      totalDividends,
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
        const quote = await MarketDataService.getQuote(h.symbol);
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
    const supportedTypes = ['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'DEPOSIT', 'WITHDRAWAL', 'FEE'];
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
    });

    // Replay state immediately
    await this.calculateState(portfolioId, portfolio.base_currency, true);
    return tx;
  }
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}
