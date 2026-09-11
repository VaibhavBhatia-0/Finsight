import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { OAuthStateRepository } from '../repositories/oauthState.repository';
import { UserRepository } from '../repositories/user.repository';
import { UserPreferencesRepository } from '../repositories/userPreferences.repository';
import { db } from '../database/db';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';

interface GoogleTokenInfo {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
}

export class GoogleOAuthService {
  private static config() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const frontendUrl = process.env.FRONTEND_URL;
    if (!clientId || !clientSecret || !redirectUri || !frontendUrl) throw new AppError('Google OAuth is not configured', 503, 'OAUTH_NOT_CONFIGURED');
    return { clientId, clientSecret, redirectUri, frontendUrl };
  }

  static async authorizationUrl() {
    const config = this.config();
    const state = await OAuthStateRepository.create();
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }

  static async callback(code: string, state: string) {
    const config = this.config();
    if (!await OAuthStateRepository.consume(state)) throw new AppError('OAuth state is invalid or expired', 400, 'INVALID_OAUTH_STATE');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) throw new AppError('Google authorization code exchange failed', 401, 'OAUTH_EXCHANGE_FAILED');
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) throw new AppError('Google did not return an identity token', 401, 'OAUTH_IDENTITY_MISSING');
    const infoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`, { signal: AbortSignal.timeout(10_000) });
    if (!infoResponse.ok) throw new AppError('Google identity token validation failed', 401, 'OAUTH_IDENTITY_INVALID');
    const identity = await infoResponse.json() as GoogleTokenInfo;
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss || '') || identity.aud !== config.clientId || identity.email_verified !== 'true' || !identity.sub || !identity.email) {
      throw new AppError('Google identity claims are invalid', 401, 'OAUTH_IDENTITY_INVALID');
    }

    let user = await UserRepository.findByGoogleSubject(identity.sub);
    if (!user) {
      const existing = await UserRepository.findByEmail(identity.email);
      if (existing) {
        user = await UserRepository.linkGoogle(existing.id, identity.sub);
      } else {
        const passwordHash = await hashPassword(crypto.randomBytes(48).toString('base64url'));
        user = await db.transaction(async executor => {
          const created = await UserRepository.create({ id: crypto.randomUUID(), email: identity.email!, passwordHash, name: identity.name, baseCurrency: 'INR' }, executor);
          const linked = await UserRepository.linkGoogle(created.id, identity.sub!, executor);
          await UserPreferencesRepository.createDefault(created.id, created.base_currency, executor);
          return linked;
        });
      }
    }
    if (!user) throw new AppError('Unable to create Google account', 500, 'OAUTH_ACCOUNT_ERROR');
    return { token: signToken({ userId: user.id, email: user.email, authVersion: user.auth_version }), frontendUrl: config.frontendUrl };
  }
}
