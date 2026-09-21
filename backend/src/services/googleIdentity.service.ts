import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';

interface GoogleJwk {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface GoogleClaims {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  exp?: number;
  iat?: number;
  nonce?: string;
}

export interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
  name?: string;
}

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cachedKeys: { expiresAt: number; keys: GoogleJwk[] } | null = null;

export async function verifyGoogleIdToken(idToken: string, clientId: string, expectedNonceHash: string): Promise<VerifiedGoogleIdentity> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw invalidIdentity();

  let header: { alg?: string; kid?: string };
  let claims: GoogleClaims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw invalidIdentity();
  }
  if (header.alg !== 'RS256' || !header.kid) throw invalidIdentity();

  const key = (await googleKeys()).find(candidate => candidate.kid === header.kid && candidate.kty === 'RSA');
  if (!key) {
    cachedKeys = null;
    const refreshed = (await googleKeys()).find(candidate => candidate.kid === header.kid && candidate.kty === 'RSA');
    if (!refreshed || !validSignature(parts, refreshed)) throw invalidIdentity();
  } else if (!validSignature(parts, key)) {
    throw invalidIdentity();
  }

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  const verifiedEmail = claims.email_verified === true || claims.email_verified === 'true';
  const nonceMatches = typeof claims.nonce === 'string' && safeEqual(hash(claims.nonce), expectedNonceHash);
  if (
    !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss || '')
    || !audiences.includes(clientId)
    || (audiences.length > 1 && claims.azp !== clientId)
    || typeof claims.exp !== 'number' || claims.exp <= now
    || typeof claims.iat !== 'number' || claims.iat > now + 300
    || !nonceMatches
    || !claims.sub || claims.sub.length > 255
    || !claims.email || !verifiedEmail
  ) throw invalidIdentity();

  return {
    subject: claims.sub,
    email: claims.email.toLowerCase().trim(),
    name: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : undefined,
  };
}

async function googleKeys(): Promise<GoogleJwk[]> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  let response: Response;
  try {
    response = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new AppError('Google identity verification is temporarily unavailable', 502, 'OAUTH_PROVIDER_UNAVAILABLE');
  }
  if (!response.ok) throw new AppError('Google identity verification is temporarily unavailable', 502, 'OAUTH_PROVIDER_UNAVAILABLE');
  const payload = await response.json() as { keys?: GoogleJwk[] };
  if (!Array.isArray(payload.keys) || !payload.keys.length) throw new AppError('Google identity verification is temporarily unavailable', 502, 'OAUTH_PROVIDER_UNAVAILABLE');
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/i)?.[1] || 300);
  cachedKeys = { keys: payload.keys, expiresAt: Date.now() + Math.max(60, maxAge) * 1000 };
  return payload.keys;
}

function validSignature(parts: string[], key: GoogleJwk): boolean {
  try {
    const publicKey = crypto.createPublicKey({ key: key as unknown as crypto.JsonWebKey, format: 'jwk' });
    return crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
  } catch {
    return false;
  }
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function invalidIdentity(): AppError {
  return new AppError('Google identity token validation failed', 401, 'OAUTH_IDENTITY_INVALID');
}

export function clearGoogleKeyCacheForTests(): void {
  cachedKeys = null;
}
