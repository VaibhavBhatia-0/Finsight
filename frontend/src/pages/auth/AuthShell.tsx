import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export default function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6 shadow-lg">
        <Link to="/markets" className="text-sm text-gold-700 hover:underline">FinSight</Link>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-sm text-gray-600 dark:text-gray-300">{footer}</div>}
      </section>
    </main>
  );
}

export const inputClass = 'mt-1 w-full rounded-md border border-border-light bg-transparent px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500';
export const buttonClass = 'w-full rounded-md bg-gold-600 px-4 py-2 font-medium text-white hover:bg-gold-700 disabled:opacity-50';
