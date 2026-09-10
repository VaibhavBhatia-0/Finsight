import { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/response';

const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${req.ip}:${req.baseUrl}:${req.route?.path ?? req.path}`;
    const current = windows.get(key);
    const value = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    value.count += 1;
    windows.set(key, value);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - value.count)));
    if (value.count > max) {
      sendError(res, 429, 'RATE_LIMITED', 'Too many requests; try again later');
      return;
    }
    next();
  };
}
