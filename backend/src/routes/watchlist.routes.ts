import { Router } from 'express';
import { WatchlistController } from '../controllers/watchlist.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addWatchlistItemSchema, createWatchlistSchema, watchlistIdParamsSchema, watchlistItemParamsSchema } from '../validators/watchlist.validator';

const router = Router();

router.use(requireAuth);

router.get('/', WatchlistController.getWatchlists);
router.post('/', validate({ body: createWatchlistSchema }), WatchlistController.createWatchlist);
router.post('/:id/items', validate({ params: watchlistIdParamsSchema, body: addWatchlistItemSchema }), WatchlistController.addItem);
router.delete('/:id/items/:stockId', validate({ params: watchlistItemParamsSchema }), WatchlistController.removeItem);
router.delete('/:id', validate({ params: watchlistIdParamsSchema }), WatchlistController.deleteWatchlist);

export default router;
