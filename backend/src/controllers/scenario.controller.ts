import { Request, Response, NextFunction } from 'express';
import { ScenarioService } from '../services/scenario.service';
import { ScenarioRepository } from '../repositories/scenario.repository';
import { sendSuccess, sendError } from '../utils/response';

export class ScenarioController {
  static async runSimulation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ScenarioService.runSimulation(req.body);
      sendSuccess(res, result, 200, 'Historical');
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
      const { scenarioIds } = req.body;
      if (!Array.isArray(scenarioIds) || scenarioIds.length < 2) {
        sendError(res, 400, 'INVALID_INPUT', 'At least two scenario IDs must be provided for comparison');
        return;
      }

      const scenarios = await Promise.all(
        scenarioIds.map(id => ScenarioRepository.findById(id, userId))
      );

      const validScenarios = scenarios.filter(Boolean);
      sendSuccess(res, { comparisons: validScenarios }, 200, 'Historical');
    } catch (error) {
      next(error);
    }
  }
}

