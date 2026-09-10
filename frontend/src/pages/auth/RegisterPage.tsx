import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AuthShell, { buttonClass, inputClass } from './AuthShell';

export default function RegisterPage() {
  const { register } = useAuth();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(undefined);
    try {
      await register({
        email: String(form.get('email')),
        password: String(form.get('password')),
        name: String(form.get('name')),
        baseCurrency: String(form.get('baseCurrency')),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create account" footer={<>Already registered? <Link className="text-gold-700 hover:underline" to="/login">Sign in</Link></>}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm">Name<input className={inputClass} name="name" autoComplete="name" required /></label>
        <label className="block text-sm">Email<input className={inputClass} name="email" type="email" autoComplete="email" required /></label>
        <label className="block text-sm">Password<input className={inputClass} name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
        <label className="block text-sm">Base currency<select className={inputClass} name="baseCurrency" defaultValue="INR"><option value="INR">INR</option><option value="USD">USD</option></select></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className={buttonClass} disabled={submitting}>{submitting ? 'Creating…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
