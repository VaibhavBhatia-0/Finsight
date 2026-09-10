import { Request, Response, NextFunction } from 'express';
import { MarketDataService } from '../services/marketData.service';
import { FXService } from '../services/fx.service';
import { StockRepository } from '../repositories/stock.repository';
import { sendSuccess, sendError } from '../utils/response';

export class MarketController {
  static async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await MarketDataService.getMarketOverview();
      sendSuccess(res, overview, 200, 'Synthetic', { source: 'FINSIGHT_DEVELOPMENT_FIXTURE', degraded: true });
    } catch (error) {
      next(error);
    }
  }

  static async getStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      let stocks: any[];

      if (q && typeof q === 'string' && q.trim()) {
        stocks = await StockRepository.search(q.trim());
      } else {
        stocks = await StockRepository.findAll();
      }

      // Attach current quotes
      const stocksWithQuotes = await Promise.all(
        stocks.map(async (stock) => {
          const quote = await MarketDataService.getQuote(stock.symbol);
          return {
            ...stock,
            quote,
          };
        })
      );

      sendSuccess(res, stocksWithQuotes, 200, 'Synthetic', { source: 'FINSIGHT_DEVELOPMENT_FIXTURE', degraded: true });
    } catch (error) {
      next(error);
    }
  }

  static async getStockDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const stock = /^\d+$/.test(id) ? await StockRepository.findById(id) : await StockRepository.findBySymbol(id);
      if (!stock) {
        sendError(res, 404, 'STOCK_NOT_FOUND', `Stock with ID ${id} not found`);
        return;
      }

      const quote = await MarketDataService.getQuote(stock.symbol);
      const fundamentals = await MarketDataService.getStockFundamentals(stock.symbol);
      const dividends = await StockRepository.getDividends(stock.id);
      const corporateActions = await StockRepository.getCorporateActions(stock.id);

      sendSuccess(res, {
        stock,
        quote,
        fundamentals,
        dividends,
        corporateActions,
      }, 200, quote.freshness, { source: 'FINSIGHT_DEVELOPMENT_FIXTURE', degraded: true });
    } catch (error) {
      next(error);
    }
  }

  static async getStockPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const stock = await StockRepository.findById(id);
      if (!stock) {
        sendError(res, 404, 'STOCK_NOT_FOUND', `Stock with ID ${id} not found`);
        return;
      }

      const prices = await MarketDataService.getPriceHistory(
        stock.id,
        stock.symbol,
        startDate as string,
        endDate as string
      );

      sendSuccess(res, prices, 200, 'Synthetic', { source: 'FINSIGHT_DEVELOPMENT_FIXTURE', degraded: true });
    } catch (error) {
      next(error);
    }
  }

  static async screenStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        exchange,
        country,
        sector,
        minPrice,
        maxPrice,
        minPe,
        maxPe,
        minDivYield,
        maxDivYield,
        minMarketCap,
        maxMarketCap,
        minRsi,
        maxRsi,
        sortBy,
        sortOrder,
        page,
        limit,
      } = req.query;

      const results = await MarketDataService.screenStocks({
        exchange: exchange as string,
        country: country as string,
        sector: sector as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        minPe: minPe ? parseFloat(minPe as string) : undefined,
        maxPe: maxPe ? parseFloat(maxPe as string) : undefined,
        minDivYield: minDivYield ? parseFloat(minDivYield as string) : undefined,
        maxDivYield: maxDivYield ? parseFloat(maxDivYield as string) : undefined,
        minMarketCap: minMarketCap ? parseFloat(minMarketCap as string) : undefined,
        maxMarketCap: maxMarketCap ? parseFloat(maxMarketCap as string) : undefined,
        minRsi: minRsi ? parseFloat(minRsi as string) : undefined,
        maxRsi: maxRsi ? parseFloat(maxRsi as string) : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      sendSuccess(res, results, 200, 'Synthetic', { source: 'FINSIGHT_DEVELOPMENT_FIXTURE', degraded: true });
    } catch (error) {
      next(error);
    }
  }

  static async getFxRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from = 'USD', to = 'INR', date } = req.query;
      const rateInfo = await FXService.convertAmount(1.0, from as string, to as string, date as string);
      sendSuccess(res, {
        from,
        to,
        rate: rateInfo.rate,
        date: date || new Date().toISOString().slice(0, 10),
      }, 200, rateInfo.freshness as any);
    } catch (error) {
      next(error);
    }
  }
}
