import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { endpoints } from '../../api/endpoints';
import AuthShell, { buttonClass, inputClass } from './AuthShell';

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true); setError(undefined); setMessage(undefined);
    try {
      const data = new FormData(event.currentTarget);
      await api.post(endpoints.auth.requestPasswordReset, { email: String(data.get('email')) });
      setMessage('If that account exists, a reset link has been sent.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to request a reset'); }
    finally { setPending(false); }
  };
  return <AuthShell title="Reset password" footer={<Link className="text-gold-700" to="/login">Return to sign in</Link>}><form onSubmit={submit} className="space-y-4"><label className="block text-sm">Email<input name="email" type="email" required autoComplete="email" className={inputClass} /></label><button disabled={pending} className={buttonClass}>{pending ? 'Sending…' : 'Send reset link'}</button>{message && <p role="status" className="text-sm text-green-700">{message}</p>}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}</form></AuthShell>;
}
