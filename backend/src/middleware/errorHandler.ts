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
    sendError(res, 409, 'DUPLICATE_RESOURCE', 'A resource with these unique attributes already exists', [
      { detail: err.detail }
    ]);
    return;
  }

  // PostgreSQL Foreign Key Violation
  if (err.code === '23503') {
    sendError(res, 400, 'FOREIGN_KEY_VIOLATION', 'Referenced entity does not exist', [
      { detail: err.detail }
    ]);
    return;
  }

  // Unhandled / Internal Server Error
  console.error('[Unhandled Error]', err);
  sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected internal error occurred');
}

