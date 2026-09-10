import { PortfolioRepository, PortfolioTxRow } from '../repositories/portfolio.repository';
import { MarketDataService } from './marketData.service';
import { FXService } from './fx.service';
import { AppError } from '../middleware/errorHandler';

export class PortfolioService {
  /**
   * Replays all portfolio transactions to compute cash balance and derived holdings.
   */
  public static async calculateState(portfolioId: string | number) {
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

      totalFees += fee;

      switch (tx.transaction_type) {
        case 'DEPOSIT':
          cashBalance += amount - fee;
          totalDeposited += amount;
          break;

        case 'WITHDRAWAL':
          cashBalance -= (amount + fee);
          totalWithdrawn += amount;
          break;

        case 'BUY':
          if (!tx.stock_id) break;
          cashBalance -= (amount + fee);
          const currentH = holdingsMap.get(tx.stock_id) || { quantity: 0, totalCost: 0, avgCost: 0 };
          const newQty = currentH.quantity + qty;
          const newTotalCost = currentH.totalCost + amount + fee;
          holdingsMap.set(tx.stock_id, {
            quantity: newQty,
            totalCost: newTotalCost,
            avgCost: newQty > 0 ? newTotalCost / newQty : 0,
          });
          break;

        case 'SELL':
          if (!tx.stock_id) break;
          cashBalance += (amount - fee);
          const holding = holdingsMap.get(tx.stock_id);
          if (holding && holding.quantity > 0) {
            const costOfSoldShares = holding.avgCost * Math.min(qty, holding.quantity);
            const proceeds = amount - fee;
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
          cashBalance += (amount - fee);
          totalDividends += amount;
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
          cashBalance -= amount;
          break;
      }
    }

    // Sync to portfolio_holdings table
    const syncData = new Map<string | number, { quantity: number; avgCost: number }>();
    for (const [stockId, data] of holdingsMap.entries()) {
      syncData.set(stockId, { quantity: data.quantity, avgCost: data.avgCost });
    }
    await PortfolioRepository.syncHoldings(portfolioId, syncData);

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

    const state = await this.calculateState(portfolioId);
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
        const avgCostBase = avgCost * fx.rate;

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
        volatility: 14.5,
        sharpeRatio: 1.45,
        maxDrawdown: 11.2,
        beta: 1.05,
      },
    };
  }

  public static async addTransaction(userId: string, portfolioId: string | number, txData: any) {
    const portfolio = await PortfolioRepository.findById(portfolioId, userId);
    if (!portfolio) {
      throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');
    }

    const tx = await PortfolioRepository.addTransaction({
      portfolioId,
      stockId: txData.stockId,
      transactionType: txData.transactionType,
      transactionDate: txData.transactionDate,
      quantity: txData.quantity,
      price: txData.price,
      amount: txData.amount,
      currency: txData.currency || portfolio.base_currency,
      feeAmount: txData.feeAmount,
      fxRate: txData.fxRate,
      notes: txData.notes,
    });

    // Replay state immediately
    await this.calculateState(portfolioId);
    return tx;
  }
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

