import { NextFunction, Request, Response } from 'express';
import { PlanningService } from '../services/planning.service';
import { sendSuccess } from '../utils/response';

export class PlanningController {
  static async requiredContribution(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PlanningService.requiredContribution(req.body), 200, 'Historical'); }
    catch (error) { next(error); }
  }
  static async whatIf(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PlanningService.whatIf(req.user!.id, req.body), 200, 'Historical'); }
    catch (error) { next(error); }
  }
  static async replay(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PlanningService.replay(req.user!.id, req.body), 200, 'Historical'); }
    catch (error) { next(error); }
  }
  static async recurring(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PlanningService.recurring(req.user!.id, req.body), 200, 'Historical'); }
    catch (error) { next(error); }
  }
}
