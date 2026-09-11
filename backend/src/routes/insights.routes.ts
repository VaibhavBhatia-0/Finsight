import { Router } from 'express';
import { InsightsController } from '../controllers/insights.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.get('/', InsightsController.list);

export default router;
