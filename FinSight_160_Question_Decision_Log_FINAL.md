# FinSight --- 160-Question Product Design Decision Log

> Consolidated record of the numbered decisions available in the
> collaborative discussion. Questions 161--167 were answered after the
> 160-question milestone and are included as an appendix.

## Global decision rule

-   Simple, free, legally usable, easy to deploy.
-   No unnecessary paid infrastructure or licensing ambiguity.
-   Internship-level engineering depth without enterprise complexity.
-   Analyze and simulate; never prescribe investment actions.

## Historical-code interpretation rule

Questions 83--160 below are retained as historical record. Their A/B/C/D
shorthand is **not self-contained and is not authoritative by itself**.
Do not infer the meaning of an option letter without the original
question/options. For implementation, use the plain-language **Final
Consolidation** and the dated decisions in this document. If a
historical shorthand entry appears to conflict with a locked
plain-language decision, the locked decision wins.

## Questions 83--85

-   83 --- News: D eventually, B initially.
-   84 --- Fundamentals: D eventually.
-   85 --- Technical analysis: D eventually.

## Questions 86--88

-   86 --- Screener: D eventually, C initially.
-   87 --- Watchlist: D eventually.
-   88 --- Portfolio transactions: C initially → D later.

## Questions 89--91

-   89 --- Portfolio creation: D.
-   90 --- Portfolio analytics: D.
-   91 --- Finance-to-investing: D.

## Questions 92--95

-   92 --- Authentication: C.
-   93 --- Onboarding: C.
-   94 --- Settings: D.
-   95 --- Landing page: D.

## Questions 96--102

-   96 --- Global search: D.
-   97 --- Markets page: D.
-   98 --- Simulator input: D progressively.
-   99 --- Simulation results: D.
-   100 --- Saved simulations: D.
-   101 --- Reports/export: D.
-   102 --- Legal/disclaimer UX: D.

## Questions 103--109

-   103 --- Dashboard personalization: C.
-   104 --- Mobile navigation: D.
-   105 --- Tables: D.
-   106 --- Loading: D.
-   107 --- Errors: D.
-   108 --- Theme: C.
-   109 --- Accessibility: D.

## Questions 110--118

-   110 --- Notifications: reduced/deferred.
-   111 --- Alerts: deferred from MVP.
-   112 --- Stock comparison: D.
-   113 --- Portfolio comparison: D.
-   114 --- Data freshness: D.
-   115 --- API architecture: D direction, implemented simply.
-   116 --- Background jobs: B.
-   117 --- Caching: B.
-   118 --- API documentation: C.

## Questions 119--125

-   119 --- Default market: A (India).
-   120 --- Currency: C (multi-currency).
-   121 --- Market hours: C.
-   122 --- Stock identifiers: C.
-   123 --- Global search architecture: C.
-   124 --- Market data storage: C.
-   125 --- Provider failure: C.

## Questions 126--132

-   126 --- API versioning: B (/api/v1).
-   127 --- Validation: B.
-   128 --- Database migrations: B.
-   129 --- Database access: B (ORM).
-   130 --- API response format: B.
-   131 --- Logging: B.
-   132 --- Secrets/configuration: B.

## Questions 133--139

-   133 --- Backend deployment: D (choose current genuinely free
    option).
-   134 --- PostgreSQL hosting: D.
-   135 --- Frontend hosting: A (Vercel).
-   136 --- Python analytics: A (Node launches scripts).
-   137 --- Authentication implementation: C (JWT + bcrypt).
-   138 --- File storage: A (not initially required).
-   139 --- CI/CD: A (GitHub Actions).

## Questions 140--146

-   140 --- React setup: B (Vite + React).
-   141 --- Styling: B (Tailwind CSS).
-   142 --- UI library: C (small selective combination).
-   143 --- Icons: A (Lucide React direction).
-   144 --- State: D (simple Context/state initially).
-   145 --- API fetching: simple fetch initially.
-   146 --- Forms: B (React Hook Form).

## Questions 147--153

-   147 --- Accent: A (champagne/gold).
-   148 --- Background intensity: B.
-   149 --- Gradient: D (radial gradients + cursor spotlight).
-   150 --- Cards: C.
-   151 --- Animation: B initially → C where useful.
-   152 --- Typography: D.
-   153 --- Overall feeling: D (financial terminal + luxury wealth
    management).

## Questions 154--160

-   154 --- Sidebar: B.
-   155 --- Active navigation: C.
-   156 --- Buttons: C.
-   157 --- Primary CTA: A (gold).
-   158 --- Financial numbers: D.
-   159 --- Hover: C.
-   160 --- Page transitions: B.

## Appendix --- Questions 161--167

-   161 --- Landing hero: editorial/luxury hero with subtle live market
    data.
-   162 --- Hero headline: "Understand Your Money. Understand the
    Market."
-   163 --- Hero CTA: Get Started + Try FinSight Lab.
-   164 --- Live market preview: interactive market snapshot.
-   165 --- Feature presentation: minimal editorial sections + real
    UI/product visuals.
-   166 --- Landing animation: subtle scroll reveals + interactive
    background.
-   167 --- Footer: links + legal/disclaimer + project/GitHub
    information.

## Current visual identity

-   Classy, elegant, luxurious, analytical.
-   Must not look AI-generated.
-   Champagne/gold accent, charcoal/black dark foundation.
-   Subtle cursor-reactive ambient gradients; restrained animation.

# Final Consolidation --- September 9, 2026

The product/architecture decision phase is complete. The following are
now locked and should be treated as the source of truth during
implementation.

-   FinSight is the complete financial management + market
    intelligence + portfolio analytics + simulation platform;
    implementation may be phased but agreed features are not removed
    merely for V1.
-   The former Investment Simulator is renamed **FinSight Lab**.
-   FinSight Lab sections: Single Investment, Recurring Investment,
    Portfolio Scenario, Compare Scenarios, Backtest Strategy.
-   India coverage: NSE, BSE, NIFTY 50, SENSEX, Indian stocks/ETFs; US
    coverage: NYSE, NASDAQ, S&P 500, NASDAQ Composite, Dow Jones, US
    stocks/ETFs.
-   Market data is provider-agnostic with primary/fallback providers,
    PostgreSQL historical/cache storage, and explicit
    Live/Delayed/EOD/Historical freshness labels.
-   Dynamic historical/current FX rates are mandatory. Cross-currency
    calculations separate asset return, FX impact, and combined
    base-currency return.
-   Personal Finance includes Expenses, Budgets, Savings, and Goals
    within the user's account.
-   Portfolios are hypothetical and transaction-driven.
-   Tax estimates are versioned/effective-dated, jurisdiction-aware,
    educational, and never inferred from IP.
-   Rule-based Insights are descriptive. Optional AI may explain
    computed metrics but cannot calculate them or provide personalized
    buy/sell advice.
-   Authentication, privacy, exports, caching, scheduled jobs,
    deployment, CI/CD, testing, accessibility, and performance
    requirements are locked as documented in the master
    requirements/technical files.
-   No Docker, Kubernetes, Redis, microservices, complex queues, or
    mandatory paid services initially.

## Implementation Rule

Locked reconciliation decisions 168--175 are part of the implementation
source of truth. If implementation reveals a genuinely new ambiguity,
record it as a new dated decision in this log and update the relevant
master `.md` specification. Do not silently change previously locked
requirements.

## Implementation Reconciliation Decisions --- September 9, 2026

### 168 --- Backtesting entry points

**Decision:** `Analyze → Backtesting` and
`FinSight Lab → Backtest Strategy` are two entry points into one shared
backtesting engine. The backend service and Python analytics
implementation must be shared; only page-level UX/presentation differs.

### 169 --- Dashboard/user preferences persistence

**Decision:** Create a dedicated one-to-one `user_preferences` model
related to `users`. It stores dashboard visibility/order, default
benchmark, selected market indices, watchlist display preferences,
theme, and default currency. Flexible dashboard configuration may use
JSONB inside this table.

### 170 --- Portfolio transaction ledger

**Decision:** Personal-finance transactions and investment portfolio
transactions are separate. Personal finance uses `finance_transactions`;
portfolios use `portfolio_transactions`. Portfolio transaction history
is authoritative; holdings are derived/current state.

### 171 --- Portfolio benchmark

**Decision:** `portfolios` has a foreign-key benchmark relationship to
`benchmarks`.

### 172 --- FinSight Lab scenario schema

**Decision:** Replace the single-stock/single-lump-sum simulation model
with a scenario model supporting Single Investment, Recurring
Investment, Portfolio Scenario, Compare Scenarios, and Backtest
Strategy. Use child records for assets/allocations/contributions and
scenario comparison relationships.

### 173 --- Simulation result metrics

**Decision:** Simulation results must expose/store or deterministically
compute all required metrics: initial/final value, gross/net return,
dividends, fees, estimated taxes, FX impact, CAGR, XIRR where
applicable, volatility, Sharpe, max drawdown, benchmark comparison, and
return attribution.

### 174 --- Required database entities

**Decision:** Define actual schemas for exchanges, fundamentals,
benchmarks, tax_rules, backtests, backtest_results, user_preferences,
portfolio_transactions, scenarios and required scenario children, and
finance_transactions before the affected implementation phases.

### 175 --- Stock Screener MVP

**Decision:** Initial screener filters are exchange, country, sector,
market cap, price, P/E, EPS, dividend yield, revenue, profit, debt,
52-week range, volume, RSI, and moving-average relationship. Initial UX
supports AND filtering, sorting, pagination, reset, stock-detail
navigation, and watchlist actions. Advanced screening is later.

### 176 --- Single authoritative scenario mechanism

**Decision:** `scenarios.scenario_type` permits only `SINGLE_INVESTMENT`,
`RECURRING_INVESTMENT`, and `PORTFOLIO_SCENARIO`. `COMPARE_SCENARIOS` is
represented by `scenario_comparisons` linking existing saved scenarios.
`BACKTEST_STRATEGY` is represented by `backtests`/`backtest_results` and
uses the shared backtesting engine. Neither is a `scenario_type`.

### 177 --- Draft simulations table superseded

**Decision:** The earlier single-stock/single-lump-sum `simulations` table
is fully replaced by `scenarios` and `simulation_results`. The draft
`simulations` table must not be created in final migrations.

### 178 --- Portfolio Scenario contribution allocation

**Decision:** `scenario_contributions.scenario_asset_id` is nullable. A
non-null value targets a specific scenario asset. A null value is
allocated across the scenario assets according to the scenario's target
allocation policy. This supports both single-asset recurring investment
and multi-asset recurring portfolio scenarios without ambiguity.

### 179 --- Final foreign-key cleanup

**Decision:** `scenarios.tax_rule_id` directly references `tax_rules(id)`,
and `user_preferences.default_benchmark_id` directly references
`benchmarks(id)`. Stale deferred-resolution comments are removed.

### 180 --- Scenario/backtest persistence boundary

**Decision:** The three saved FinSight Lab scenario types are
`SINGLE_INVESTMENT`, `RECURRING_INVESTMENT`, and `PORTFOLIO_SCENARIO`.
`COMPARE_SCENARIOS` is represented by `scenario_comparisons` over existing
saved scenarios. `BACKTEST_STRATEGY` is represented by
`backtests`/`backtest_results` and uses the shared backtesting engine.
Neither comparison nor backtesting is a `scenarios.scenario_type`.

### 181 --- Nullable scenario contribution uniqueness

**Decision:** `scenario_contributions.scenario_asset_id` remains nullable,
but duplicate unspecified-asset contributions must be prevented at the
database level with a partial unique index on
`(scenario_id, contribution_date) WHERE scenario_asset_id IS NULL`. The
existing table-level UNIQUE constraint continues to protect non-null asset
assignments.

### 182 --- Final timestamp standardization

**Decision:** All system/audit timestamps across the entire final schema,
including legacy tables retained from the draft definitions, use
`TIMESTAMPTZ` with UTC semantics. No final migration may leave a system
timestamp as plain `TIMESTAMP`.

### 183 --- API Response Success and Metadata Envelope Standard (September 10, 2026)

**Decision:** To provide a consistent, structured interface across all REST endpoints (`/api/v1`), standard responses adopt an explicit envelope contract that complements the locked error response contract (`{ success: false, error: { code, message } }`).
Successful responses use:
```json
{
  "success": true,
  "data": <payload>,
  "error": null,
  "meta": {
    "timestamp": "<ISO-8601 UTC timestamp>",
    "freshness": "<Live | Delayed | End-of-day | Historical | Static>"
  }
}
```
Error responses strictly retain the locked contract from Specification Section 13:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": []
  }
}
```
Both backend controllers and frontend API clients adhere to this unified contract.

## Status

**Requirements: DONE**\
**Architecture: DONE**\
**Implementation: NEXT**

