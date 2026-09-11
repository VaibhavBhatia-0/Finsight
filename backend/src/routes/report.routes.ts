import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { reportQuerySchema } from '../validators/report.validator';

const router = Router();
router.use(requireAuth);
router.get('/export', validate({ query: reportQuerySchema }), ReportController.export);

export default router;
