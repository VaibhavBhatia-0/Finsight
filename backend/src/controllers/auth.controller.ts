import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { GoogleOAuthService } from '../services/googleOAuth.service';
import { AppError } from '../middleware/errorHandler';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      sendSuccess(res, result, 201, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      sendSuccess(res, result, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await AuthService.getProfile(userId);
      sendSuccess(res, result, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const updated = await AuthService.updatePreferences(userId, req.body);
      sendSuccess(res, updated, 200, 'Live');
    } catch (error) {
      next(error);
    }
  }

  static async requestEmailVerification(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await AuthService.requestEmailVerification(req.body.email), 202, 'Live'); } catch (error) { next(error); } }
  static async verifyEmail(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await AuthService.verifyEmail(req.body.token), 200, 'Live'); } catch (error) { next(error); } }
  static async requestPasswordReset(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await AuthService.requestPasswordReset(req.body.email), 202, 'Live'); } catch (error) { next(error); } }
  static async resetPassword(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await AuthService.resetPassword(req.body.token, req.body.password), 200, 'Live'); } catch (error) { next(error); } }
  static async logout(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await AuthService.logout(req.user!.id), 200, 'Live'); } catch (error) { next(error); } }
  static async googleStart(req: Request, res: Response, next: NextFunction) { try { sendSuccess(res, await GoogleOAuthService.authorizationUrl(), 200, 'Live'); } catch (error) { next(error); } }
  static async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.query.error) await GoogleOAuthService.cancel(String(req.query.state));
      const result = await GoogleOAuthService.callback(String(req.query.code), String(req.query.state));
      sendOAuthPopup(res, new URL(result.frontendUrl).origin, { token: result.token });
    } catch (error) {
      if (error instanceof AppError) {
        try {
          sendOAuthPopup(res, GoogleOAuthService.frontendOrigin(), { error: { code: error.code, message: error.message } });
        } catch (configurationError) { next(configurationError); }
        return;
      }
      next(error);
    }
  }
}

function sendOAuthPopup(res: Response, targetOrigin: string, result: { token?: string; error?: { code: string; message: string } }) {
  const nonce = crypto.randomBytes(18).toString('base64url');
  const payload = JSON.stringify({ type: 'finsight-google-oauth', ...result }).replace(/</g, '\\u003c');
  const script = `window.opener&&window.opener.postMessage(${payload},${JSON.stringify(targetOrigin)});window.close();`;
  res.status(200)
    .type('html')
    .setHeader('Cache-Control', 'no-store')
    .setHeader('Referrer-Policy', 'no-referrer')
    .setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`)
    .send(`<!doctype html><html><head><meta charset="utf-8"><title>FinSight sign-in</title></head><body><p>Authentication complete. This window may close.</p><script nonce="${nonce}">${script}</script></body></html>`);
}
