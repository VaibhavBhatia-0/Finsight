# FinSight hardening and authentication notes

## Local Google OAuth configuration

FinSight uses Google OpenID Connect's server-side authorization-code flow and then issues the same FinSight JWT used by email/password authentication. In Google Cloud, configure a Web application OAuth client with this exact local redirect URI:

`http://localhost:5000/api/v1/auth/google/callback`

Copy `.env.example` to `.env` and set:

- `GOOGLE_CLIENT_ID`: the Web client ID used by the backend verifier.
- `GOOGLE_CLIENT_SECRET`: the Web client secret; server-side only.
- `GOOGLE_REDIRECT_URI`: the exact registered callback URI.
- `VITE_GOOGLE_OAUTH_CLIENT_ID`: the same public client ID, used to enable the frontend control.
- `FRONTEND_URL`: the permitted popup message target, normally `http://localhost:5173`.

Never put `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, or email webhook credentials in a `VITE_` variable. Production callback and frontend URLs must use HTTPS.

Account linking is intentionally conservative: an existing password account is linked only when its email has already been verified and the Google ID token contains the same verified email. An unverified account or a second Google subject produces `OAUTH_ACCOUNT_LINK_CONFLICT` instead of creating or merging users.

## Intentional market limitations

- Price, change, volume, and sourced-fundamental sorting is limited to the currently loaded page. FinSight does not fan out live requests across the full universe just to sort it.
- The synchronized listing universe uses official NSE and Nasdaq Trader directories. BSE quote resolution is supported, but complete BSE directory coverage is not claimed because no clean first-party directory is integrated.
- Missing Yahoo Chart fundamentals remain `N/A`; they are never filled with synthetic or unrelated values.
- The Market Overview index change-percentage issue is intentionally parked for a later pass.

## Dependency audit decisions

- ECharts `<6.1.0`: moderate XSS advisory. The only available audit fix is ECharts 6, a major migration. FinSight does not render user-authored formatter HTML; the existing major is retained pending a focused chart migration.
- React Router 6: moderate open-redirect and SSR-hydration advisories. The audit fix is React Router 7, a major migration. FinSight is a client-rendered SPA, does not use Router SSR hydration, and only navigates to application-authored routes; version 6 is retained pending a focused router migration.
- Vite/Vitest findings are development-tool findings. The app binds Vite to localhost and CI uses non-interactive `vitest run`; the available fixes require major upgrades. They are deferred to a dedicated tooling migration rather than mixed into the product hardening pass.
