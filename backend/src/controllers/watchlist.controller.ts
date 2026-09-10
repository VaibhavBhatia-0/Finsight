import { Request, Response, NextFunction } from 'express';
import { WatchlistRepository } from '../repositories/watchlist.repository';
import { MarketDataService } from '../services/marketData.service';
import { sendSuccess } from '../utils/response';

export class WatchlistController {
  static async getWatchlists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      let watchlists = await WatchlistRepository.getByUserId(userId);

      if (watchlists.length === 0) {
        // Create a default watchlist
        const defaultWl = await WatchlistRepository.create(userId, 'Main Watchlist');
        // Add sample stocks
        await WatchlistRepository.addItem(defaultWl.id, 1); // RELIANCE
        await WatchlistRepository.addItem(defaultWl.id, 5); // NVDA
        watchlists = [defaultWl];
      }

      const enriched = await Promise.all(
        watchlists.map(async (wl) => {
          const items = await WatchlistRepository.getItems(wl.id);
          const itemsWithQuotes = await Promise.all(
            items.map(async (item) => {
              const quote = await MarketDataService.getQuote(item.symbol);
              return {
                ...item,
                quote,
              };
            })
          );
          return {
            ...wl,
            items: itemsWithQuotes,
          };
        })
      );

      sendSuccess(res, enriched, 200, 'Delayed');
    } catch (error) {
      next(error);
    }
  }

  static async createWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name } = req.body;
      const wl = await WatchlistRepository.create(userId, name || 'New Watchlist');
      sendSuccess(res, wl, 201, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { stockId } = req.body;
      await WatchlistRepository.addItem(id, stockId);
      sendSuccess(res, { added: true, watchlistId: id, stockId }, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, stockId } = req.params;
      await WatchlistRepository.removeItem(id, stockId);
      sendSuccess(res, { removed: true, watchlistId: id, stockId }, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async deleteWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      await WatchlistRepository.delete(id, userId);
      sendSuccess(res, { deleted: true, id }, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }
}

