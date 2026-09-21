import { Request, Response, NextFunction } from 'express';
import { WatchlistRepository } from '../repositories/watchlist.repository';
import { MarketDataService } from '../services/marketData.service';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
import type { StockQuote } from '../services/marketData/types';

export class WatchlistController {
  static async getWatchlists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      let watchlists = await WatchlistRepository.getByUserId(userId);

      if (watchlists.length === 0) {
        // Create a default watchlist
        const defaultWl = await WatchlistRepository.create(userId, 'Main Watchlist');
        watchlists = [defaultWl];
      }

      const enriched = await Promise.all(
        watchlists.map(async (wl) => {
          const items = await WatchlistRepository.getItems(wl.id);
          const itemsWithQuotes = await Promise.all(
            items.map(async (item) => {
              try {
                return { ...item, quote: await MarketDataService.getQuote(item.symbol, item.exchange_code) };
              } catch {
                return { ...item, quote: null, quoteError: 'UNAVAILABLE' };
              }
            })
          );
          return {
            ...wl,
            items: itemsWithQuotes,
          };
        })
      );

      const quotes: StockQuote[] = enriched.flatMap(watchlist => watchlist.items.flatMap((item: { quote: StockQuote | null }) => item.quote ? [item.quote] : []));
      const unavailable = enriched.some(watchlist => watchlist.items.some((item: { quote: StockQuote | null }) => !item.quote));
      const degraded = quotes.some(quote => quote.isStale || quote.freshness === 'SYNTHETIC');
      const freshness = unavailable ? 'UNAVAILABLE' : quotes.some(quote => quote.freshness === 'STALE') ? 'STALE' : (quotes[0]?.freshness || 'UNAVAILABLE');
      sendSuccess(res, enriched, 200, freshness, { source: [...new Set(quotes.map(quote => quote.source))].join(',') || 'NO_QUOTES', degraded: degraded || unavailable });
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
      const owned = await WatchlistRepository.addItem(id, stockId, req.user!.id);
      if (!owned) throw new AppError('Watchlist not found', 404, 'WATCHLIST_NOT_FOUND');
      sendSuccess(res, { added: true, watchlistId: id, stockId }, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, stockId } = req.params;
      const owned = await WatchlistRepository.removeItem(id, stockId, req.user!.id);
      if (!owned) throw new AppError('Watchlist not found', 404, 'WATCHLIST_NOT_FOUND');
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
