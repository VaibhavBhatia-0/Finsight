import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any[];

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response headers already sent, delegate to default express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Zod Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Input validation failed', details);
    return;
  }

  // Known Application Errors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // PostgreSQL Unique Constraint Violation
  if (err.code === '23505') {
    sendError(res, 409, 'DUPLICATE_RESOURCE', 'A resource with these unique attributes already exists');
    return;
  }

  // PostgreSQL Foreign Key Violation
  if (err.code === '23503') {
    sendError(res, 400, 'FOREIGN_KEY_VIOLATION', 'Referenced entity does not exist');
    return;
  }

  // Unhandled / Internal Server Error
  const diagnostic = safeDiagnostic(err);
  console.error(JSON.stringify({
    level: 'error',
    event: 'unhandled_error',
    requestId: res.locals.requestId || res.getHeader('X-Request-ID') || null,
    method: req.method,
    path: req.path,
    statusCode: 500,
    errorName: diagnostic.name,
    errorCode: diagnostic.code,
    message: diagnostic.message,
    stack: diagnostic.stack,
    timestamp: new Date().toISOString(),
  }));
  sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected internal error occurred');
}

function safeDiagnostic(error: unknown): { name: string; code: string | null; message: string; stack: string | null } {
  const candidate = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const name = typeof candidate.name === 'string' ? clean(candidate.name, 100) : 'Error';
  const code = typeof candidate.code === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(candidate.code) ? candidate.code : null;
  const message = clean(error instanceof Error ? error.message : String(error || 'Unknown error'), 1000);
  const stack = error instanceof Error && error.stack ? clean(error.stack, 5000) : null;
  return { name, code, message, stack };
}

function clean(value: string, limit: number): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(postgres(?:ql)?):\/\/[^\s/@:]+:[^\s/@]+@/gi, '$1://[REDACTED]@')
    .replace(/\b(password|token|secret|authorization|cookie)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, limit);
}
