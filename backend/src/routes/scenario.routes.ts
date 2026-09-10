import { Router } from 'express';
import { ScenarioController } from '../controllers/scenario.controller';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { scenarioSimulationSchema } from '../validators/scenario.validator';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// Public exploration simulation
router.post('/simulate', rateLimit({ windowMs: 60_000, max: 20 }), optionalAuth, validate({ body: scenarioSimulationSchema }), ScenarioController.runSimulation);

// User-scoped saved scenarios
router.use(requireAuth);
router.get('/', ScenarioController.getScenarios);
router.post('/', validate({ body: scenarioSimulationSchema }), ScenarioController.saveScenario);
router.post('/compare', ScenarioController.compareScenarios);
router.get('/:id', ScenarioController.getScenarioDetail);
router.delete('/:id', ScenarioController.deleteScenario);

export default router;
