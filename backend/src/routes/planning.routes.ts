import { Router } from 'express';
import { PlanningController } from '../controllers/planning.controller';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { recurringPlannerSchema, replaySchema, requiredContributionSchema, whatIfSchema } from '../validators/planning.validator';

const router = Router();
router.use(requireAuth);
const analyticsLimit = rateLimit({ windowMs: 60_000, max: 20 });
router.post('/required-contribution', analyticsLimit, validate({ body: requiredContributionSchema }), PlanningController.requiredContribution);
router.post('/what-if', analyticsLimit, validate({ body: whatIfSchema }), PlanningController.whatIf);
router.post('/replay', analyticsLimit, validate({ body: replaySchema }), PlanningController.replay);
router.post('/recurring', analyticsLimit, validate({ body: recurringPlannerSchema }), PlanningController.recurring);
export default router;
