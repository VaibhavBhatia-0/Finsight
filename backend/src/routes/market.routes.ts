import { Router } from 'express';
import { MarketController } from '../controllers/market.controller';

const router = Router();

router.get('/overview', MarketController.getOverview);
router.get('/stocks', MarketController.getStocks);
router.get('/stocks/:id', MarketController.getStockDetail);
router.get('/stocks/:id/prices', MarketController.getStockPrices);
router.get('/screener', MarketController.screenStocks);
router.get('/fx', MarketController.getFxRate);

export default router;

