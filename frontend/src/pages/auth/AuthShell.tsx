import { useContext, type ReactNode } from 'react';
import { ArrowUpRight, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo';
import { ThemeContext } from '../../context/ThemeContext';

const explore = [
  { to: '/markets', label: 'Markets' },
  { to: '/screener', label: 'Screener' },
  { to: '/markets/compare', label: 'Compare' },
];
const coverage = ['NSE', 'BSE', 'NYSE', 'NASDAQ'];
const capabilities = ['CAGR', 'XIRR', 'Sharpe ratio', 'Max drawdown', 'Volatility', 'FX impact', 'Dividend attribution', 'Multi-currency', 'Live · Delayed · Historical'];

export default function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  const theme = useContext(ThemeContext);

  return (
    <main className="auth-landing">
      <header className="auth-topbar">
        <Link to="/markets" className="auth-brand" aria-label="FinSight markets"><BrandLogo /></Link>
        <div className="auth-top-actions">
          <Link to="/markets" className="auth-pill">Explore markets <ArrowUpRight size={16} aria-hidden /></Link>
          <button type="button" className="round-button" onClick={theme?.toggleTheme} aria-label={theme?.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme?.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <section className="auth-hero" aria-label="FinSight">
        <h1 className="auth-headline">
          <span className="auth-line"><b>Your whole</b> <em>financial</em></span>
          <span className="auth-line"><b>life,</b> <em>in one view</em><i aria-hidden>.</i></span>
        </h1>
        <svg className="auth-signature" viewBox="0 0 240 110" aria-hidden="true">
          <path pathLength={1} d="M6 92 C 38 30, 70 4, 84 18 C 98 32, 52 92, 40 80 C 28 68, 96 30, 122 44 C 140 54, 112 86, 128 82 C 146 78, 160 34, 176 40 C 190 46, 168 80, 186 74 C 204 68, 214 30, 236 10" />
        </svg>
      </section>

      <div className="auth-stage">
        <nav className="auth-column" aria-label="Explore without an account">
          <p>Explore</p>
          {explore.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}
          <Link to="/register" className="accent">Create account</Link>
        </nav>

        <section className="auth-card">
          <p className="auth-kicker">Private financial workspace</p>
          <h2>{title}</h2>
          <div className="auth-form-area">{children}</div>
          {footer && <div className="auth-footer">{footer}</div>}
          <p className="auth-legal">Educational analytics only. FinSight does not execute trades or provide investment advice.</p>
        </section>

        <div className="auth-column">
          <p>Coverage</p>
          {coverage.map(exchange => <span key={exchange}>{exchange}</span>)}
        </div>
      </div>

      <div className="auth-marquee" aria-label="Analytics FinSight calculates">
        <div className="auth-marquee-track">
          {[0, 1].map(copy => (
            <span key={copy} aria-hidden={copy === 1}>
              {capabilities.map(item => <span key={item} className="auth-marquee-item">{item}<i aria-hidden>✦</i></span>)}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}

export const inputClass = 'auth-input mt-2 w-full border bg-transparent px-4 py-3 focus-visible:outline-none';
export const buttonClass = 'btn-primary auth-submit w-full px-4 py-3 disabled:opacity-50';
