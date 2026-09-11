import { Router } from 'express';
import { MarketController } from '../controllers/market.controller';
import { validate } from '../middleware/validate';
import { screenerQuerySchema } from '../validators/market.validator';

const router = Router();

router.get('/overview', MarketController.getOverview);
router.get('/stocks', MarketController.getStocks);
router.get('/stocks/:id', MarketController.getStockDetail);
router.get('/stocks/:id/prices', MarketController.getStockPrices);
router.get('/screener', validate({ query: screenerQuerySchema }), MarketController.screenStocks);
router.get('/fx', MarketController.getFxRate);

export default router;
