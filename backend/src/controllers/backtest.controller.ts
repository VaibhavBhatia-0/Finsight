import { NextFunction, Request, Response } from 'express';
import { BacktestRepository } from '../repositories/backtest.repository';
import { BacktestService } from '../services/backtest.service';
import { AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';

export class BacktestController {
  static async run(req: Request,res: Response,next: NextFunction) { try { sendSuccess(res, await BacktestService.run(req.user!.id, req.body), 201, 'Synthetic', { source: 'FINSIGHT_DEVELOPMENT_FIXTURE', degraded: true }); } catch(error) { next(error); } }
  static async list(req: Request,res: Response,next: NextFunction) { try { sendSuccess(res, (await BacktestRepository.list(req.user!.id)).map(BacktestService.present), 200, 'Historical'); } catch(error) { next(error); } }
  static async get(req: Request,res: Response,next: NextFunction) { try { const row=await BacktestRepository.find(req.params.id,req.user!.id); if(!row) throw new AppError('Backtest not found',404,'BACKTEST_NOT_FOUND'); sendSuccess(res,BacktestService.present(row),200,'Historical'); } catch(error) { next(error); } }
  static async delete(req: Request,res: Response,next: NextFunction) { try { await BacktestRepository.delete(req.params.id,req.user!.id); sendSuccess(res,{deleted:true}); } catch(error) { next(error); } }
}
