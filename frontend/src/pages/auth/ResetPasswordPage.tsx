import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { endpoints } from '../../api/endpoints';
import AuthShell, { buttonClass, inputClass } from './AuthShell';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(undefined);
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (password !== String(data.get('confirmPassword'))) { setError('Passwords do not match'); return; }
    try { await api.post(endpoints.auth.confirmPasswordReset, { token, password }); setComplete(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to reset password'); }
  };
  return <AuthShell title="Choose a new password" footer={<Link className="text-gold-700" to="/login">Return to sign in</Link>}>{complete ? <p role="status">Password updated. You can now sign in.</p> : <form onSubmit={submit} className="space-y-4"><label className="block text-sm">New password<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} /></label><label className="block text-sm">Confirm password<input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} /></label><button disabled={!token} className={buttonClass}>Update password</button>{!token && <p role="alert" className="text-sm text-red-600">The reset token is missing.</p>}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}</form>}</AuthShell>;
}
