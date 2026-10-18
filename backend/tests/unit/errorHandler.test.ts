import express from 'express';
import http from 'http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler';
import { requestLogger } from '../../src/middleware/requestLogger';

describe('production error diagnostics', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs a request-correlated sanitized diagnostic while returning a generic response', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = express();
    app.use(requestLogger);
    app.get('/failure', () => {
      const error = new Error('database postgresql://admin:super-secret@db.example/app token=private-token');
      Object.assign(error, { code: '42703' });
      throw error;
    });
    app.use(errorHandler);
    const server = await listen(app);

    try {
      const address = server.address() as { port: number };
      const response = await fetch(`http://127.0.0.1:${address.port}/failure`);
      const body = await response.json() as any;
      const requestId = response.headers.get('x-request-id');
      const diagnostic = JSON.parse(String(logged.mock.calls[0][0]));

      expect(response.status).toBe(500);
      expect(body).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected internal error occurred' } });
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(diagnostic).toMatchObject({ event: 'unhandled_error', requestId, method: 'GET', path: '/failure', statusCode: 500, errorName: 'Error', errorCode: '42703' });
      expect(JSON.stringify(diagnostic)).not.toContain('super-secret');
      expect(JSON.stringify(diagnostic)).not.toContain('private-token');
      expect(diagnostic.message).toContain('postgresql://[REDACTED]@db.example/app');
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});

function listen(app: express.Express): Promise<http.Server> {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
