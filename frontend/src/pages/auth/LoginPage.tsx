import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AuthShell, { buttonClass, inputClass } from './AuthShell';
import GoogleSignInButton from './GoogleSignInButton';

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(undefined);
    try {
      await login(String(form.get('email')), String(form.get('password')));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Sign in" footer={<>New to FinSight? <Link className="text-gold-700 hover:underline" to="/register">Create an account</Link></>}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm">Email<input className={inputClass} name="email" type="email" autoComplete="email" required /></label>
        <label className="block text-sm">Password<input className={inputClass} name="password" type="password" autoComplete="current-password" required /></label>
        <div className="flex justify-between text-sm"><Link className="text-gold-700" to="/forgot-password">Forgot password?</Link><Link className="text-gold-700" to="/verify-email">Verify email</Link></div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className={buttonClass} disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <GoogleSignInButton />
    </AuthShell>
  );
}
