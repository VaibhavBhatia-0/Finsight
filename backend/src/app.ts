import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { sendError, sendSuccess } from './utils/response';
import authRoutes from './routes/auth.routes';
import marketRoutes from './routes/market.routes';
import watchlistRoutes from './routes/watchlist.routes';
import portfolioRoutes from './routes/portfolio.routes';
import scenarioRoutes from './routes/scenario.routes';
import financeRoutes from './routes/finance.routes';
import backtestRoutes from './routes/backtest.routes';
import insightsRoutes from './routes/insights.routes';
import reportRoutes from './routes/report.routes';
import { requestLogger } from './middleware/requestLogger';
import { openApiDocument } from './openapi';
import planningRoutes from './routes/planning.routes';
import marketAlertRoutes from './routes/marketAlert.routes';

export function createApp(): Express {
  const app: Express = express();
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production' && (!process.env.CORS_ORIGIN || corsOrigins.includes('*'))) {
    throw new Error('CORS_ORIGIN must contain explicit trusted frontend origins in production');
  }

  // Security & Utility Middleware
  app.use(helmet());
  app.use(cors({
    origin: corsOrigins,
    credentials: true,
  }));
  app.use(requestLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Root & Health Check Endpoints
  app.get('/health', (req: Request, res: Response) => {
    sendSuccess(res, { status: 'healthy', uptime: process.uptime() }, 200, 'Live');
  });

  app.get('/api/v1/health', (req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }, 200, 'Live');
  });

  app.get('/api/v1/openapi.json', (_req: Request, res: Response) => res.json(openApiDocument));

  // Mount API Modules under /api/v1
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/markets', marketRoutes);
  app.use('/api/v1/watchlists', watchlistRoutes);
  app.use('/api/v1/portfolios', portfolioRoutes);
  app.use('/api/v1/scenarios', scenarioRoutes);
  app.use('/api/v1/finance', financeRoutes);
  app.use('/api/v1/backtests', backtestRoutes);
  app.use('/api/v1/planning', planningRoutes);
  app.use('/api/v1/insights', insightsRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/alerts', marketAlertRoutes);

  app.use((req: Request, res: Response) => {
    sendError(res, 404, 'ROUTE_NOT_FOUND', `No API route matches ${req.method} ${req.path}`);
  });

  // Centralized Error Handling Middleware (must be registered last)
  app.use(errorHandler);

  return app;
}
