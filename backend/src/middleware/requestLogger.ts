import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    console.log(JSON.stringify({
      level: 'info',
      event: 'http_request',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.id ?? null,
      timestamp: new Date().toISOString(),
    }));
  });
  next();
}
