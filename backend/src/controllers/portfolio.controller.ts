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
      const { name, baseCurrency, benchmarkId } = req.body;
      const portfolio = await PortfolioRepository.create(userId, {
        name: name || 'Primary Portfolio',
        baseCurrency: baseCurrency || 'INR',
        benchmarkId,
      });

      // Automatically add initial virtual deposit of 100,000 to enable starting
      await PortfolioRepository.addTransaction({
        portfolioId: portfolio.id,
        transactionType: 'DEPOSIT',
        transactionDate: new Date().toISOString().slice(0, 10),
        amount: 100000,
        currency: portfolio.base_currency,
        notes: 'Initial hypothetical deposit',
      });

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
}

