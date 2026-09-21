import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { OAuthStateRepository } from '../repositories/oauthState.repository';
import { AuthIdentityRepository } from '../repositories/authIdentity.repository';
import { UserRepository } from '../repositories/user.repository';
import { UserPreferencesRepository } from '../repositories/userPreferences.repository';
import { db } from '../database/db';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { verifyGoogleIdToken } from './googleIdentity.service';

let identityVerifier = verifyGoogleIdToken;

export function setGoogleIdentityVerifierForTests(verifier: typeof verifyGoogleIdToken): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Google identity verifier override is test-only');
  identityVerifier = verifier;
}

export class GoogleOAuthService {
  private static config() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    const frontendUrl = process.env.FRONTEND_URL?.trim();
    if (!clientId || !clientSecret || !redirectUri || !frontendUrl) throw new AppError('Google OAuth is not configured', 503, 'OAUTH_NOT_CONFIGURED');
    const redirect = validateApplicationUrl(redirectUri, 'Google redirect URI');
    const frontend = validateApplicationUrl(frontendUrl, 'Frontend URL');
    return { clientId, clientSecret, redirectUri: redirect.toString(), frontendUrl: frontend.toString(), callbackOrigin: redirect.origin };
  }

  static frontendOrigin(): string {
    return validateApplicationUrl(process.env.FRONTEND_URL || '', 'Frontend URL').origin;
  }

  static async authorizationUrl() {
    const config = this.config();
    const { state, nonce } = await OAuthStateRepository.create();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      prompt: 'select_account',
    });
    return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, callbackOrigin: config.callbackOrigin };
  }

  static async cancel(state: string): Promise<void> {
    if (!await OAuthStateRepository.consume(state)) throw new AppError('OAuth state is invalid or expired', 400, 'INVALID_OAUTH_STATE');
    throw new AppError('Google sign-in was cancelled', 400, 'OAUTH_CANCELLED');
  }

  static async callback(code: string, state: string) {
    const config = this.config();
    const oauthState = await OAuthStateRepository.consume(state);
    if (!oauthState) throw new AppError('OAuth state is invalid or expired', 400, 'INVALID_OAUTH_STATE');

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AppError('Google authorization is temporarily unavailable', 502, 'OAUTH_PROVIDER_UNAVAILABLE');
    }
    if (!tokenResponse.ok) throw new AppError('Google authorization could not be completed', 401, 'OAUTH_EXCHANGE_FAILED');
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) throw new AppError('Google did not return a valid identity', 401, 'OAUTH_IDENTITY_MISSING');
    const identity = await identityVerifier(tokens.id_token, config.clientId, oauthState.nonceHash);

    try {
      const user = await db.transaction(async executor => {
        const linkedIdentity = await AuthIdentityRepository.findBySubject('GOOGLE', identity.subject, executor);
        if (linkedIdentity) {
          const linkedUser = await UserRepository.findById(linkedIdentity.user_id, executor);
          if (!linkedUser) throw new AppError('Google identity is not linked to an active account', 409, 'OAUTH_ACCOUNT_LINK_CONFLICT');
          return linkedUser;
        }

        const existing = await UserRepository.findByEmail(identity.email, executor);
        if (existing) {
          if (!existing.email_verified_at) {
            throw new AppError('Verify the existing email account before linking Google sign-in', 409, 'OAUTH_ACCOUNT_LINK_CONFLICT');
          }
          const existingProvider = await AuthIdentityRepository.findByUser('GOOGLE', existing.id, executor);
          if (existingProvider && existingProvider.provider_subject !== identity.subject) {
            throw new AppError('This account is already linked to another Google identity', 409, 'OAUTH_ACCOUNT_LINK_CONFLICT');
          }
          const linked = await AuthIdentityRepository.link('GOOGLE', identity.subject, existing.id, executor);
          if (linked.user_id !== existing.id || linked.provider_subject !== identity.subject) throw new AppError('Google identity is already linked to another account', 409, 'OAUTH_ACCOUNT_LINK_CONFLICT');
          await UserRepository.linkGoogle(existing.id, identity.subject, executor);
          return existing;
        }

        const passwordHash = await hashPassword(crypto.randomBytes(48).toString('base64url'));
        const created = await UserRepository.create({ id: crypto.randomUUID(), email: identity.email, passwordHash, name: identity.name, baseCurrency: 'INR' }, executor);
        const verified = await UserRepository.markEmailVerified(created.id, executor);
        const linked = await AuthIdentityRepository.link('GOOGLE', identity.subject, created.id, executor);
        if (linked.user_id !== created.id || linked.provider_subject !== identity.subject) throw new AppError('Google identity is already linked to another account', 409, 'OAUTH_ACCOUNT_LINK_CONFLICT');
        await UserRepository.linkGoogle(created.id, identity.subject, executor);
        await UserPreferencesRepository.createDefault(created.id, created.base_currency, executor);
        return verified || created;
      });
      return { token: signToken({ userId: user.id, email: user.email, authVersion: user.auth_version }), frontendUrl: config.frontendUrl };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') throw new AppError('Google identity is already linked to another account', 409, 'OAUTH_ACCOUNT_LINK_CONFLICT');
      throw error;
    }
  }
}

function validateApplicationUrl(value: string, label: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError(`${label} is invalid`, 503, 'OAUTH_NOT_CONFIGURED'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new AppError(`${label} must use HTTPS outside local development`, 503, 'OAUTH_NOT_CONFIGURED');
  if (url.username || url.password) throw new AppError(`${label} is invalid`, 503, 'OAUTH_NOT_CONFIGURED');
  return url;
}
