import { Request, Response, NextFunction } from 'express';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { PortfolioService } from '../services/portfolio.service';
import { sendSuccess, sendError } from '../utils/response';

export class PortfolioController {
  static async getPortfolios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const portfolios = await PortfolioRepository.findByUserId(userId);

      const valuations = await Promise.all(
        portfolios.map(p => PortfolioService.getValuation(p.id, userId))
      );

      sendSuccess(res, valuations, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async createPortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, baseCurrency, benchmarkId, initialDeposit } = req.body;
      const portfolio = await PortfolioRepository.create(userId, {
        name: name || 'Primary Portfolio',
        baseCurrency: baseCurrency || 'INR',
        benchmarkId,
      });

      if (initialDeposit?.amount > 0) {
        await PortfolioService.addTransaction(userId, portfolio.id, {
          transactionType: 'DEPOSIT',
          transactionDate: initialDeposit.date,
          amount: initialDeposit.amount,
          currency: portfolio.base_currency,
          feeAmount: 0,
          notes: 'Opening cash contribution',
        });
      }

      const valuation = await PortfolioService.getValuation(portfolio.id, userId);
      sendSuccess(res, valuation, 201, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async getPortfolioDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const valuation = await PortfolioService.getValuation(id, userId);
      sendSuccess(res, valuation, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const portfolio = await PortfolioRepository.findById(id, userId);
      if (!portfolio) {
        sendError(res, 404, 'PORTFOLIO_NOT_FOUND', 'Portfolio not found');
        return;
      }

      const txs = await PortfolioRepository.getTransactions(id);
      sendSuccess(res, txs, 200, 'Historical');
    } catch (error) {
      next(error);
    }
  }

  static async addTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const tx = await PortfolioService.addTransaction(userId, id, req.body);
      const updatedValuation = await PortfolioService.getValuation(id, userId);
      sendSuccess(res, { transaction: tx, valuation: updatedValuation }, 201, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async previewTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { sendSuccess(res, await PortfolioService.previewTransaction(req.user!.id, req.params.id, req.body), 200, 'Historical'); }
    catch (error) { next(error); }
  }

  static async deletePortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      await PortfolioRepository.delete(id, userId);
      sendSuccess(res, { deleted: true, id }, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async updatePortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await PortfolioService.updatePortfolio(req.user!.id, req.params.id, req.body), 200, 'Live');
    } catch (error) { next(error); }
  }

  static async getIntelligence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await PortfolioService.getIntelligence(req.params.id, req.user!.id), 200, 'Historical', {
        source: process.env.NODE_ENV === 'test' ? 'FINSIGHT_TEST_FIXTURE' : 'YAHOO_FINANCE_CHART',
        degraded: false,
      });
    } catch (error) { next(error); }
  }

  static async compare(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await PortfolioService.comparePortfolios(req.user!.id, req.body.portfolioIds), 200, 'Historical');
    } catch (error) { next(error); }
  }

  static async benchmarks(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { sendSuccess(res, await PortfolioRepository.listBenchmarks(), 200, 'Historical'); }
    catch (error) { next(error); }
  }
}
