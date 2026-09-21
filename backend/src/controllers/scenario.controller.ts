import { Request, Response, NextFunction } from 'express';
import { ScenarioService } from '../services/scenario.service';
import { ScenarioRepository } from '../repositories/scenario.repository';
import { sendSuccess, sendError } from '../utils/response';

export class ScenarioController {
  static async runSimulation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ScenarioService.runSimulation(req.body);
      const test = process.env.NODE_ENV === 'test';
      sendSuccess(res, result, 200, test ? 'SYNTHETIC' : 'Historical', { source: test ? 'FINSIGHT_TEST_FIXTURE' : 'YAHOO_FINANCE_CHART', degraded: false });
    } catch (error) {
      next(error);
    }
  }

  static async saveScenario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const saved = await ScenarioService.saveScenario(userId, req.body);
      sendSuccess(res, saved, 201, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async getScenarios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const scenarios = await ScenarioRepository.findByUserId(userId);
      sendSuccess(res, scenarios, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async getScenarioDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const scenario = await ScenarioRepository.findById(id, userId);
      if (!scenario) {
        sendError(res, 404, 'SCENARIO_NOT_FOUND', 'Scenario not found');
        return;
      }
      sendSuccess(res, scenario, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async deleteScenario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      await ScenarioRepository.delete(id, userId);
      sendSuccess(res, { deleted: true, id }, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async compareScenarios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      sendSuccess(res, await ScenarioService.compareScenarios(userId, req.body.scenarioIds), 200, 'Historical');
    } catch (error) {
      next(error);
    }
  }
}
