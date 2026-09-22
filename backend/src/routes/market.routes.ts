import { Router } from 'express';
import { MarketController } from '../controllers/market.controller';
import { validate } from '../middleware/validate';
import { fxQuerySchema, historicalPriceQuerySchema, marketComparisonSchema, screenerQuerySchema, securityIdParamsSchema, securitySearchQuerySchema, stockIdentityParamsSchema, stockListQuerySchema, stockPricesQuerySchema, technicalQuerySchema } from '../validators/market.validator';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.get('/overview', rateLimit({ windowMs: 60_000, max: 60 }), MarketController.getOverview);
router.get('/health', rateLimit({ windowMs: 60_000, max: 60 }), MarketController.getHealth);
router.get('/securities/search', rateLimit({ windowMs: 60_000, max: 120 }), validate({ query: securitySearchQuerySchema }), MarketController.searchSecurities);
router.get('/securities/stats', rateLimit({ windowMs: 60_000, max: 60 }), MarketController.getUniverseStats);
router.get('/securities/:id/quote', rateLimit({ windowMs: 60_000, max: 60 }), validate({ params: securityIdParamsSchema }), MarketController.getSecurityQuote);
router.get('/securities/:id/historical-price', rateLimit({ windowMs: 60_000, max: 60 }), validate({ params: securityIdParamsSchema, query: historicalPriceQuerySchema }), MarketController.getHistoricalPrice);
router.get('/securities/:id/technicals', rateLimit({ windowMs: 60_000, max: 30 }), validate({ params: securityIdParamsSchema, query: technicalQuerySchema }), MarketController.getTechnicals);
router.post('/compare', rateLimit({ windowMs: 60_000, max: 10 }), validate({ body: marketComparisonSchema }), MarketController.compareSecurities);
router.get('/stocks', rateLimit({ windowMs: 60_000, max: 30 }), validate({ query: stockListQuerySchema }), MarketController.getStocks);
router.get('/stocks/:id', rateLimit({ windowMs: 60_000, max: 30 }), validate({ params: stockIdentityParamsSchema }), MarketController.getStockDetail);
router.get('/stocks/:id/prices', rateLimit({ windowMs: 60_000, max: 30 }), validate({ params: securityIdParamsSchema, query: stockPricesQuerySchema }), MarketController.getStockPrices);
router.get('/screener', rateLimit({ windowMs: 60_000, max: 20 }), validate({ query: screenerQuerySchema }), MarketController.screenStocks);
router.get('/fx', rateLimit({ windowMs: 60_000, max: 60 }), validate({ query: fxQuerySchema }), MarketController.getFxRate);

export default router;
