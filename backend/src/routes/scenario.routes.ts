import { Router } from 'express';
import { ScenarioController } from '../controllers/scenario.controller';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

// Public exploration simulation
router.post('/simulate', optionalAuth, ScenarioController.runSimulation);

// User-scoped saved scenarios
router.use(requireAuth);
router.get('/', ScenarioController.getScenarios);
router.post('/', ScenarioController.saveScenario);
router.post('/compare', ScenarioController.compareScenarios);
router.get('/:id', ScenarioController.getScenarioDetail);
router.delete('/:id', ScenarioController.deleteScenario);

export default router;

