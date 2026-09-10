import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { UserRepository } from '../repositories/user.repository';
import { sendError } from '../utils/response';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  baseCurrency: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication token is missing or invalid');
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload: TokenPayload = verifyToken(token);
    const user = await UserRepository.findById(payload.userId);
    if (!user) {
      sendError(res, 401, 'UNAUTHORIZED', 'User associated with token no longer exists');
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      baseCurrency: user.base_currency,
    };
    next();
  } catch (error: any) {
    sendError(res, 401, 'INVALID_TOKEN', 'Authentication token has expired or is invalid');
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload: TokenPayload = verifyToken(token);
    const user = await UserRepository.findById(payload.userId);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.base_currency,
      };
    }
  } catch {
    // Ignore invalid token in optionalAuth
  }
  next();
}

