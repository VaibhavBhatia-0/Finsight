import { Router } from 'express';
import { WatchlistController } from '../controllers/watchlist.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', WatchlistController.getWatchlists);
router.post('/', WatchlistController.createWatchlist);
router.post('/:id/items', WatchlistController.addItem);
router.delete('/:id/items/:stockId', WatchlistController.removeItem);
router.delete('/:id', WatchlistController.deleteWatchlist);

export default router;

