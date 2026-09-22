import { Router } from 'express';
import { PortfolioController } from '../controllers/portfolio.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPortfolioSchema, portfolioComparisonSchema, portfolioIdParamsSchema, portfolioTransactionPreviewSchema, portfolioTransactionSchema, updatePortfolioSchema } from '../validators/portfolio.validator';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(requireAuth);

router.get('/', PortfolioController.getPortfolios);
router.post('/', validate({ body: createPortfolioSchema }), PortfolioController.createPortfolio);
router.get('/benchmarks', PortfolioController.benchmarks);
router.post('/compare', rateLimit({ windowMs: 60_000, max: 10 }), validate({ body: portfolioComparisonSchema }), PortfolioController.compare);
router.get('/:id', validate({ params: portfolioIdParamsSchema }), PortfolioController.getPortfolioDetail);
router.patch('/:id', validate({ params: portfolioIdParamsSchema, body: updatePortfolioSchema }), PortfolioController.updatePortfolio);
router.get('/:id/intelligence', rateLimit({ windowMs: 60_000, max: 20 }), validate({ params: portfolioIdParamsSchema }), PortfolioController.getIntelligence);
router.get('/:id/transactions', validate({ params: portfolioIdParamsSchema }), PortfolioController.getTransactions);
router.post('/:id/transaction-preview', rateLimit({ windowMs: 60_000, max: 60 }), validate({ params: portfolioIdParamsSchema, body: portfolioTransactionPreviewSchema }), PortfolioController.previewTransaction);
router.post('/:id/transactions', validate({ params: portfolioIdParamsSchema, body: portfolioTransactionSchema }), PortfolioController.addTransaction);
router.delete('/:id', validate({ params: portfolioIdParamsSchema }), PortfolioController.deletePortfolio);

export default router;
