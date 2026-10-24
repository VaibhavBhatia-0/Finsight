# FinSight on Render (Docker) + Supabase

The Docker service contains the compiled Node backend and Python analytics runtime. The Vite frontend remains a separate static deployment. Never copy `.env`, PGlite files, development users, sessions, or test data into production.

## Render web service

- Service type: **Web Service**
- Runtime: **Docker**
- Repository root/build context: `.`
- Dockerfile: `./Dockerfile`
- Docker command: leave blank; Render uses the Dockerfile `CMD`
- Health check path: `/api/v1/health`
- Port: do not hardcode it; Render supplies `PORT`
- Persistent disk: none; production state belongs in Supabase PostgreSQL

`render.yaml` contains the non-secret defaults. Enter every `sync: false` value in the Render dashboard.

Required backend variables:

- `NODE_ENV=production`
- `DB_DRIVER=pg`
- `DATABASE_URL` — the verified Supabase PostgreSQL connection URL; enable required SSL in the URL
- `JWT_SECRET` — unique high-entropy value of at least 48 characters
- `CORS_ORIGIN` — exact HTTPS frontend origin; comma-separate additional trusted origins
- `FRONTEND_URL` — exact HTTPS frontend origin
- `TRUST_PROXY_HOPS=1` for the standard Render proxy path
- `RUN_SEEDS_ON_STARTUP=false`
- `PYTHON_PATH=/opt/venv/bin/python` — must be exactly this path (or left unset, since the Dockerfile sets it). Setting it to `python` breaks every analytics feature: the image has no `python` on its path, so Lab, What-if, portfolio intelligence and backtesting fail with HTTP 503 and the log shows `analytics_spawn_error … spawn python ENOENT`.
- `ANALYTICS_DIR=/app/analytics`
- `MARKET_DATA_PROVIDER=yahoo`
- `FX_PROVIDER=yahoo`

Render supplies `PORT`. Google OAuth remains optional. When enabled, add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the exact HTTPS `GOOGLE_REDIRECT_URI`; expose only the public client ID as `VITE_GOOGLE_OAUTH_CLIENT_ID` to the frontend. Email delivery similarly requires `AUTH_EMAIL_WEBHOOK_URL` and `AUTH_EMAIL_WEBHOOK_TOKEN` only when enabled.

## Database initialization

The backend runs all pending migrations transactionally before opening its HTTP port. Migrations are recorded in `schema_migrations`, so a normal restart is idempotent. Production startup never runs seeds automatically.

For the first deployment, verify the Supabase project and `DATABASE_URL` before running any command, then use a single instance and this sequence:

1. Build the image: `docker build -t finsight-api .`
2. Run migrations explicitly: `docker run --rm --env-file <production-env-file> finsight-api npm run migrate:prod --workspace=backend`
3. Load only the repository's reference data when the production database is empty: `docker run --rm --env-file <production-env-file> finsight-api npm run seed:prod --workspace=backend`
4. Deploy the same image. Startup rechecks migrations and then runs `npm run start --workspace=backend`.
5. Verify `GET https://<backend-host>/api/v1/health`, then test authentication, market search, one analytics calculation, and an authenticated report export. The health check does not exercise Python, so test analytics separately, for example `POST /api/v1/scenarios/simulate` with a symbol, dates, `initialAmount` and `baseCurrency`.

On Render, use an equivalent pre-deploy command if the selected service plan supports it, or run the compiled migration and reference-seed commands from a one-off shell before the first public start. Do not run either command until the target database identity has been checked. Never seed development users or local PGlite data.

## Frontend

Build the frontend with `npm run build --workspace=frontend`, publish `frontend/dist`, and set `VITE_API_URL` to the deployed Render backend origin. `frontend/vercel.json` supplies the SPA rewrite when Vercel is used.

## Security catalogue import

Migration 015 adds only 8 baseline securities. The full NSE, NASDAQ and NYSE
catalogue (about 9,100 listings from the official NSE and Nasdaq Trader
directories) is loaded by a guarded importer that never deletes securities
or creates price rows:

1. Back up the Supabase database.
2. From a trusted machine, set `DB_DRIVER=pg` and `DATABASE_URL` (the same
   value Render uses) in the current shell only, and confirm the host is the
   intended Supabase project before continuing.
3. Dry run, which downloads and validates the directories without touching
   any database: `npm run universe:sync`. Note the printed `sha256`.
4. Apply with that fingerprint:
   `npm run universe:sync --workspace=backend -- --apply --expect-sha256=<sha256>`.
   The fingerprint covers the validated securities, not the raw files, so a
   refreshed directory timestamp alone does not invalidate it.
5. Check `GET /api/v1/markets/securities/stats`.

If the apply reports `"inserted":0` with database counts that do not match
production, it ran against a different database (for example local PGlite);
recheck the shell's `DB_DRIVER` and `DATABASE_URL`.
