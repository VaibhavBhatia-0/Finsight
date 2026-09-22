import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { MarketAlertRepository } from '../repositories/marketAlert.repository';
import { StockRepository } from '../repositories/stock.repository';
import { sendSuccess } from '../utils/response';

export class MarketAlertController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await MarketAlertRepository.list(req.user!.id, req.query.stockId as string | undefined), 200, 'Configured'); }
    catch (error) { next(error); }
  }
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!await StockRepository.findById(req.body.stockId)) throw new AppError('Security not found', 404, 'SECURITY_NOT_FOUND');
      sendSuccess(res, await MarketAlertRepository.create(req.user!.id, req.body), 201, 'Configured');
    } catch (error) { next(error); }
  }
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const alert = await MarketAlertRepository.update(req.params.id, req.user!.id, req.body);
      if (!alert) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
      sendSuccess(res, alert, 200, 'Configured');
    } catch (error) { next(error); }
  }
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!await MarketAlertRepository.delete(req.params.id, req.user!.id)) throw new AppError('Alert not found', 404, 'ALERT_NOT_FOUND');
      sendSuccess(res, { deleted: true, id: req.params.id }, 200, 'Configured');
    } catch (error) { next(error); }
  }
}
