import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { endpoints } from '../../api/endpoints';
import AuthShell, { buttonClass, inputClass } from './AuthShell';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!token) return;
    api.post(endpoints.auth.confirmVerification, { token }).then(() => setMessage('Email verified.')).catch(reason => setError(reason instanceof Error ? reason.message : 'Verification failed'));
  }, [token]);
  const request = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(undefined);
    const data = new FormData(event.currentTarget);
    try { await api.post(endpoints.auth.requestVerification, { email: String(data.get('email')) }); setMessage('If the account needs verification, a link has been sent.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to send verification'); }
  };
  return <AuthShell title="Verify email" footer={<Link className="text-gold-700" to="/login">Return to sign in</Link>}>{token ? <p role={error ? 'alert' : 'status'}>{error ?? message ?? 'Verifying…'}</p> : <form onSubmit={request} className="space-y-4"><label className="block text-sm">Email<input name="email" type="email" required className={inputClass} /></label><button className={buttonClass}>Send verification link</button>{message && <p role="status" className="text-sm text-green-700">{message}</p>}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}</form>}</AuthShell>;
}
