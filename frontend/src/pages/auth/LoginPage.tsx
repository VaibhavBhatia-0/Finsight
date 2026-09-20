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
    <AuthShell title="Welcome back" footer={<>New to FinSight? <Link to="/register">Create an account</Link></>}>
      <GoogleSignInButton />
      <div className="auth-divider"><span>or continue with email</span></div>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm">Email address<input className={inputClass} name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
        <label className="block text-sm">Password<input className={inputClass} name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
        <div className="auth-help"><Link to="/forgot-password">Forgot password?</Link><Link to="/verify-email">Verify email</Link></div>
        {error && <p role="alert" className="auth-error">{error}</p>}
        <button className={buttonClass} disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in to FinSight'}</button>
      </form>
    </AuthShell>
  );
}
