# FinSight --- Technology Stack & Architecture Flowcharts

> **Source-of-truth rule:** The latest locked/final reconciliation
> sections in this document supersede earlier draft wording.

## 1. Complete Technology Stack

``` text
┌──────────────────────────────────────────────────────────┐
│                     FINSiGHT                              │
├──────────────────────────────────────────────────────────┤
│ Frontend                                                 │
│ React + Responsive UI + Charts                           │
├──────────────────────────────────────────────────────────┤
│ Backend                                                  │
│ Node.js + Express + REST APIs + JWT                      │
├──────────────────────────────────────────────────────────┤
│ Analytics                                                │
│ Python + pandas + NumPy                                  │
├──────────────────────────────────────────────────────────┤
│ Database                                                 │
│ PostgreSQL                                               │
├──────────────────────────────────────────────────────────┤
│ External Services                                        │
│ Market Data APIs + Exchange Rate Data + News (future)   │
├──────────────────────────────────────────────────────────┤
│ DevOps                                                   │
│ Git + GitHub + GitHub Actions + Cloud Deployment        │
└──────────────────────────────────────────────────────────┘
```

## 2. Frontend Stack

``` text
React
  │
  ├── Pages
  │    ├── Dashboard
  │    ├── Stocks
  │    ├── Portfolio
  │    ├── Simulator
  │    └── Finance
  │
  ├── Components
  │    ├── Charts
  │    ├── Tables
  │    ├── Cards
  │    └── Forms
  │
  ├── API Client
  │
  └── Authentication State
          │
          ▼
       REST API
```

## 3. Backend Stack

``` text
Client
  │
  ▼
Node.js
  │
  ▼
Express.js
  │
  ├── Authentication Middleware
  │
  ├── Validation Middleware
  │
  ├── Route Layer
  │
  ├── Controller Layer
  │
  ├── Service Layer
  │
  └── Data Access Layer
        │
        ├───────────────┐
        ▼               ▼
   PostgreSQL       Python Analytics
```

## 4. Analytics Architecture

``` text
Node / Express
      │
      │ Analytics Request
      ▼
Python Analytics Service
      │
      ├── pandas
      │     ├── Cleaning
      │     ├── Aggregation
      │     └── Time Series
      │
      └── NumPy
            ├── Numerical calculations
            ├── Returns
            ├── Volatility
            └── Risk metrics
      │
      ▼
Structured Analytics Result
      │
      ▼
Node / Express
      │
      ▼
React
```

## 5. External Market Data

``` text
                 ┌────────────────────┐
                 │ Market Data Provider│
                 └──────────┬─────────┘
                            │
                            ▼
                    Data Fetcher
                            │
                            ▼
                    Validation Layer
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
             PostgreSQL         Cache (future)
                  │
                  ▼
            Analytics Engine
```

## 6. Deployment / CI-CD

``` text
Developer
   │
   ▼
Git Commit
   │
   ▼
GitHub Repository
   │
   ▼
GitHub Actions
   │
   ├── Lint
   ├── Test
   ├── Build
   └── Deployment checks
   │
   ▼
Deployment
   ├── Frontend → Vercel (target)
   └── Backend  → Cloud platform (TBD)
```

## 7. Security Flow

``` text
User
 ↓
Login
 ↓
Credentials
 ↓
Password Hash Verification
 ↓
JWT Issued
 ↓
Frontend stores auth state
 ↓
Protected API Request
 ↓
JWT Middleware
 ↓
Token Valid?
 ├── No → 401 Unauthorized
 └── Yes
       ↓
   Authorized Route
       ↓
   User-specific data
```

## 8. Proposed Backend Layering

``` text
/routes
    ↓
/controllers
    ↓
/services
    ↓
/repositories
    ↓
PostgreSQL

Analytics requests:
 /routes
    ↓
/controllers
    ↓
/services
    ↓
Python Analytics
```

This separation is intended to keep business logic out of route handlers
and make the system easier to test and maintain.

------------------------------------------------------------------------

# Final Architecture Constraints

## Free/simple deployment

-   Vercel Hobby is the frontend target.
-   Backend/database hosting will be chosen from suitable free tiers at
    deployment time.
-   No paid service dependency for the core project.
-   No Docker, Redis, Kubernetes, microservices, or complex queues
    initially.

## Frontend

-   Vite + React
-   Tailwind CSS
-   Lucide React
-   ECharts
-   Responsive desktop/mobile UI
-   Simple Context/state initially
-   Simple fetch initially
-   React Hook Form where useful

## Backend

-   Node.js + Express
-   REST APIs using `/api/v1`
-   JWT authentication
-   Simple validation
-   ORM
-   Consistent JSON responses
-   Structured logging
-   Environment-variable secrets

## Analytics

``` text
Express
  ↓
Python script
  ↓
pandas + NumPy
  ↓
Structured result
  ↓
Express
  ↓
React
```

## Market-data layer

``` text
React
  ↓
Express /api/v1
  ↓
MarketDataService
  ├── primary provider
  ├── fallback provider where legally/technically suitable
  └── PostgreSQL historical/cache layer
  ↓
validated market data
  ↓
Python analytics where required
```

Provider selection must verify coverage, freshness, rate limits, and
public-display licensing. Never claim real-time if the provider only
supplies delayed/EOD data.

## Visual architecture

-   Dark + light themes.
-   Charcoal/black dark foundation.
-   Champagne/gold accent.
-   Soft radial gradients with subtle cursor-following ambient lighting.
-   Restrained mobile ambient animation.
-   Mostly solid cards with selective transparency.
-   Moderate corners and minimal glow.
-   Strong typography and information hierarchy.
-   Explicitly avoid generic AI-generated visual language.

# Final Reconciliation --- September 9, 2026

The locked architecture below supersedes any earlier draft wording where
the two conflict.

## Shared Backtesting Architecture

``` text
Analyze → Backtesting ───────┐
                             ├──→ Shared Backtest Service/Engine
FinSight Lab → Backtest Strategy ─┘
                                      ↓
                               Python Backtesting
                                      ↓
                               Structured Results
```

There is one backtesting implementation. The two pages are different
entry points and presentation contexts. `Analyze → Backtesting` and
`FinSight Lab → Backtest Strategy` both use the dedicated
`backtests`/`backtest_results` persistence model; `Backtest Strategy` is
not represented as a `scenarios.scenario_type`.

FinSight Lab saved scenario types are limited to `SINGLE_INVESTMENT`,
`RECURRING_INVESTMENT`, and `PORTFOLIO_SCENARIO`. `Compare Scenarios` uses
`scenario_comparisons` to relate existing saved scenarios rather than
creating a special comparison scenario row.

## Portfolio and Scenario Architecture

``` text
Portfolio
  ↓
portfolio_transactions (authoritative ledger)
  ↓
derived portfolio holdings/state
  ↓
portfolio analytics

FinSight Lab Scenario
  ↓
scenario assets / allocations / contributions
  ↓
market + corporate actions + FX + fees + tax
  ↓
Python analytics
  ↓
saved scenario results
```

Personal-finance `finance_transactions` and investment
`portfolio_transactions` are separate domains.

## User Preferences

Persist dashboard and account presentation preferences in a dedicated
`user_preferences` model. JSONB may be used for flexible dashboard
layout data inside that table; do not overload the `users`
authentication row with unrelated UI state.

## Stock Screener

Expose an initial `ScreenerService`/API backed by normalized
market/security/fundamental data. Initial filters are exchange, country,
sector, market cap, price, P/E, EPS, dividend yield, revenue, profit,
debt, 52-week range, volume, RSI, and moving-average relationship.
Advanced custom formulas, saved screeners, and alerts are later
extensions.

## Data/Financial Correctness Constraint

Provider adapters, FX service, portfolio ledger, scenario engine, tax
rules, and analytics calculations must be deterministic, testable, and
replaceable. No model/LLM is the source of financial calculations.

## Database Integrity Constraints

The final PostgreSQL schema must use `TIMESTAMPTZ`/UTC consistently for
system timestamps across legacy and reconciled tables. The nullable
`scenario_contributions.scenario_asset_id` path must use a partial unique
index for `(scenario_id, contribution_date)` when the asset is unspecified;
a normal UNIQUE constraint alone is insufficient in PostgreSQL because
NULL values are distinct.

# Final Architecture Decisions --- Locked

## Frontend

``` text
React + Vite + TypeScript
        │
        ├── Tailwind CSS
        ├── Lucide React
        ├── Apache ECharts
        ├── TanStack Query (server state)
        ├── Context (auth/theme/light global state)
        └── Local React state (UI/forms)
```

## Backend

``` text
React
  ↓
REST / JSON
  ↓
Express /api/v1
  ↓
Routes
  ↓
Controllers
  ↓
Services
  ↓
Repositories
  ↓
PostgreSQL
```

The backend is a modular monolith, not a microservice system.

## Market Data & FX

``` text
React
  ↓
Express /api/v1
  ↓
MarketDataService / FX Service
  ├── primary provider
  ├── fallback provider
  └── PostgreSQL historical/cache
  ↓
validated + normalized data
  ↓
React / Python analytics as required
```

All providers are adapters behind FinSight services. The application
records source, timestamp, and freshness where relevant. Supported
freshness labels are Live, Delayed, End-of-day, and Historical.

Dynamic FX is mandatory for cross-currency portfolios/simulations.
Historical transactions use date-appropriate historical FX rates;
current valuations use the latest available rate.

## Python Analytics

``` text
Express
  ↓
Analytics Service
  ↓
Python scripts
  ↓
pandas + NumPy
  ↓
Structured JSON
  ↓
Express
  ↓
React
```

Python modules cover simulations, portfolio analytics, backtesting,
risk, FX/finance, and common numerical utilities.

## Operations

-   PostgreSQL/application caching; no Redis initially.
-   Lightweight scheduled jobs for
    market/FX/fundamental/dividend/corporate-action refreshes where
    useful.
-   Failure strategy: retry → fallback → cache → degraded response.
-   Swagger/OpenAPI.
-   Structured logging and health endpoints.
-   GitHub Actions for lint/test/build/security/deployment checks.

## Deployment

``` text
GitHub
 ├──→ Vercel Hobby → React frontend
 └──→ Free current backend host → Express + Python
                      │
                      └──→ Free current PostgreSQL host
```

Exact free backend/database vendors are selected and verified at
deployment time; the architecture is provider-agnostic.

## Project Structure

``` text
finsight/
├── frontend/
├── backend/
├── analytics/
├── database/
├── docs/
├── .github/workflows/
├── .env.example
└── README.md
```

## Design Constraint

Simple + free + legally usable + easy to deploy. Avoid Docker,
Kubernetes, microservices, Redis, complex queues, paid APIs, and
unnecessary infrastructure unless a later documented decision justifies
them.
