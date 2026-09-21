import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGoogleKeyCacheForTests, verifyGoogleIdToken } from '../../src/services/googleIdentity.service';

describe('Google ID token verification', () => {
  const clientId = 'test-client.apps.googleusercontent.com';
  const nonce = 'nonce-for-this-browser-flow';
  const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as crypto.JsonWebKey;

  beforeEach(() => {
    clearGoogleKeyCacheForTests();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('accepts a correctly signed Google identity with issuer, audience, expiry, verified email, and nonce', async () => {
    await expect(verifyGoogleIdToken(token(), clientId, nonceHash)).resolves.toEqual({ subject: 'google-subject-1', email: 'person@example.com', name: 'Person' });
  });

  it('rejects a token for the wrong audience', async () => {
    await expect(verifyGoogleIdToken(token({ aud: 'another-client' }), clientId, nonceHash)).rejects.toMatchObject({ code: 'OAUTH_IDENTITY_INVALID' });
  });

  it('rejects an expired token', async () => {
    await expect(verifyGoogleIdToken(token({ exp: now() - 1 }), clientId, nonceHash)).rejects.toMatchObject({ code: 'OAUTH_IDENTITY_INVALID' });
  });

  it('rejects an unverified email', async () => {
    await expect(verifyGoogleIdToken(token({ email_verified: false }), clientId, nonceHash)).rejects.toMatchObject({ code: 'OAUTH_IDENTITY_INVALID' });
  });

  it('rejects a token issued for a different OAuth nonce', async () => {
    await expect(verifyGoogleIdToken(token({ nonce: 'different-flow' }), clientId, nonceHash)).rejects.toMatchObject({ code: 'OAUTH_IDENTITY_INVALID' });
  });

  it('rejects a token with a forged signature', async () => {
    const forged = `${token().split('.').slice(0, 2).join('.')}.${Buffer.from('forged').toString('base64url')}`;
    await expect(verifyGoogleIdToken(forged, clientId, nonceHash)).rejects.toMatchObject({ code: 'OAUTH_IDENTITY_INVALID' });
  });

  function token(overrides: Record<string, unknown> = {}) {
    const header = encode({ alg: 'RS256', typ: 'JWT', kid: 'test-key' });
    const payload = encode({
      iss: 'https://accounts.google.com', aud: clientId, sub: 'google-subject-1',
      email: 'Person@Example.com', email_verified: true, name: 'Person',
      iat: now() - 5, exp: now() + 3600, nonce, ...overrides,
    });
    const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    return `${header}.${payload}.${signature}`;
  }
});

function encode(value: object) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function now() { return Math.floor(Date.now() / 1000); }
