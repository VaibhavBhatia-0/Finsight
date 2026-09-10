-- ============================================================================
-- Migration: 001_initial_schema.sql
-- Description: FinSight 26-Entity Reconciled Relational Schema (PostgreSQL)
-- Specification: FinSight Database & SQL Specification FINAL (Sept 9, 2026)
-- Enforces: TIMESTAMPTZ for all system timestamps, NUMERIC for financial amounts,
--           Partial unique index uq_scenario_contrib_null_asset, strict FKs.
-- ============================================================================

-- 1. EXCHANGES
CREATE TABLE IF NOT EXISTS exchanges (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    country_code CHAR(2) NOT NULL,
    currency CHAR(3),
    timezone VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. BENCHMARKS
CREATE TABLE IF NOT EXISTS benchmarks (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    exchange_id BIGINT REFERENCES exchanges(id) ON DELETE SET NULL,
    currency CHAR(3),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TAX RULES (Versioned & Effective-Dated)
CREATE TABLE IF NOT EXISTS tax_rules (
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

-- 4. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(100),
    base_currency CHAR(3) DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. USER PREFERENCES (1:1 with Users)
CREATE TABLE IF NOT EXISTS user_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    default_currency CHAR(3) NOT NULL DEFAULT 'INR',
    default_benchmark_id BIGINT REFERENCES benchmarks(id) ON DELETE SET NULL,
    dashboard_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
    selected_market_indices JSONB NOT NULL DEFAULT '[]'::jsonb,
    watchlist_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. STOCKS
CREATE TABLE IF NOT EXISTS stocks (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    exchange_id BIGINT REFERENCES exchanges(id) ON DELETE RESTRICT,
    exchange VARCHAR(30),
    company_name VARCHAR(255) NOT NULL,
    currency CHAR(3) NOT NULL,
    sector VARCHAR(100),
    industry VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, exchange_id)
);

-- 7. PRICE HISTORY (OHLCV)
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    trading_date DATE NOT NULL,
    open_price NUMERIC(18,6),
    high_price NUMERIC(18,6),
    low_price NUMERIC(18,6),
    close_price NUMERIC(18,6),
    adjusted_close NUMERIC(18,6),
    volume BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_id, trading_date)
);

-- 8. FUNDAMENTALS
CREATE TABLE IF NOT EXISTS fundamentals (
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

-- 9. DIVIDENDS
CREATE TABLE IF NOT EXISTS dividends (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    ex_date DATE NOT NULL,
    payment_date DATE,
    amount NUMERIC(18,8) NOT NULL,
    currency CHAR(3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_id, ex_date)
);

-- 10. CORPORATE ACTIONS (Extensible action_type)
CREATE TABLE IF NOT EXISTS corporate_actions (
    id BIGSERIAL PRIMARY KEY,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_date DATE NOT NULL,
    ratio NUMERIC(18,8),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. EXCHANGE RATES (Dynamic FX)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    base_currency CHAR(3) NOT NULL,
    quote_currency CHAR(3) NOT NULL,
    rate_date DATE NOT NULL,
    rate NUMERIC(24,12) NOT NULL,
    source VARCHAR(100),
    observed_at TIMESTAMPTZ,
    freshness VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(base_currency, quote_currency, rate_date)
);

-- 12. WATCHLISTS
CREATE TABLE IF NOT EXISTS watchlists (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. WATCHLIST ITEMS
CREATE TABLE IF NOT EXISTS watchlist_items (
    watchlist_id BIGINT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (watchlist_id, stock_id)
);

-- 14. PORTFOLIOS
CREATE TABLE IF NOT EXISTS portfolios (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    base_currency CHAR(3) DEFAULT 'INR',
    benchmark_id BIGINT REFERENCES benchmarks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. PORTFOLIO HOLDINGS (Derived state)
CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    quantity NUMERIC(24,8) NOT NULL,
    average_cost NUMERIC(18,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, stock_id)
);

-- 16. PORTFOLIO TRANSACTIONS (Authoritative Investment Ledger)
CREATE TABLE IF NOT EXISTS portfolio_transactions (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    stock_id BIGINT REFERENCES stocks(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('BUY','SELL','DIVIDEND','SPLIT','DEPOSIT','WITHDRAWAL','FEE')),
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

-- 17. SCENARIOS (FinSight Lab: SINGLE_INVESTMENT, RECURRING_INVESTMENT, PORTFOLIO_SCENARIO)
CREATE TABLE IF NOT EXISTS scenarios (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    scenario_type VARCHAR(30) NOT NULL
        CHECK (scenario_type IN ('SINGLE_INVESTMENT','RECURRING_INVESTMENT','PORTFOLIO_SCENARIO')),
    base_currency CHAR(3) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_amount NUMERIC(24,8),
    contribution_frequency VARCHAR(30),
    tax_rule_id BIGINT REFERENCES tax_rules(id) ON DELETE SET NULL,
    benchmark_id BIGINT REFERENCES benchmarks(id) ON DELETE SET NULL,
    assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. SCENARIO ASSETS
CREATE TABLE IF NOT EXISTS scenario_assets (
    id BIGSERIAL PRIMARY KEY,
    scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    target_weight NUMERIC(12,8),
    initial_amount NUMERIC(24,8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scenario_id, stock_id)
);

-- 19. SCENARIO CONTRIBUTIONS
CREATE TABLE IF NOT EXISTS scenario_contributions (
    id BIGSERIAL PRIMARY KEY,
    scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    scenario_asset_id BIGINT REFERENCES scenario_assets(id) ON DELETE CASCADE,
    contribution_date DATE NOT NULL,
    amount NUMERIC(24,8) NOT NULL,
    currency CHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scenario_id, contribution_date, scenario_asset_id)
);

-- Partial unique index for NULL scenario_asset_id (allocated per target policy)
CREATE UNIQUE INDEX IF NOT EXISTS uq_scenario_contrib_null_asset
    ON scenario_contributions(scenario_id, contribution_date)
    WHERE scenario_asset_id IS NULL;

-- 20. SCENARIO COMPARISONS (Compare Scenarios mode)
CREATE TABLE IF NOT EXISTS scenario_comparisons (
    id BIGSERIAL PRIMARY KEY,
    scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    compared_scenario_id BIGINT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scenario_id, compared_scenario_id),
    CHECK (scenario_id <> compared_scenario_id)
);

-- 21. SIMULATION RESULTS
CREATE TABLE IF NOT EXISTS simulation_results (
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

-- 22. BACKTESTS (Analyze -> Backtesting & FinSight Lab -> Backtest Strategy)
CREATE TABLE IF NOT EXISTS backtests (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,
    base_currency CHAR(3) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_amount NUMERIC(24,8),
    contribution_frequency VARCHAR(30),
    benchmark_id BIGINT REFERENCES benchmarks(id) ON DELETE SET NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. BACKTEST RESULTS
CREATE TABLE IF NOT EXISTS backtest_results (
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

-- 24. FINANCE TRANSACTIONS (Personal Finance Ledger: Income, Expense, Transfer)
CREATE TABLE IF NOT EXISTS finance_transactions (
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

-- 25. BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26. SAVINGS GOALS
CREATE TABLE IF NOT EXISTS savings_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    target_amount NUMERIC(18,2) NOT NULL,
    current_amount NUMERIC(18,2) DEFAULT 0,
    target_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PERFORMANCE & LOOKUP INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_price_history_stock_date
    ON price_history(stock_id, trading_date);

CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_portfolio_date
    ON portfolio_transactions(portfolio_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_date
    ON finance_transactions(user_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_scenarios_user_created
    ON scenarios(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_scenario_contributions_scenario_date
    ON scenario_contributions(scenario_id, contribution_date);

CREATE INDEX IF NOT EXISTS idx_fundamentals_stock_period
    ON fundamentals(stock_id, period_end);

CREATE INDEX IF NOT EXISTS idx_backtests_user_created
    ON backtests(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
    ON exchange_rates(base_currency, quote_currency, rate_date);

CREATE INDEX IF NOT EXISTS idx_watchlists_user
    ON watchlists(user_id);

CREATE INDEX IF NOT EXISTS idx_portfolios_user
    ON portfolios(user_id);

