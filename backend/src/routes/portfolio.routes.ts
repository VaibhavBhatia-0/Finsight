import { Router } from 'express';
import { PortfolioController } from '../controllers/portfolio.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPortfolioSchema, portfolioIdParamsSchema, portfolioTransactionSchema } from '../validators/portfolio.validator';

const router = Router();

router.use(requireAuth);

router.get('/', PortfolioController.getPortfolios);
router.post('/', validate({ body: createPortfolioSchema }), PortfolioController.createPortfolio);
router.get('/:id', validate({ params: portfolioIdParamsSchema }), PortfolioController.getPortfolioDetail);
router.get('/:id/transactions', validate({ params: portfolioIdParamsSchema }), PortfolioController.getTransactions);
router.post('/:id/transactions', validate({ params: portfolioIdParamsSchema, body: portfolioTransactionSchema }), PortfolioController.addTransaction);
router.delete('/:id', validate({ params: portfolioIdParamsSchema }), PortfolioController.deletePortfolio);

export default router;
