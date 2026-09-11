import { useState } from 'react';
import api from '../../api/client';
import { endpoints } from '../../api/endpoints';
import { useAuth } from '../../hooks/useAuth';

export default function GoogleSignInButton() {
  const { completeOAuth } = useAuth();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const start = async () => {
    const popup = window.open('', 'finsight-google-oauth', 'width=520,height=680');
    if (!popup) { setError('Allow pop-ups to continue with Google.'); return; }
    setPending(true); setError(undefined);
    try {
      const response = await api.get<{ authorizationUrl: string }>(endpoints.auth.google);
      popup.location.href = response.data.authorizationUrl;
      const apiOrigin = new URL((import.meta.env.VITE_API_URL as string | undefined) ?? window.location.origin, window.location.origin).origin;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Google sign-in timed out')); }, 120_000);
        const listener = (event: MessageEvent) => {
          if (event.origin !== apiOrigin || event.source !== popup || event.data?.type !== 'finsight-google-oauth' || typeof event.data.token !== 'string') return;
          cleanup();
          completeOAuth(event.data.token).then(resolve).catch(reject);
        };
        const cleanup = () => { window.clearTimeout(timeout); window.removeEventListener('message', listener); popup.close(); };
        window.addEventListener('message', listener);
      });
    } catch (caught) {
      popup.close();
      setError(caught instanceof Error ? caught.message : 'Google sign-in failed');
    } finally { setPending(false); }
  };

  return <div className="mt-4"><button type="button" onClick={() => { void start(); }} disabled={pending} className="w-full rounded border px-4 py-2">{pending ? 'Waiting for Google…' : 'Continue with Google'}</button>{error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}</div>;
}
