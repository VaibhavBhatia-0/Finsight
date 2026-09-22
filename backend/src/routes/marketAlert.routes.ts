import { Router } from 'express';
import { MarketAlertController } from '../controllers/marketAlert.controller';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { createMarketAlertSchema, marketAlertIdParamsSchema, marketAlertQuerySchema, updateMarketAlertSchema } from '../validators/marketAlert.validator';

const router = Router();
router.use(requireAuth, rateLimit({ windowMs: 60_000, max: 60 }));
router.get('/', validate({ query: marketAlertQuerySchema }), MarketAlertController.list);
router.post('/', validate({ body: createMarketAlertSchema }), MarketAlertController.create);
router.patch('/:id', validate({ params: marketAlertIdParamsSchema, body: updateMarketAlertSchema }), MarketAlertController.update);
router.delete('/:id', validate({ params: marketAlertIdParamsSchema }), MarketAlertController.delete);
export default router;
