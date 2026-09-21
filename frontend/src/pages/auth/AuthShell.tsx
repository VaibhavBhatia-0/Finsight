import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo';

export default function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth-backdrop">
      <div className="auth-frame">
        <section className="auth-card">
          <div className="auth-card-inner">
            <Link to="/markets" className="auth-brand"><BrandLogo variant="wordmark" /></Link>
            <div className="auth-heading">
              <p className="auth-kicker">Private financial workspace</p>
              <h1>{title}</h1>
              <p>One secure view for your money, markets, portfolios, and research.</p>
            </div>
            <div className="auth-form-area">{children}</div>
            {footer && <div className="auth-footer">{footer}</div>}
            <p className="auth-legal">Educational analytics only. FinSight does not execute trades or provide investment advice.</p>
          </div>
        </section>

        <aside className="auth-showcase">
          <div className="auth-visual" aria-hidden="true">
            <div className="auth-core"><BrandLogo variant="mark" /><small>Financial intelligence</small></div>
            <div className="auth-float auth-float-market"><small>MARKET PULSE</small><strong>NIFTY 50</strong><span>India · US coverage</span></div>
            <div className="auth-float auth-float-portfolio"><small>PORTFOLIO</small><strong>Ledger reconciled</strong><span>FX · fees · dividends</span></div>
            <div className="auth-float auth-float-lab"><small>FINSIGHT LAB</small><strong>Scenario ready</strong><span>Single · DCA · Portfolio</span></div>
            <div className="auth-signal auth-signal-one" />
            <div className="auth-signal auth-signal-two" />
            <div className="auth-signal auth-signal-three" />
          </div>
          <div className="auth-showcase-copy">
            <p className="auth-kicker">Clarity without noise</p>
            <h2>See your whole financial life in one view.</h2>
            <p>Track cash flow, understand portfolio performance, and explore historical scenarios with transparent assumptions.</p>
            <div className="auth-dots"><i /><i /><i /></div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export const inputClass = 'auth-input mt-2 w-full border bg-transparent px-4 py-3 focus-visible:outline-none';
export const buttonClass = 'btn-primary auth-submit w-full px-4 py-3 disabled:opacity-50';
