# FinSight --- Database & SQL Specification

> **Source-of-truth rule:** The SQL migrations in `database/migrations/`
> are authoritative. The **Implemented Schema** section at the end of this
> document is generated from them (001–015). Earlier draft and reconciled
> sections are kept as design history and may differ in detail.

> **Status:** Implemented. 33 tables across migrations 001–015
> (last updated 22 October 2026).

## 1. Database Architecture

``` text
                         PostgreSQL
                              │
        ┌─────────────────────┼──────────────────────┐
        │                     │                      │
        ▼                     ▼                      ▼
   User Domain          Market Domain          Finance Domain
        │                     │                      │
        ▼                     ▼                      ▼
 users                 stocks                transactions
 watchlists             prices                budgets
 portfolios             dividends             savings/goals
 holdings               corporate_actions
 simulations
```

## 2. Proposed Entity Relationship Overview

``` text
users
  │
  ├───────────────┐
  │               │
  ▼               ▼
watchlists      portfolios
  │               │
  ▼               ▼
watchlist_items  portfolio_holdings
  │               │
  ▼               ▼
stocks          stocks

users
  │
  ├───────────────┬───────────────┐
  ▼               ▼               ▼
finance_transactions    budgets        savings_goals

stocks
  │
  ├──────────────┬──────────────┬────────────────┐
  ▼              ▼              ▼                ▼
price_history  dividends  corporate_actions  fundamentals

users
  │
  ▼
simulations
  │
  ▼
simulation_results
```

## 3. Core Tables

### users

``` sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(100),
    base_currency CHAR(3) DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### stocks

``` sql
CREATE TABLE stocks (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(30),
    company_name VARCHAR(255) NOT NULL,
    currency CHAR(3),
    sector VARCHAR(100),
    industry VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, exchange)
);
```

### price_history

``` sql
CREATE TABLE price_history (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT NOT NULL REFERENCES stocks(id),
    trading_date DATE NOT NULL,
    open_price NUMERIC(18,6),
    high_price NUMERIC(18,6),
    low_price NUMERIC(18,6),
    close_price NUMERIC(18,6),
    adjusted_close NUMERIC(18,6),
    volume BIGINT,
    UNIQUE(stock_id, trading_date)
);
```

## 4. Watchlists

``` sql
CREATE TABLE watchlists (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE watchlist_items (
    watchlist_id BIGINT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (watchlist_id, stock_id)
);
```

## 5. Portfolios

``` sql
CREATE TABLE portfolios (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    base_currency CHAR(3) DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE portfolio_holdings (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    stock_id BIGINT NOT NULL REFERENCES stocks(id),
    quantity NUMERIC(24,8) NOT NULL,
    average_cost NUMERIC(18,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, stock_id)
);
```

## 6. Personal Finance

### finance_transactions

``` sql
CREATE TABLE finance_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    currency CHAR(3) DEFAULT 'INR',
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### budgets

``` sql
CREATE TABLE budgets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### savings_goals

``` sql
CREATE TABLE savings_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    target_amount NUMERIC(18,2) NOT NULL,
    current_amount NUMERIC(18,2) DEFAULT 0,
    target_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 7. Investment Simulations

``` sql
CREATE TABLE simulations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id BIGINT NOT NULL REFERENCES stocks(id),
    investment_amount NUMERIC(18,2) NOT NULL,
    investment_currency CHAR(3) NOT NULL,
    buy_date DATE NOT NULL,
    sell_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### simulation_results

``` sql
CREATE TABLE simulation_results (
    id BIGSERIAL PRIMARY KEY,
    simulation_id BIGINT NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    buy_price NUMERIC(18,6),
    sell_price NUMERIC(18,6),
    shares NUMERIC(24,8),
    gross_value NUMERIC(18,2),
    gross_profit NUMERIC(18,2),
    currency_impact NUMERIC(18,2),
    dividend_value NUMERIC(18,2),
    estimated_fees NUMERIC(18,2),
    estimated_tax NUMERIC(18,2),
    net_value NUMERIC(18,2),
    net_profit NUMERIC(18,2),
    return_percentage NUMERIC(12,6),
    cagr NUMERIC(12,6),
    volatility NUMERIC(12,6),
    max_drawdown NUMERIC(12,6),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 8. Market Data Extensions

### dividends

``` sql
CREATE TABLE dividends (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    ex_date DATE NOT NULL,
    payment_date DATE,
    amount NUMERIC(18,8) NOT NULL,
    currency CHAR(3),
    UNIQUE(stock_id, ex_date)
);
```

### corporate_actions

``` sql
CREATE TABLE corporate_actions (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_date DATE NOT NULL,
    ratio NUMERIC(18,8),
    description TEXT
);
```

## 9. Exchange Rates

``` sql
CREATE TABLE exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    base_currency CHAR(3) NOT NULL,
    quote_currency CHAR(3) NOT NULL,
    rate_date DATE NOT NULL,
    rate NUMERIC(24,12) NOT NULL,
    UNIQUE(base_currency, quote_currency, rate_date)
);
```

## 10. Relationships

``` text
users
 │
 ├──< watchlists
 │       │
 │       └──< watchlist_items >── stocks
 │
 ├──< portfolios
 │       │
 │       └──< portfolio_holdings >── stocks
 │
 ├──< transactions
 │
 ├──< budgets
 │
 ├──< savings_goals
 │
 └──< simulations
           │
           ├── stock
           └── simulation_results

stocks
 │
 ├──< price_history
 ├──< dividends
 ├──< corporate_actions
 └── fundamentals (future)
```

## 11. Important Indexes

Likely indexes:

``` sql
CREATE INDEX idx_price_history_stock_date
ON price_history(stock_id, trading_date);

CREATE INDEX idx_finance_transactions_user_date
ON finance_transactions(user_id, transaction_date);

CREATE INDEX idx_simulations_user_date
ON simulations(user_id, created_at);

CREATE INDEX idx_watchlists_user
ON watchlists(user_id);

CREATE INDEX idx_portfolios_user
ON portfolios(user_id);

CREATE INDEX idx_exchange_rates_date
ON exchange_rates(base_currency, quote_currency, rate_date);
```

## 12. SQL Design Principles

-   Use normalized relational structures for transactional data.
-   Use foreign keys for referential integrity.
-   Use unique constraints to prevent duplicate market observations.
-   Use indexes for common user/date/stock queries.
-   Use `NUMERIC` rather than floating-point SQL types for monetary
    values.
-   Store timestamps for auditability.
-   Keep market history separate from user-generated financial records.
-   Do not store raw passwords; only password hashes.
-   Keep secrets/API keys outside the database and source code.
-   Use parameterized queries/prepared statements.

## 13. Important Future Schema Decisions

Status as implemented (see the Implemented Schema section for columns):

-   [x] Tax model and jurisdiction: `tax_rules` (IN/US, educational estimates); `user_preferences.tax_residency` / `tax_status`
-   [x] Multi-currency portfolio model: per-transaction currency and `fx_rate` on `portfolio_transactions`; `exchange_rates` cache
-   [x] Fractional-share handling: quantities are `NUMERIC`
-   [ ] Dividend reinvestment: not modelled; dividends accrue as cash
-   [x] Stock split adjustment strategy: provider (Yahoo) closes and dividends are already split-adjusted, so scenarios do not re-apply provider splits; ledger `SPLIT` entries in portfolios are applied once, chronologically
-   [x] Historical adjusted-price strategy: `price_history` stores both `close` and `adjusted_close`; backtesting uses adjusted closes
-   [x] Fundamentals schema: `fundamentals` table exists, but no current provider populates it (see Implemented Schema notes)
-   [ ] News schema: not implemented
-   [x] Benchmark/index schema: `benchmarks`
-   [x] Backtest result storage: `backtests`, `backtest_results`
-   [x] Portfolio transaction-history model: `portfolio_transactions` is the ledger; `portfolio_holdings` is derived
-   [x] Caching strategy: in-process provider caches plus `price_history` / `exchange_rates` persistence
-   [ ] Data retention policy: not defined

------------------------------------------------------------------------

# Draft Schema Direction (Superseded by Final Reconciled Schema below)

The schema remains proposed until the final market-data provider and
implementation details are confirmed.

Required considerations: - Multiple portfolios with custom names,
currencies, benchmarks, and target allocations. - Simulated buy/sell
transaction history and recurring/DCA investments. - Dividends and
corporate actions as separate market entities. - Multi-currency
portfolios and historical exchange rates. - Simulation results
preserving stock return, FX impact, dividends, fees, estimated taxes,
net value/profit, CAGR, volatility, drawdown, and benchmark context. -
Saved simulations with rename/delete/compare support. -
Versioned/effective-dated tax rules. - Tax jurisdiction/status without
IP-based inference. - Market-data source/freshness metadata where
appropriate. - India NSE/BSE and US NYSE/NASDAQ as first-class
markets. - Extensible exchange/provider model. - Fundamentals,
benchmarks, news/events, and backtesting as progressive extensions. -
Alerts/notifications deferred from MVP. - Keep caching simple; no
Redis-specific dependency initially.

Maintain existing principles: normalized relational design, foreign
keys, uniqueness constraints, indexed common queries, NUMERIC for
monetary values, audit timestamps, separation of market history from
user records, and secrets outside the database.

# Final Database Decisions --- Locked

The database must support the complete agreed FinSight scope. The schema
may be refined during implementation, but refinements must preserve
these requirements.

## Required Domains

-   User/account domain
-   Market/security domain
-   Portfolio domain
-   FinSight Lab domain
-   Personal Finance domain
-   Analytics/backtesting domain
-   FX/currency domain
-   Tax-rule domain

## Required Core Entities

``` text
users
stocks
exchanges
price_history
fundamentals
dividends
corporate_actions
exchange_rates

watchlists
watchlist_items

portfolios
portfolio_holdings
transactions

simulations
simulation_results

backtests
backtest_results

expenses
budgets
savings_goals

tax_rules
benchmarks/index data as required
```

## Dynamic FX

`exchange_rates` must support historical and current rates with at
least: - base currency - quote currency - rate - timestamp/effective
date - source - freshness metadata where applicable

Do not store a single static USD/INR value. Historical FinSight Lab
calculations must resolve the correct FX rate for each
transaction/contribution date. Current portfolio valuation must use the
latest available FX rate.

## Portfolio Model

Portfolio changes are transaction-driven. The database must support BUY,
SELL, DIVIDEND, SPLIT, DEPOSIT, WITHDRAWAL, and FEE concepts. Multiple
portfolios per user are supported, with base currency and benchmark
configuration.

## FinSight Lab Model

Saved scenarios preserve inputs and computed results. Inputs include
asset(s), dates, amounts, contribution strategy, allocation, currency,
FX assumptions/source, fees, tax profile, and benchmark. Results
preserve gross/net performance, dividends, fees, estimated taxes, FX
impact, risk metrics, and benchmark context.

## Personal Finance

Expenses, budgets, savings, goals, and related transactions are
user-owned. Records must be scoped by authenticated user and use foreign
keys/ON DELETE behavior appropriate to account deletion.

## Tax Rules

Tax rules are versioned and effective-dated, with jurisdiction,
asset/tax type, holding-period conditions, rates, and applicability
fields as required. User tax residency/status is stored only when
explicitly configured and is not inferred from IP.

## Data Integrity

-   `NUMERIC` for monetary/financial quantities.
-   UTC timestamps for system events.
-   Foreign keys and uniqueness constraints.
-   Index common lookup/query paths.
-   Migration-based schema changes.
-   Parameterized ORM/query-layer access.
-   Separate market data from user-owned financial records.
-   Preserve source/freshness metadata for external data where useful
    for reproducibility.

# Final Reconciled Database Schema --- September 9, 2026

**Authoritative rule:** This section supersedes earlier draft table
definitions where they conflict. The implementation must use migration
files derived from this reconciled model.

## 1. Exchanges and Benchmarks

``` sql
CREATE TABLE exchanges (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    country_code CHAR(2) NOT NULL,
    currency CHAR(3),
    timezone VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE benchmarks (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    exchange_id BIGINT REFERENCES exchanges(id),
    currency CHAR(3),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`stocks.exchange_id` must reference `exchanges(id)`; retain a
provider/external symbol field if needed rather than using free-text
exchange as the primary relationship.

## 2. Tax Rules

``` sql
CREATE TABLE tax_rules (
    id BIGSERIAL PRIMARY KEY,
    jurisdiction VARCHAR(50) NOT NULL,
    tax_type VARCHAR(50) NOT NULL,
    asset_type VARCHAR(50),
    effective_from DATE NOT NULL,
    effective_to DATE,
    holding_period_min_days INTEGER,
    rate NUMERIC(12,8),
    applicability JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
```

Tax rules are educational configuration data, not legal advice.

## 3. User Preferences

``` sql
CREATE TABLE user_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    default_currency CHAR(3) NOT NULL DEFAULT 'INR',
    default_benchmark_id BIGINT REFERENCES benchmarks(id),
    dashboard_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
    selected_market_indices JSONB NOT NULL DEFAULT '[]'::jsonb,
    watchlist_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`default_benchmark_id` directly references `benchmarks(id)`. The earlier
comment about resolving this relationship later is superseded.

## 4. Fundamentals

Fundamentals are time-aware because values such as revenue, EPS,
margins, and debt change over reporting periods.

``` sql
CREATE TABLE fundamentals (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    period_end DATE NOT NULL,
    fiscal_period VARCHAR(20),
    market_cap NUMERIC(24,6),
    pe_ratio NUMERIC(18,8),
    eps NUMERIC(18,8),
    dividend_yield NUMERIC(18,8),
    revenue NUMERIC(24,6),
    net_income NUMERIC(24,6),
    operating_margin NUMERIC(18,8),
    profit_margin NUMERIC(18,8),
    total_debt NUMERIC(24,6),
    source VARCHAR(100),
    source_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_id, period_end, fiscal_period)
);
```

## 5. Portfolio Transactions

Portfolio transactions are distinct from personal-finance transactions
and are the authoritative investment ledger.

``` sql
CREATE TABLE portfolio_transactions (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    stock_id BIGINT REFERENCES stocks(id),
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN
            ('BUY','SELL','DIVIDEND','SPLIT','DEPOSIT','WITHDRAWAL','FEE')),
    transaction_date DATE NOT NULL,
    quantity NUMERIC(24,8),
    price NUMERIC(24,8),
    amount NUMERIC(24,8) NOT NULL,
    currency CHAR(3) NOT NULL,
    fee_amount NUMERIC(24,8) DEFAULT 0,
    fx_rate NUMERIC(24,12),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`portfolio_holdings` is derived/current state and must not be treated as
the authoritative history.

## 6. Portfolio Benchmark

`portfolios` must contain a `benchmark_id BIGINT REFERENCES benchmarks(id)`
column. The final migration must define this column as part of the
authoritative `portfolios` table definition; do not rely on a later
ad-hoc alteration.

## 7. FinSight Lab Scenario Model

**Authoritative modeling rule:** `scenarios` represent only the three
saved simulation scenario types: `SINGLE_INVESTMENT`,
`RECURRING_INVESTMENT`, and `PORTFOLIO_SCENARIO`. `COMPARE_SCENARIOS` and
`BACKTEST_STRATEGY` are user-facing FinSight Lab modes but are modeled by
`scenario_comparisons` and `backtests` respectively. They must not be
inserted into `scenarios.scenario_type`.

The earlier draft `simulations` table is superseded by this model and
must not be created.


``` sql
CREATE TABLE scenarios (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    scenario_type VARCHAR(30) NOT NULL
        CHECK (scenario_type IN
            ('SINGLE_INVESTMENT','RECURRING_INVESTMENT',
             'PORTFOLIO_SCENARIO')),
    base_currency CHAR(3) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_amount NUMERIC(24,8),
    contribution_frequency VARCHAR(30),
    tax_rule_id BIGINT REFERENCES tax_rules(id),
    benchmark_id BIGINT REFERENCES benchmarks(id),
    assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scenario_assets (
    id BIGSERIAL PRIMARY KEY,
    scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    stock_id BIGINT NOT NULL REFERENCES stocks(id),
    target_weight NUMERIC(12,8),
    initial_amount NUMERIC(24,8),
    UNIQUE(scenario_id, stock_id)
);

CREATE TABLE scenario_contributions (
    id BIGSERIAL PRIMARY KEY,
    scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    scenario_asset_id BIGINT REFERENCES scenario_assets(id) ON DELETE CASCADE,
    contribution_date DATE NOT NULL,
    amount NUMERIC(24,8) NOT NULL,
    currency CHAR(3) NOT NULL,
    UNIQUE(scenario_id, contribution_date, scenario_asset_id)
);

-- PostgreSQL treats NULL values as distinct in UNIQUE constraints. The
-- nullable scenario_asset_id path therefore needs a partial unique index
-- to prevent duplicate unspecified-asset contributions for the same
-- scenario and contribution date.

CREATE TABLE scenario_comparisons (
    id BIGSERIAL PRIMARY KEY,
    scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    compared_scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    UNIQUE(scenario_id, compared_scenario_id),
    CHECK (scenario_id <> compared_scenario_id)
);

CREATE UNIQUE INDEX uq_scenario_contrib_null_asset
    ON scenario_contributions(scenario_id, contribution_date)
    WHERE scenario_asset_id IS NULL;
```

The table-level UNIQUE constraint handles non-null `scenario_asset_id`
values; the partial unique index handles the nullable unspecified-asset
path. A recurring scenario uses `scenario_contributions`; a portfolio scenario
uses multiple `scenario_assets`. A contribution with a non-null
`scenario_asset_id` targets that asset directly. A contribution with a
null `scenario_asset_id` is allocated across the scenario's assets using
its defined target-allocation policy. `COMPARE_SCENARIOS` is not a
`scenario_type`; it is represented by `scenario_comparisons`, which links
two existing saved scenarios. `BACKTEST_STRATEGY` is not a
`scenario_type`; it is represented by `backtests`/`backtest_results` and
uses the shared backtesting engine.

## 8. Simulation Results

``` sql
CREATE TABLE simulation_results (
    id BIGSERIAL PRIMARY KEY,
    scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    initial_value NUMERIC(24,8),
    final_value NUMERIC(24,8),
    gross_value NUMERIC(24,8),
    gross_profit NUMERIC(24,8),
    net_value NUMERIC(24,8),
    net_profit NUMERIC(24,8),
    dividends NUMERIC(24,8),
    fees NUMERIC(24,8),
    estimated_tax NUMERIC(24,8),
    fx_impact NUMERIC(24,8),
    return_percentage NUMERIC(18,8),
    cagr NUMERIC(18,8),
    xirr NUMERIC(18,8),
    volatility NUMERIC(18,8),
    sharpe_ratio NUMERIC(18,8),
    max_drawdown NUMERIC(18,8),
    benchmark_return NUMERIC(18,8),
    benchmark_difference NUMERIC(18,8),
    asset_return NUMERIC(18,8),
    attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Not every analytics metric must be permanently stored if a deterministic
API response is more appropriate, but every required product metric must
be available to the application.

## 9. Backtesting

Backtesting uses its own saved configuration/result records but calls
the same analytics engine used by the FinSight Lab `Backtest Strategy`
entry point.

``` sql
CREATE TABLE backtests (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,
    base_currency CHAR(3) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_amount NUMERIC(24,8),
    contribution_frequency VARCHAR(30),
    benchmark_id BIGINT REFERENCES benchmarks(id),
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE backtest_results (
    id BIGSERIAL PRIMARY KEY,
    backtest_id BIGINT NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
    total_invested NUMERIC(24,8),
    final_value NUMERIC(24,8),
    absolute_return NUMERIC(24,8),
    return_percentage NUMERIC(18,8),
    cagr NUMERIC(18,8),
    xirr NUMERIC(18,8),
    volatility NUMERIC(18,8),
    max_drawdown NUMERIC(18,8),
    sharpe_ratio NUMERIC(18,8),
    benchmark_return NUMERIC(18,8),
    benchmark_difference NUMERIC(18,8),
    time_series JSONB,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 10. Finance Transactions

The personal-finance ledger is explicitly separate:

``` sql
CREATE TABLE finance_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('INCOME','EXPENSE','TRANSFER')),
    category VARCHAR(100),
    amount NUMERIC(18,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    description TEXT,
    transaction_date DATE NOT NULL,
    recurring BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

The existing product concept of "expenses" is represented by
`finance_transactions` with `transaction_type='EXPENSE'`; do not create
an unrelated duplicate expense ledger unless a later decision requires
it.

## 11. Exchange Rates

The final exchange-rate model must retain source/freshness metadata:

``` sql
ALTER TABLE exchange_rates
    ADD COLUMN source VARCHAR(100),
    ADD COLUMN observed_at TIMESTAMPTZ,
    ADD COLUMN freshness VARCHAR(20);
```

Use `TIMESTAMPTZ` for system timestamps. Historical rates are resolved
by effective date; current valuation uses the latest valid observation.

## 12. Stock ↔ Exchange Relationship

The final `stocks` model should include:

``` sql
ALTER TABLE stocks
    ADD COLUMN exchange_id BIGINT REFERENCES exchanges(id);
```

Migrations should consolidate this with the original `exchange` field
rather than leaving two competing authoritative representations.

## 13. Required Indexes

At minimum:

``` sql
CREATE INDEX idx_portfolio_transactions_portfolio_date
    ON portfolio_transactions(portfolio_id, transaction_date);

CREATE INDEX idx_finance_transactions_user_date
    ON finance_transactions(user_id, transaction_date);

CREATE INDEX idx_scenarios_user_created
    ON scenarios(user_id, created_at);

CREATE INDEX idx_scenario_contributions_scenario_date
    ON scenario_contributions(scenario_id, contribution_date);

-- The partial unique index above enforces uniqueness when
-- scenario_asset_id IS NULL. The table-level UNIQUE constraint handles
-- non-null scenario_asset_id values.

CREATE INDEX idx_fundamentals_stock_period
    ON fundamentals(stock_id, period_end);

CREATE INDEX idx_backtests_user_created
    ON backtests(user_id, created_at);
```

## 14. Database Implementation Rules

-   Use migrations; never edit production schema manually.
-   Use UTC/TIMESTAMPTZ for system timestamps across ALL tables, including
    legacy/draft tables retained above (users, stocks, price_history,
    watchlists, watchlist_items, portfolios, portfolio_holdings, budgets,
    and savings_goals). No final migration may leave a system timestamp as
    plain `TIMESTAMP`.
-   Use `NUMERIC` for financial values.
-   Use foreign keys and appropriate cascading behavior.
-   Keep user-owned data separated from market data.
-   Scope every user-owned query by authenticated user.
-   Do not treat derived holdings snapshots as the investment ledger.
-   Keep provider/source/freshness metadata wherever needed for
    reproducibility.
-   If implementation needs a schema refinement, document it before
    coding the affected feature.

# Implemented Schema --- generated from migrations 001–015

This section is generated by applying every file in `database/migrations/`
to an empty PostgreSQL 16 database and reading `information_schema`.
Regenerate it whenever a migration is added.

## Migrations

-   `001_initial_schema.sql`
-   `002_repair_invariants.sql`
-   `003_relabel_fixture_fx.sql`
-   `004_finance_recurring_rules.sql`
-   `005_tax_preferences.sql`
-   `006_savings_goal_contributions.sql`
-   `007_auth_recovery.sql`
-   `008_google_oauth.sql`
-   `009_market_data_provenance.sql`
-   `010_security_universe_sync.sql`
-   `011_security_universe_timestamp.sql`
-   `012_oauth_identities_and_backtest_metrics.sql`
-   `013_portfolio_intelligence.sql`
-   `014_market_alerts.sql`
-   `015_market_reference_bootstrap.sql`

Applied migrations are recorded in `schema_migrations`. The backend runs
pending migrations transactionally at startup.

## Data notes

-   **Security catalogue.** `stocks` is filled by migration 015 (8 baseline
    securities) and by the fingerprint-approved importer
    (`npm run universe:sync`, then `--apply --expect-sha256=…`) from the
    official NSE and Nasdaq Trader directories: about 9,100 NSE, NASDAQ and
    NYSE listings. Each run is recorded in `security_universe_syncs`. The
    importer never deletes securities and never creates price rows.
-   **Fundamentals.** The `fundamentals` table is present but not populated
    by the current Yahoo chart provider. Market cap, P/E, EPS, revenue,
    profit and debt therefore show as unavailable. Dividend yield is
    computed at request time as a trailing 12-month figure from provider
    dividends and the latest price; it is not stored.
-   **Prices and corporate actions.** Provider closes and dividend amounts
    are split-adjusted. Scenario simulations use them as-is and do not
    re-apply provider split events. `dividends` and `corporate_actions`
    rows, when present, come from the database; provider events are merged
    at request time.
-   **Personal finance.** Expenses are `finance_transactions` rows with
    `transaction_type = 'EXPENSE'`. Budget spending matches expense
    categories case-insensitively within the budget's date range.
-   **JSONB columns** (`user_preferences.dashboard_layout`,
    `selected_market_indices`, `watchlist_preferences`, scenario
    assumptions and backtest series) are always written as JSON text by
    the repositories, because node-postgres would otherwise send JS arrays
    as PostgreSQL array literals.

## Tables

#### `auth_action_tokens`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no |  |
| user_id | uuid | no | → `users` |
| token_hash | char | no |  |
| token_type | varchar | no |  |
| expires_at | timestamptz | no |  |
| used_at | timestamptz | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `auth_identities`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no |  |
| user_id | uuid | no | → `users` |
| provider | varchar | no |  |
| provider_subject | varchar | no |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| updated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `backtest_results`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| backtest_id | bigint | no | → `backtests` |
| total_invested | numeric | yes |  |
| final_value | numeric | yes |  |
| absolute_return | numeric | yes |  |
| return_percentage | numeric | yes |  |
| cagr | numeric | yes |  |
| xirr | numeric | yes |  |
| volatility | numeric | yes |  |
| max_drawdown | numeric | yes |  |
| sharpe_ratio | numeric | yes |  |
| benchmark_return | numeric | yes |  |
| benchmark_difference | numeric | yes |  |
| time_series | jsonb | yes |  |
| calculated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| benchmark_cagr | numeric | yes |  |
| relative_performance | numeric | yes |  |
| fees_paid | numeric | yes |  |
| gross_final_value | numeric | yes |  |
| attribution | jsonb | no | default `'{}'` |

#### `backtests`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| name | varchar | no |  |
| strategy_type | varchar | no |  |
| base_currency | char | no |  |
| start_date | date | no |  |
| end_date | date | no |  |
| initial_amount | numeric | yes |  |
| contribution_frequency | varchar | yes |  |
| benchmark_id | bigint | yes | → `benchmarks` |
| parameters | jsonb | no | default `'{}'` |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| updated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `benchmarks`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| code | varchar | no |  |
| name | varchar | no |  |
| exchange_id | bigint | yes | → `exchanges` |
| currency | char | yes |  |
| description | text | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `budgets`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| category | varchar | no |  |
| amount | numeric | no |  |
| start_date | date | no |  |
| end_date | date | no |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `corporate_actions`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| stock_id | bigint | no | → `stocks` |
| action_type | varchar | no |  |
| action_date | date | no |  |
| ratio | numeric | yes |  |
| description | text | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `dividends`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| stock_id | bigint | no | → `stocks` |
| ex_date | date | no |  |
| payment_date | date | yes |  |
| amount | numeric | no |  |
| currency | char | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `exchange_rates`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| base_currency | char | no |  |
| quote_currency | char | no |  |
| rate_date | date | no |  |
| rate | numeric | no |  |
| source | varchar | yes |  |
| observed_at | timestamptz | yes |  |
| freshness | varchar | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `exchanges`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| code | varchar | no |  |
| name | varchar | no |  |
| country_code | char | no |  |
| currency | char | yes |  |
| timezone | varchar | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `finance_recurring_rules`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| transaction_type | varchar | no |  |
| category | varchar | no |  |
| amount | numeric | no |  |
| currency | char | no |  |
| description | text | yes |  |
| start_date | date | no |  |
| end_date | date | yes |  |
| frequency | varchar | no |  |
| active | boolean | no | default `true` |
| notes | text | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| updated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `finance_transactions`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| transaction_type | varchar | no |  |
| category | varchar | yes |  |
| amount | numeric | no |  |
| currency | char | no | default `'INR'` |
| description | text | yes |  |
| transaction_date | date | no |  |
| recurring | boolean | no | default `false` |
| notes | text | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| recurring_rule_id | bigint | yes | → `finance_recurring_rules` |

#### `fundamentals`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| stock_id | bigint | no | → `stocks` |
| period_end | date | no |  |
| fiscal_period | varchar | yes |  |
| market_cap | numeric | yes |  |
| pe_ratio | numeric | yes |  |
| eps | numeric | yes |  |
| dividend_yield | numeric | yes |  |
| revenue | numeric | yes |  |
| net_income | numeric | yes |  |
| operating_margin | numeric | yes |  |
| profit_margin | numeric | yes |  |
| total_debt | numeric | yes |  |
| source | varchar | yes |  |
| source_timestamp | timestamptz | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `oauth_states`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no |  |
| state_hash | char | no |  |
| provider | varchar | no |  |
| expires_at | timestamptz | no |  |
| used_at | timestamptz | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| nonce_hash | char | yes |  |

#### `portfolio_holdings`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| portfolio_id | bigint | no | → `portfolios` |
| stock_id | bigint | no | → `stocks` |
| quantity | numeric | no |  |
| average_cost | numeric | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `portfolio_transactions`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| portfolio_id | bigint | no | → `portfolios` |
| stock_id | bigint | yes | → `stocks` |
| transaction_type | varchar | no |  |
| transaction_date | date | no |  |
| quantity | numeric | yes |  |
| price | numeric | yes |  |
| amount | numeric | no |  |
| currency | char | no |  |
| fee_amount | numeric | yes | default `0` |
| fx_rate | numeric | yes |  |
| notes | text | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `portfolios`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| name | varchar | no |  |
| base_currency | char | yes | default `'INR'` |
| benchmark_id | bigint | yes | → `benchmarks` |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| updated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| allocation_targets | jsonb | no | default `'{}'` |

#### `price_history`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| stock_id | bigint | no | → `stocks` |
| trading_date | date | no |  |
| open_price | numeric | yes |  |
| high_price | numeric | yes |  |
| low_price | numeric | yes |  |
| close_price | numeric | yes |  |
| adjusted_close | numeric | yes |  |
| volume | bigint | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| source | varchar | yes |  |
| observed_at | timestamptz | yes |  |

#### `savings_goal_contributions`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| goal_id | bigint | no | → `savings_goals` |
| amount | numeric | no |  |
| contribution_date | date | no |  |
| notes | text | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `savings_goals`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| name | varchar | no |  |
| target_amount | numeric | no |  |
| current_amount | numeric | yes | default `0` |
| target_date | date | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| base_currency | char | no | default `'INR'` |
| portfolio_id | bigint | yes | → `portfolios` |
| status | varchar | no | default `'ACTIVE'` |

#### `scenario_assets`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| scenario_id | bigint | no | → `scenarios` |
| stock_id | bigint | no | → `stocks` |
| target_weight | numeric | yes |  |
| initial_amount | numeric | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `scenario_comparisons`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| scenario_id | bigint | no | → `scenarios` |
| compared_scenario_id | bigint | no | → `scenarios` |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `scenario_contributions`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| scenario_id | bigint | no | → `scenarios` |
| scenario_asset_id | bigint | yes | → `scenario_assets` |
| contribution_date | date | no |  |
| amount | numeric | no |  |
| currency | char | no |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `scenarios`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| name | varchar | no |  |
| scenario_type | varchar | no |  |
| base_currency | char | no |  |
| start_date | date | no |  |
| end_date | date | no |  |
| initial_amount | numeric | yes |  |
| contribution_frequency | varchar | yes |  |
| tax_rule_id | bigint | yes | → `tax_rules` |
| benchmark_id | bigint | yes | → `benchmarks` |
| assumptions | jsonb | no | default `'{}'` |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| updated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `security_universe_syncs`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| source | varchar | no |  |
| security_count | integer | no |  |
| source_timestamp | timestamptz | yes |  |
| completed_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `simulation_results`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| scenario_id | bigint | no | → `scenarios` |
| initial_value | numeric | yes |  |
| final_value | numeric | yes |  |
| gross_value | numeric | yes |  |
| gross_profit | numeric | yes |  |
| net_value | numeric | yes |  |
| net_profit | numeric | yes |  |
| dividends | numeric | yes |  |
| fees | numeric | yes |  |
| estimated_tax | numeric | yes |  |
| fx_impact | numeric | yes |  |
| return_percentage | numeric | yes |  |
| cagr | numeric | yes |  |
| xirr | numeric | yes |  |
| volatility | numeric | yes |  |
| sharpe_ratio | numeric | yes |  |
| max_drawdown | numeric | yes |  |
| benchmark_return | numeric | yes |  |
| benchmark_difference | numeric | yes |  |
| asset_return | numeric | yes |  |
| attribution | jsonb | no | default `'{}'` |
| calculated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `stocks`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| symbol | varchar | no |  |
| exchange_id | bigint | yes | → `exchanges` |
| exchange | varchar | yes |  |
| company_name | varchar | no |  |
| currency | char | no |  |
| sector | varchar | yes |  |
| industry | varchar | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| display_symbol | varchar | no |  |
| provider_symbol | varchar | no |  |
| asset_type | varchar | no | default `'EQUITY'` |
| is_active | boolean | no | default `true` |

#### `tax_rules`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| jurisdiction | varchar | no |  |
| tax_type | varchar | no |  |
| asset_type | varchar | yes |  |
| effective_from | date | no |  |
| effective_to | date | yes |  |
| holding_period_min_days | integer | yes |  |
| rate | numeric | yes |  |
| applicability | jsonb | no | default `'{}'` |
| source_reference | text | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `user_market_alerts`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| stock_id | bigint | no | → `stocks` |
| condition | varchar | no |  |
| threshold | numeric | no |  |
| enabled | boolean | no | default `true` |
| triggered_at | timestamptz | yes |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| updated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `user_preferences`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| theme | varchar | no | default `'system'` |
| default_currency | char | no | default `'INR'` |
| default_benchmark_id | bigint | yes | → `benchmarks` |
| dashboard_layout | jsonb | no | default `'{}'` |
| selected_market_indices | jsonb | no | default `'[]'` |
| watchlist_preferences | jsonb | no | default `'{}'` |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| updated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| tax_residency | varchar | yes |  |
| tax_status | varchar | yes |  |

#### `users`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no |  |
| email | varchar | no |  |
| password_hash | text | no |  |
| name | varchar | yes |  |
| base_currency | char | yes | default `'INR'` |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| updated_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
| email_verified_at | timestamptz | yes |  |
| auth_version | integer | no | default `0` |
| google_subject | varchar | yes |  |

#### `watchlist_items`

| Column | Type | Null | Notes |
|---|---|---|---|
| watchlist_id | bigint | no | → `watchlists` |
| stock_id | bigint | no | → `stocks` |
| added_at | timestamptz | no | default `CURRENT_TIMESTAMP` |

#### `watchlists`

| Column | Type | Null | Notes |
|---|---|---|---|
| id | bigint | no |  |
| user_id | uuid | no | → `users` |
| name | varchar | no |  |
| created_at | timestamptz | no | default `CURRENT_TIMESTAMP` |
