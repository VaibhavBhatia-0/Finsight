import { Response } from 'express';

export type DataFreshness = 'Live' | 'Delayed' | 'End-of-day' | 'Historical' | 'Static';

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  error: null;
  meta: {
    timestamp: string;
    freshness: DataFreshness;
    [key: string]: any;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any[];
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  freshness: DataFreshness = 'Static',
  additionalMeta: Record<string, any> = {}
): Response {
  const responsePayload: ApiSuccessResponse<T> = {
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      freshness,
      ...additionalMeta,
    },
  };
  return res.status(statusCode).json(responsePayload);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: any[]
): Response {
  const responsePayload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return res.status(statusCode).json(responsePayload);
}

