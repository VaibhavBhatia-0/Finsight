import { useState } from 'react';
import api, { ApiError } from '../../api/client';
import { endpoints } from '../../api/endpoints';
import { useAuth } from '../../hooks/useAuth';

interface OAuthStartResponse {
  authorizationUrl: string;
  callbackOrigin: string;
}

interface OAuthMessage {
  type?: string;
  token?: string;
  error?: { code?: string; message?: string };
}

export default function GoogleSignInButton() {
  const { completeOAuth } = useAuth();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const configured = Boolean((import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined)?.trim());

  const start = async () => {
    if (!configured) {
      setError('Google sign-in is not configured for this environment.');
      return;
    }
    const popup = window.open('', 'finsight-google-oauth', 'popup=yes,width=520,height=680');
    if (!popup) { setError('Allow pop-ups to continue with Google.'); return; }
    setPending(true);
    setError(undefined);
    try {
      const response = await api.get<OAuthStartResponse>(endpoints.auth.google);
      popup.location.replace(response.data.authorizationUrl);
      const token = await waitForOAuth(popup, response.data.callbackOrigin);
      await completeOAuth(token);
    } catch (caught) {
      if (!popup.closed) popup.close();
      setError(oauthErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-provider">
      <button type="button" onClick={() => { void start(); }} disabled={pending} aria-busy={pending} className="auth-provider-button">
        <span className="google-g" aria-hidden="true">G</span>
        {pending ? 'Waiting for Google…' : 'Continue with Google'}
      </button>
      {error && <p role="alert" className="auth-error">{error}</p>}
    </div>
  );
}

function waitForOAuth(popup: Window, callbackOrigin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.clearInterval(closedPoll);
      window.removeEventListener('message', listener);
      if (!popup.closed) popup.close();
      callback();
    };
    const listener = (event: MessageEvent<OAuthMessage>) => {
      if (event.origin !== callbackOrigin || event.source !== popup || event.data?.type !== 'finsight-google-oauth') return;
      if (event.data.error) {
        finish(() => reject(new Error(event.data.error?.message || 'Google sign-in failed')));
        return;
      }
      if (typeof event.data.token === 'string' && event.data.token.length > 20) {
        finish(() => resolve(event.data.token!));
      }
    };
    const timeout = window.setTimeout(() => finish(() => reject(new Error('Google sign-in timed out. Please try again.'))), 120_000);
    const closedPoll = window.setInterval(() => {
      if (popup.closed) finish(() => reject(new Error('Google sign-in was cancelled.')));
    }, 400);
    window.addEventListener('message', listener);
  });
}

function oauthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'OAUTH_NOT_CONFIGURED') return 'Google sign-in is not configured for this environment.';
    if (error.code === 'OAUTH_ACCOUNT_LINK_CONFLICT') return 'This email needs account verification before Google can be linked.';
  }
  return error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
}
