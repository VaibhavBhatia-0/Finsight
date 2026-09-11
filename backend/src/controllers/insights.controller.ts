import { NextFunction, Request, Response } from 'express';
import { InsightsService } from '../services/insights.service';
import { sendSuccess } from '../utils/response';

export class InsightsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InsightsService.getInsights(req.user!.id);
      const degraded = result.calculation.usesSyntheticMarketData || result.calculation.hasSyntheticFx;
      sendSuccess(res, result, 200, degraded ? 'Synthetic' : 'Static', {
        source: result.calculation.method,
        degraded,
      });
    } catch (error) {
      next(error);
    }
  }
}
