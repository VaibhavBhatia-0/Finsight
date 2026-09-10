import { Router } from 'express';
import { PortfolioController } from '../controllers/portfolio.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', PortfolioController.getPortfolios);
router.post('/', PortfolioController.createPortfolio);
router.get('/:id', PortfolioController.getPortfolioDetail);
router.get('/:id/transactions', PortfolioController.getTransactions);
router.post('/:id/transactions', PortfolioController.addTransaction);
router.delete('/:id', PortfolioController.deletePortfolio);

export default router;

