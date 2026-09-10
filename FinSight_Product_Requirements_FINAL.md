# FinSight --- Product Requirements & Feature Tracker

> **Source-of-truth rule:** The latest locked/final reconciliation
> sections in this document supersede earlier draft wording.

> **Status:** Product requirements and architecture decisions finalized;
> implementation phase ready\
> **Implementation:** Ready to begin\
> **Purpose:** Living document to track the product vision,
> requirements, features, and decisions for FinSight.

------------------------------------------------------------------------

## 1. Product Overview

**FinSight** is a full-stack **financial management and market
intelligence web platform** focused on helping users understand stocks,
track hypothetical portfolios, and simulate historical investments.

The platform is intended to provide **financial insights and educational
estimates**, not real-world brokerage or trading functionality.

### Core Product Idea

FinSight combines three major areas:

1.  **Market Intelligence** --- Understand stock performance, trends,
    and market data.
2.  **Portfolio Intelligence** --- Track an estimated/hypothetical
    portfolio and its performance.
3.  **Investment Simulation** --- Calculate what would have happened if
    a user had invested in a stock between two historical dates.

FinSight Lab is a key product differentiator. Implementation is phased,
but the complete agreed feature scope is retained.

------------------------------------------------------------------------

## 2. Platform & User Experience

### Application Type

-   Web-based application.
-   Responsive design.
-   Must work well on:
    -   Laptop/Desktop
    -   Mobile devices

### Hosting

-   Targeting free hosting where possible.
-   **Vercel** is the current preferred frontend hosting option.
-   Backend/deployment approach to be finalized later.

### Important Product Boundary

FinSight **does not execute real stock purchases or sales**.

All portfolio positions and transactions are hypothetical/simulated.

------------------------------------------------------------------------

## 3. Intended Technology Stack

### Frontend

-   React
-   Interactive dashboards
-   Responsive UI
-   Financial charts and visualizations

### Backend

-   Node.js
-   Express.js
-   RESTful APIs
-   JWT-based authentication

### Database

-   PostgreSQL
-   Normalized relational schema

Expected data areas include: - Users - Finance transactions - Portfolio
transactions - Budgets - Savings - Watchlists - Portfolio/simulation
data - Historical market data

### Analytics

-   Python
-   pandas
-   NumPy

Planned analytics include: - Spending trends - Moving averages -
Volatility - Portfolio performance - Market trend analysis

### DevOps

-   GitHub Actions
-   Automated CI/CD
-   Cloud deployment

------------------------------------------------------------------------

# 4. Core Features

## 4.1 User Dashboard

The dashboard should provide a centralized view of the user's
financial/market activity.

Potential dashboard components: - Watched stocks - Stock price
summaries - Market trends - Portfolio/simulation performance - Financial
summaries - Interactive charts - Relevant market metrics

------------------------------------------------------------------------

## 4.2 Stock Watchlist

Users should be able to add stocks they are interested in to their
personal dashboard/watchlist.

For each watched stock, FinSight may provide: - Current/latest available
price - Historical price data - Price trends - Performance over
different periods - Moving averages - Volatility - Other relevant market
indicators

The initial watchlist metric set is defined in the finalized Website
Specification; future metrics may be added without changing the core
architecture.

------------------------------------------------------------------------

## 4.3 Hypothetical Portfolio

Users can create an **estimated/simulated portfolio** rather than a real
investment portfolio.

The portfolio can contain hypothetical positions in selected stocks.

The platform should be able to show: - Initial simulated investment -
Current/selected-date value - Profit/loss - Percentage return -
Portfolio performance - Individual stock contribution - Visual
performance charts

No real money or brokerage account is involved.

------------------------------------------------------------------------

# 5. FinSight Lab --- MVP / Core Differentiator

The FinSight Lab is one of the main planned MVP features.

### User Flow

A user should be able to select:

-   Stock
-   Hypothetical buy date
-   Hypothetical sell date
-   Investment amount

Example:

> Stock: NVIDIA\
> Buy date: January 1, 2025\
> Sell date: January 1, 2026\
> Investment: ₹50,000

FinSight then estimates:

> **"If you had made this investment, approximately what would your
> return have been?"**

### Basic Calculation

The simulator should determine: - Historical buy price - Historical sell
price - Number of shares/units hypothetically purchased - Gross value at
the end date - Gross profit/loss - Percentage return

------------------------------------------------------------------------

# 6. Detailed Return Breakdown

FinSight should go beyond a simple:

> Sell Value − Buy Value

The goal is to explain **why the final amount is what it is**.

A simulated investment result may include:

-   Initial investment
-   Historical buy price
-   Historical sell price
-   Number of shares
-   Gross proceeds
-   Gross profit/loss
-   Currency conversion impact
-   Estimated taxes
-   Transaction costs/fees
-   Other applicable adjustments
-   Final estimated net value
-   Final estimated net profit/loss

### Example Concept

``` text
Initial Investment       ₹50,000
Gross Investment Value   ₹65,200
Gross Profit             ₹15,200
Currency Impact          -₹1,100
Estimated Taxes          -₹X
Estimated Charges        -₹X
--------------------------------
Estimated Net Profit     ₹XX,XXX
```

Calculation methodology is defined by the finalized FinSight Lab and
FX/tax requirements; implementation details must preserve those
requirements.

------------------------------------------------------------------------

# 7. Currency Exchange Impact

For investments involving foreign stocks/currencies, FinSight should
account for currency conversion where relevant.

Example:

A user invests in a US stock using INR.

The final result can be affected by: - INR → USD conversion at
purchase - USD → INR conversion at sale - Change in the exchange rate
during the investment period

The simulator should ideally separate:

**Stock return**\
vs.\
**Currency/exchange-rate impact**

This allows users to understand whether their return came from the stock
itself, currency movement, or both.

------------------------------------------------------------------------

# 8. Tax & Cost Breakdown

FinSight may provide an estimated breakdown of deductions that could
affect the simulated return.

Potential factors: - Applicable taxes - Transaction charges -
Brokerage/fees where relevant - Currency conversion costs - Other
relevant costs

### Important Scope Decision

These calculations should initially be treated as:

> **Educational/estimated calculations, not official tax or financial
> advice.**

The platform should avoid claiming that its result represents a user's
exact legal tax liability.

Tax calculations can depend on factors such as: - Jurisdiction - Holding
period - Investor status - Transaction type - Applicable
exemptions/rules - Other personal circumstances

The tax engine is jurisdiction-aware, versioned, and effective-dated,
with India and US as initial jurisdictions; results are educational
estimates.

------------------------------------------------------------------------

# 9. Market Intelligence

FinSight should provide users with meaningful insights rather than only
displaying raw stock prices.

Potential analytics: - Historical price trends - Moving averages -
Volatility - Trend analysis - Performance comparisons - Portfolio
performance - Historical investment performance

Python + pandas + NumPy will be used for analytical processing where
appropriate.

------------------------------------------------------------------------

# 10. Three Main Product Layers

The current product concept can be organized into three connected
layers.

### 1. Market Intelligence

> **"What's happening with this stock?"**

Provides: - Market data - Trends - Historical performance - Analytics -
Visualizations

### 2. Portfolio Intelligence

> **"How is my hypothetical portfolio performing?"**

Provides: - Simulated holdings - Portfolio value - Profit/loss -
Performance analysis - Visualizations

### 3. FinSight Lab

> **"What would have happened if I invested X amount between these
> dates?"**

Provides: - Historical buy/sell simulation - Gross return - Currency
impact - Estimated taxes/fees - Net return - Detailed breakdown

These layers should work together rather than feeling like completely
separate features.

------------------------------------------------------------------------

# 11. Example End-to-End Use Case

A user asks:

> **"What if I invested ₹1,00,000 in NVIDIA two years ago?"**

FinSight could:

1.  Retrieve historical stock prices.
2.  Determine the hypothetical purchase price.
3.  Calculate the number of shares that could have been purchased.
4.  Determine the historical selling/current value.
5.  Calculate gross return.
6.  Account for currency conversion where applicable.
7.  Estimate relevant taxes/fees.
8.  Calculate estimated net return.
9.  Visualize the investment performance.
10. Explain the factors contributing to the final result.
11. Optionally compare the result against another stock or benchmark.

This represents the intended direction of the FinSight experience.

------------------------------------------------------------------------

# 12. Existing Financial Management Scope

The original project scope also includes general financial management
functionality.

Planned areas include: - Expense management - Budget management -
Savings tracking - Transaction tracking - Financial summaries -
Portfolio tracking - Watchlists

Personal finance connects to investing only through an estimated
investable-surplus input into FinSight Lab; it must not become
personalized investment advice.

------------------------------------------------------------------------

# 13. Authentication & User Accounts

Planned: - User registration/login - JWT-based authentication -
User-specific data - Protected APIs - Persistent watchlists - Persistent
simulated portfolio data - Persistent financial records

Authentication and security requirements are finalized in the locked
sections below.

------------------------------------------------------------------------

# 14. Data & Analytics Considerations

FinSight will require historical and/or current market data.

The eventual implementation will need to determine: - Market data
provider/API - Historical data availability - API rate limits - Data
refresh strategy - Data caching - Supported exchanges - Supported
currencies - Handling of missing market data - Handling of market
holidays/weekends - Corporate actions such as stock splits/dividends

These items are finalized in the locked sections below. The
implementation remains provider-agnostic and must verify coverage,
freshness, rate limits, and licensing before deployment.

------------------------------------------------------------------------

# 15. Current Product Principles

1.  **Simulation, not brokerage**
    -   No real buying or selling.
2.  **Explain the result**
    -   Don't just provide a final profit/loss number.
    -   Show the factors contributing to it.
3.  **Mobile + desktop friendly**
    -   The application should be responsive.
4.  **Data-driven**
    -   Use historical/current market data and analytical processing.
5.  **Educational estimates**
    -   Tax and cost calculations should be presented as estimates.
6.  **Visual-first insights**
    -   Charts and dashboards should make financial information easier
        to understand.
7.  **MVP-focused**
    -   Prioritize the FinSight Lab and core market/portfolio
        functionality before adding excessive features.

------------------------------------------------------------------------

# Finalized Product & Implementation Decisions

> **Decision status:** Locked as of September 9, 2026. These decisions
> define the complete FinSight scope. They are not restricted to a
> V1/MVP feature cut; implementation order may be phased, but the agreed
> product scope remains intact.

## Product Scope

FinSight is a financial management + market intelligence + portfolio
analytics + investment-simulation platform. It does **not** execute real
trades or connect to brokerage accounts for real-money execution.
Portfolio and transaction activity is hypothetical/simulated.

### Navigation

-   Dashboard
-   Invest: Markets, Watchlist, Portfolios, FinSight Lab, Stock Screener
-   Finance: Expenses, Budgets, Savings, Goals
-   Analyze: Insights, Backtesting
-   System: Settings

## FinSight Lab

The former "FinSight Lab" is officially renamed **FinSight Lab**.

FinSight Lab includes: - Single Investment - Recurring Investment -
Portfolio Scenario - Compare Scenarios - Backtest Strategy

Supported analysis includes historical buy/sell scenarios, lump-sum
investment, recurring/DCA/SIP-style contributions, multiple
assets/allocations, fractional shares where supported, dividends,
corporate actions, fees, estimated taxes, dynamic FX, gross/net returns,
CAGR, volatility, Sharpe ratio, maximum drawdown, benchmark comparison,
and return attribution.

## Market Coverage

### India

-   NSE and BSE
-   NIFTY 50 and SENSEX
-   Indian stocks/ETFs
-   Historical OHLCV
-   Fundamentals
-   Dividends and corporate actions
-   Live/near-live data only where a legally usable free source actually
    provides it; otherwise label delayed/EOD data accurately.

### United States

-   NYSE and NASDAQ
-   S&P 500, NASDAQ Composite, Dow Jones
-   US stocks/ETFs
-   Historical OHLCV
-   Fundamentals
-   Dividends and corporate actions
-   Live/near-live data where available and legally usable.

Market data is provider-agnostic through `MarketDataService`, with
primary/fallback providers and PostgreSQL historical/cache storage.
Provider coverage, rate limits, freshness, and public-display licensing
must be verified before deployment. FinSight must never label delayed or
EOD data as live.

## Dynamic Currency & FX

Dynamic FX is a hard requirement. FinSight must support multiple
currencies rather than hard-coding a single exchange rate.

For historical simulations, the calculation engine uses the relevant
historical FX rate on each transaction/contribution date and the
relevant exit/current FX rate when converting back to the portfolio/user
base currency. For current valuation, the latest available FX rate is
used with timestamp/source/freshness.

Cross-currency attribution separates: - Asset return - FX impact -
Combined base-currency return

FX data follows the same provider → fallback → PostgreSQL
cache/degraded-state strategy as market data.

## Personal Finance

Personal Finance is part of each authenticated user's profile/account
and includes: - Expenses - Budgets - Savings - Goals - Transactions and
financial summaries

Expense tracking is initially manual/import-based and is not intended to
become a banking/UPI aggregation product. Expense descriptions can
receive rule-based category suggestions, with user correction.

Budgets compare planned versus actual spending. Goals support target
amount, deadline, progress, contribution rate, and projected completion.
Personal finance connects to investing through:

`Income → Expenses → Savings → Estimated Investable Surplus → FinSight Lab`

FinSight must not turn this flow into personalized investment advice.

## Portfolio & Backtesting

Portfolios are hypothetical and transaction-driven. Supported
transaction concepts include BUY, SELL, DIVIDEND, SPLIT, DEPOSIT,
WITHDRAWAL, and FEE. Multiple portfolios are supported, each with custom
name, base currency, benchmark, and optional target allocation.

Backtesting supports buy-and-hold and recurring/DCA approaches, then
expands to multiple assets, allocations, and configurable strategies.
Results include invested amount, final value, return, CAGR/XIRR as
appropriate, volatility, maximum drawdown, Sharpe, and benchmark
comparison.

## Tax & Cost Handling

Tax calculations are educational estimates, not legal/tax advice. The
tax engine is jurisdiction-agnostic, with India and US first, and uses
versioned/effective-dated rules. User tax residency/status is explicitly
configured when needed and is never inferred from IP address.

Fees/commission assumptions are explicit inputs and appear in return
attribution. Gross and net performance are shown separately.

## Insights & AI

The core Insights engine is rule-based and descriptive. Dashboard shows
2--3 high-value observations, with a dedicated Insights page for deeper
analysis. An optional LLM may explain already-computed metrics but must
never be the source of financial calculations or personalized buy/sell
recommendations.

## Accounts, Privacy & Security

Public market exploration remains available without login. Login is
required for saved simulations, portfolios, watchlists, personal
finance, personalized dashboard data, saved backtests, personal exports,
and settings.

Authentication supports email/password, Google OAuth, email
verification, password reset, JWT, and secure password hashing. 2FA is
architecturally extensible but not required now.

Personal financial data is user-scoped. Security includes HTTPS,
authorization middleware, validation, rate limiting, secure
headers/CORS, environment-based secrets, parameterized database access,
dependency/security checks, and audit-friendly authentication logs.

## Reports & Notifications

CSV and PDF exports are supported for relevant portfolio, FinSight Lab,
finance, and analytics data. Reports include assumptions, methodology,
source/freshness information, and relevant disclaimers.

Complex notifications/alerts are intentionally not part of the current
implementation infrastructure. The architecture remains extensible for
future watchlist, portfolio, budget, and goal alerts.

## Frontend & Visual System

React + Vite + TypeScript + Tailwind CSS + Lucide React + Apache
ECharts. TanStack Query is used for server state; Context is reserved
for lightweight global concerns such as auth/theme; local state handles
UI/forms.

The visual language is classy, elegant, luxurious, and
financial-terminal oriented. Use charcoal/black with champagne/gold
accents, warm off-white light mode, strong typography,
technical/monospace financial numbers, subtle borders, restrained
animation, and subtle cursor-following ambient lighting. Avoid neon
gradients, excessive glow, glassmorphism everywhere, generic
AI-dashboard aesthetics, pill-heavy layouts, and excessive animation.

Desktop uses a compact expandable sidebar + top bar. Mobile uses a top
bar + bottom navigation and purpose-built responsive layouts rather than
shrinking desktop layouts.

## Backend & Analytics

Backend is a layered Node.js/Express TypeScript application:

`Routes → Controllers → Services → Repositories → PostgreSQL`

API namespace is `/api/v1`. Responses use a consistent JSON envelope,
schemas validate request boundaries, and centralized error
handling/logging is required. Swagger/OpenAPI documents the API.

Python is a calculation engine invoked by Node for numerical/analytics
workloads. It uses pandas and NumPy initially and returns structured
JSON. FastAPI is not required initially.

## Operations & Deployment

Caching remains simple and PostgreSQL-backed/application-level; Redis is
not required initially. Lightweight scheduled jobs refresh
market/FX/fundamental/corporate-action data and clean stale cache where
useful. External failures follow retry → fallback provider → cached data
→ degraded-state response.

Preferred deployment: React/Vite frontend on Vercel Hobby;
Express/Python backend and PostgreSQL on genuinely free current
providers selected at deployment time. No paid API or paid hosting is
required for the core project. Docker, Kubernetes, microservices, and
complex queues are intentionally excluded initially.

GitHub Actions runs linting, builds, unit/integration/API tests,
security/dependency checks, and deployment checks.

## Quality

Testing is layered: unit, integration, API, and end-to-end. Financial
calculations receive dedicated known-value test cases for returns, CAGR,
XIRR, DCA, dividends, splits, FX, fees, taxes, volatility, Sharpe,
drawdown, beta, and backtesting. Accessibility includes keyboard
navigation, semantic HTML, screen-reader support, focus states,
contrast, and reduced motion. Performance uses lazy loading, code
splitting, pagination, caching, efficient database queries, and
chart-data aggregation.

## Development Principle

The complete agreed feature set is retained. Implementation may be
phased for practicality, but features are not removed merely because
they are not needed for the first coding milestone. Any genuinely new
ambiguity discovered during implementation should be documented as a new
decision rather than silently changing the existing scope.

------------------------------------------------------------------------

# Final Reconciliation --- September 9, 2026

This reconciliation section is authoritative wherever any earlier draft
wording in this document conflicts with it.

## Product and Architecture Reconciliation

-   **FinSight Lab** is the official name of the former Investment
    Simulator.
-   FinSight Lab contains exactly five entry modes:
    1.  Single Investment
    2.  Recurring Investment
    3.  Portfolio Scenario
    4.  Compare Scenarios
    5.  Backtest Strategy
-   Of those five modes, saved `scenarios` use only three scenario types:
    `SINGLE_INVESTMENT`, `RECURRING_INVESTMENT`, and
    `PORTFOLIO_SCENARIO`. `Compare Scenarios` operates on saved scenarios
    through `scenario_comparisons`, while `Backtest Strategy` operates
    through `backtests`/`backtest_results` and the shared backtesting
    engine.
-   **Analyze → Backtesting** and **FinSight Lab → Backtest Strategy**
    are two user-facing entry points into the **same shared backtesting
    engine**. Backtesting logic must not be duplicated.
-   Portfolios are hypothetical and **transaction-driven**. Portfolio
    investment activity is stored in a dedicated
    `portfolio_transactions` ledger. Personal-finance activity is stored
    separately as `finance_transactions`.
-   `portfolio_holdings` is derived/current-state data and is not the
    authoritative transaction history.
-   Portfolios support a benchmark relationship.
-   FinSight Lab uses a scenario model capable of single-asset,
    recurring-contribution, and multi-asset/allocation workflows.
-   `Compare Scenarios` compares saved FinSight Lab scenarios through a
    dedicated comparison relationship; it is not a separate scenario
    type.
-   `Backtest Strategy` uses the dedicated `backtests`/`backtest_results`
    model and the same shared backtesting engine as `Analyze →
    Backtesting`; it is not a separate scenario type.
-   For recurring portfolio contributions, contributions may target a
    specific scenario asset or, when no asset is specified, be allocated
    according to the scenario's defined target-allocation policy.
-   A null `scenario_asset_id` contribution is protected against duplicate
    `(scenario_id, contribution_date)` rows by a PostgreSQL partial unique
    index; the nullable column must not rely on a normal UNIQUE constraint
    alone.
-   All system/audit timestamps use `TIMESTAMPTZ`/UTC consistently across
    both legacy and newly reconciled tables; no final migration should leave
    a system timestamp as plain `TIMESTAMP`.
-   Simulation results must support initial investment, final value,
    absolute gain/loss, gross/net return, dividends, fees, estimated
    taxes, FX impact, CAGR, XIRR where applicable, volatility, Sharpe
    ratio, maximum drawdown, benchmark comparison, and return
    attribution.
-   Dashboard personalization is persistent user data and is stored
    through a dedicated `user_preferences` model rather than being
    improvised inside `users`.
-   The initial Stock Screener supports exchange, country, sector,
    market cap, price, P/E, EPS, dividend yield, revenue, profit, debt,
    52-week range, volume, RSI, and moving-average relationship, with
    filtering, AND-combination, sorting, pagination, reset, stock-detail
    navigation, and watchlist actions. Advanced custom formulas/saved
    screeners/alerts are later extensions.
-   Required database entities must have defined schemas before the
    relevant implementation phase: `users`, `user_preferences`,
    `exchanges`, `stocks`, `price_history`, `fundamentals`, `dividends`,
    `corporate_actions`, `exchange_rates`, `benchmarks`, `watchlists`,
    `watchlist_items`, `portfolios`, `portfolio_holdings`,
    `portfolio_transactions`, `scenarios`, scenario
    assets/contributions, `simulation_results`, `backtests`,
    `backtest_results`, `finance_transactions`, `budgets`,
    `savings_goals`, and `tax_rules`.
-   Dynamic historical/current FX is mandatory. Historical simulations
    use date-appropriate FX rates; current valuation uses the latest
    available rate and records source/freshness.
-   Tax calculations are educational estimates and must use
    versioned/effective-dated rules. Tax residency/status is explicitly
    configured and never inferred from IP.
-   Earlier draft statements such as "to be finalized later" are
    superseded by the locked decisions in this section and the final
    decision log.

# Development Status

-   [x] Product requirements finalized
-   [x] Feature scope finalized
-   [x] FinSight Lab naming finalized
-   [x] Market-data architecture finalized
-   [x] Dynamic FX/currency requirements finalized
-   [x] Database architecture finalized
-   [x] Backend/API architecture finalized
-   [x] Frontend architecture finalized
-   [x] Calculation methodology finalized
-   [x] Personal Finance finalized
-   [x] Authentication/privacy/security finalized
-   [x] Reports/notifications/jobs/caching finalized
-   [x] Deployment/CI-CD finalized
-   [x] Testing/accessibility/performance finalized
-   [ ] Implementation
-   [ ] Integration testing against real providers
-   [ ] Production deployment
