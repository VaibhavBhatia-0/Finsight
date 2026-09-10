import { Router } from 'express';
import { z } from 'zod';
import { BacktestController } from '../controllers/backtest.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router=Router(); router.use(requireAuth);
const body=z.object({portfolioId:z.coerce.number().int().positive(),name:z.string().max(150).optional(),strategyType:z.literal('BUY_AND_HOLD').default('BUY_AND_HOLD'),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),initialAmount:z.coerce.number().positive().max(1_000_000_000)}).refine(v=>v.startDate<v.endDate,{path:['endDate'],message:'End date must be after start date'});
const params=z.object({id:z.coerce.number().int().positive()});
router.get('/',BacktestController.list); router.post('/',validate({body}),BacktestController.run); router.get('/:id',validate({params}),BacktestController.get); router.delete('/:id',validate({params}),BacktestController.delete);
export default router;
