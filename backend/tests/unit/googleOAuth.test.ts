import crypto from 'crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runMigrations } from '../../src/database/migrate';
import { GoogleOAuthService, setGoogleIdentityVerifierForTests } from '../../src/services/googleOAuth.service';
import { verifyGoogleIdToken } from '../../src/services/googleIdentity.service';
import { AuthService } from '../../src/services/auth.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { db } from '../../src/database/db';

describe('Google OAuth account integration', () => {
  const original = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    frontendUrl: process.env.FRONTEND_URL,
  };
  let identity = { subject: 'subject-default', email: 'default@example.com', name: 'Default User' };

  beforeAll(async () => {
    await runMigrations();
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'server-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/v1/auth/google/callback';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    setGoogleIdentityVerifierForTests(async () => identity);
  });

  beforeEach(() => {
    identity = { subject: `subject-${crypto.randomUUID()}`, email: `google-${crypto.randomUUID()}@example.com`, name: 'Google User' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id_token: 'signed-google-id-token' }), { status: 200, headers: { 'content-type': 'application/json' } })));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    setGoogleIdentityVerifierForTests(verifyGoogleIdToken);
    restore('GOOGLE_CLIENT_ID', original.clientId);
    restore('GOOGLE_CLIENT_SECRET', original.clientSecret);
    restore('GOOGLE_REDIRECT_URI', original.redirectUri);
    restore('FRONTEND_URL', original.frontendUrl);
  });

  it('creates one verified user and normalized identity for a new Google account', async () => {
    const result = await complete();
    expect(result.token).toBeTruthy();
    const user = await UserRepository.findByEmail(identity.email);
    expect(user?.email_verified_at).toBeTruthy();
    const rows = await db.query('SELECT * FROM auth_identities WHERE user_id = $1;', [user!.id]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ provider: 'GOOGLE', provider_subject: identity.subject });
  });

  it('signs the same Google identity into the existing account without duplication', async () => {
    await complete();
    const first = await UserRepository.findByEmail(identity.email);
    const secondResult = await complete();
    expect(secondResult.token).toBeTruthy();
    const users = await db.query('SELECT id FROM users WHERE email = $1;', [identity.email]);
    expect(users.rows).toEqual([{ id: first!.id }]);
  });

  it('links a Google identity to an existing verified email/password account', async () => {
    const email = `password-${crypto.randomUUID()}@example.com`;
    const registered = await AuthService.register({ email, password: 'SecurePassword123!', name: 'Password User' });
    await UserRepository.markEmailVerified(registered.user.id);
    identity = { subject: `subject-${crypto.randomUUID()}`, email, name: 'Google Name' };
    await complete();
    const users = await db.query('SELECT id FROM users WHERE email = $1;', [email]);
    const links = await db.query('SELECT provider_subject FROM auth_identities WHERE user_id = $1;', [registered.user.id]);
    expect(users.rows).toHaveLength(1);
    expect(links.rows).toEqual([{ provider_subject: identity.subject }]);
  });

  it('does not auto-link an unverified email/password account', async () => {
    const email = `unverified-${crypto.randomUUID()}@example.com`;
    await AuthService.register({ email, password: 'SecurePassword123!' });
    identity = { subject: `subject-${crypto.randomUUID()}`, email, name: 'Unverified' };
    await expect(complete()).rejects.toMatchObject({ code: 'OAUTH_ACCOUNT_LINK_CONFLICT', statusCode: 409 });
  });

  it('rejects linking a second Google subject to the same user', async () => {
    const email = `conflict-${crypto.randomUUID()}@example.com`;
    const registered = await AuthService.register({ email, password: 'SecurePassword123!' });
    await UserRepository.markEmailVerified(registered.user.id);
    identity = { subject: `subject-first-${crypto.randomUUID()}`, email, name: 'First' };
    await complete();
    identity = { subject: `subject-second-${crypto.randomUUID()}`, email, name: 'Second' };
    await expect(complete()).rejects.toMatchObject({ code: 'OAUTH_ACCOUNT_LINK_CONFLICT' });
  });

  it('consumes state when the user cancels and rejects replay', async () => {
    const start = await GoogleOAuthService.authorizationUrl();
    const state = new URL(start.authorizationUrl).searchParams.get('state')!;
    await expect(GoogleOAuthService.cancel(state)).rejects.toMatchObject({ code: 'OAUTH_CANCELLED' });
    await expect(GoogleOAuthService.cancel(state)).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
  });

  it('returns a safe exchange error for an invalid authorization code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })));
    await expect(complete()).rejects.toMatchObject({ code: 'OAUTH_EXCHANGE_FAILED' });
  });

  it('returns a safe provider error on a token endpoint network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('provider details must not leak'); }));
    await expect(complete()).rejects.toMatchObject({ code: 'OAUTH_PROVIDER_UNAVAILABLE', message: 'Google authorization is temporarily unavailable' });
  });

  async function complete() {
    const start = await GoogleOAuthService.authorizationUrl();
    const state = new URL(start.authorizationUrl).searchParams.get('state')!;
    return GoogleOAuthService.callback('authorization-code', state);
  }
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
