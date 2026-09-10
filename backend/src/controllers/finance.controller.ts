import { NextFunction, Request, Response } from 'express';
import { FinanceRepository } from '../repositories/finance.repository';
import { FinanceService } from '../services/finance.service';
import { AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';

export class FinanceController {
  static async transactions(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await FinanceRepository.getTransactions(req.user!.id, req.query as any)); } catch (error) { next(error); } }
  static async createTransaction(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await FinanceRepository.addTransaction(req.user!.id, req.body), 201, 'Live'); } catch (error) { next(error); } }
  static async updateTransaction(req: Request, res: Response, next: NextFunction) { try { const value = await FinanceRepository.updateTransaction(req.params.id, req.user!.id, req.body); if (!value) throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND'); sendSuccess(res, value); } catch (error) { next(error); } }
  static async deleteTransaction(req: Request, res: Response, next: NextFunction) { try { await FinanceRepository.deleteTransaction(req.params.id, req.user!.id); sendSuccess(res, { deleted: true }); } catch (error) { next(error); } }
  static async budgets(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await FinanceRepository.getBudgets(req.user!.id)); } catch (error) { next(error); } }
  static async createBudget(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await FinanceRepository.createBudget(req.user!.id, req.body), 201, 'Live'); } catch (error) { next(error); } }
  static async updateBudget(req: Request, res: Response, next: NextFunction) { try { const value = await FinanceRepository.updateBudget(req.params.id, req.user!.id, req.body); if (!value) throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND'); sendSuccess(res, value); } catch (error) { next(error); } }
  static async deleteBudget(req: Request, res: Response, next: NextFunction) { try { await FinanceRepository.deleteBudget(req.params.id, req.user!.id); sendSuccess(res, { deleted: true }); } catch (error) { next(error); } }
  static async goals(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await FinanceRepository.getSavingsGoals(req.user!.id)); } catch (error) { next(error); } }
  static async createGoal(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await FinanceRepository.createSavingsGoal(req.user!.id, req.body), 201, 'Live'); } catch (error) { next(error); } }
  static async updateGoal(req: Request, res: Response, next: NextFunction) { try { const value = await FinanceRepository.updateSavingsGoal(req.params.id, req.user!.id, req.body); if (!value) throw new AppError('Goal not found', 404, 'GOAL_NOT_FOUND'); sendSuccess(res, value); } catch (error) { next(error); } }
  static async deleteGoal(req: Request, res: Response, next: NextFunction) { try { await FinanceRepository.deleteSavingsGoal(req.params.id, req.user!.id); sendSuccess(res, { deleted: true }); } catch (error) { next(error); } }
  static async summary(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await FinanceService.getSummary(req.user!.id)); } catch (error) { next(error); } }
}
