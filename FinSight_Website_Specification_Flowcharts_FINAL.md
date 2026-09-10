# FinSight --- Website Specification & Flowcharts

> **Source-of-truth rule:** The latest locked/final reconciliation
> sections in this document supersede earlier draft flowcharts where
> they conflict.

## 1. High-Level Website Specification

``` text
                         ┌───────────────────────┐
                         │       FinSight        │
                         │ Financial Intelligence│
                         └───────────┬───────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                   │                   │
                 ▼                   ▼                   ▼
        ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐
        │ Market         │  │ Portfolio      │  │ Personal        │
        │ Intelligence   │  │ Intelligence   │  │ Finance         │
        └───────┬────────┘  └───────┬────────┘  └───────┬─────────┘
                │                   │                   │
                ▼                   ▼                   ▼
        Stock/watchlist      Simulated holdings    Expenses/budgets
        Historical data      Performance           Savings
        Analytics            Risk metrics           Financial summary
                │                   │                   │
                └───────────────────┼───────────────────┘
                                    ▼
                         ┌────────────────────┐
                         │ Investment         │
                         │ Simulator          │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Return Attribution │
                         │ Currency / Tax /   │
                         │ Fees / Dividends   │
                         └────────────────────┘
```

## 2. Main Navigation

``` text
Login / Register
       │
       ▼
   Dashboard
       │
 ┌─────┼──────────┬──────────────┬─────────────┐
 ▼     ▼          ▼              ▼             ▼
Markets Watchlist Portfolio   FinSight Lab  Finance
 │       │          │              │             │
 ▼       ▼          ▼              ▼             ▼
Search  Saved    Holdings      Scenario      Expenses
Charts  Stocks   Analytics     Analysis      Budgets
Data             Risk          Backtest       Savings
```

## 3. Dashboard Specification

``` text
Dashboard
   │
   ├── Portfolio Summary
   │     ├── Simulated Value
   │     ├── Return
   │     ├── CAGR
   │     └── Risk
   │
   ├── Watchlist
   │     ├── Price
   │     ├── Daily Change
   │     └── Mini Charts
   │
   ├── Market Overview
   │     ├── Trends
   │     └── Benchmarks
   │
   ├── Financial Summary
   │     ├── Expenses
   │     ├── Budget
   │     └── Savings
   │
   └── FinSight Insights
         ├── Portfolio insights
         ├── Risk observations
         └── Financial observations
```

## 4. FinSight Lab Website Flow

``` text
User opens FinSight Lab
        ↓
Select Stock
        ↓
Select Buy Date
        ↓
Select Sell Date
        ↓
Enter Investment Amount
        ↓
Select Currency
        ↓
Run Simulation
        ↓
Historical Market Data
        ↓
Calculate Shares
        ↓
Calculate Gross Value
        ↓
Apply Dividends / Corporate Actions
        ↓
Apply Currency Conversion
        ↓
Estimate Fees / Taxes
        ↓
Calculate Net Value
        ↓
Display Results
        ↓
┌────────────────────────────────────┐
│ Summary                            │
│ Gross Return                       │
│ Net Return                         │
│ CAGR                               │
│ Volatility                         │
│ Maximum Drawdown                   │
└────────────────────────────────────┘
        ↓
Return Attribution Chart
```

## 5. Portfolio Flow

``` text
Create Portfolio
       ↓
Add Asset
       ↓
Choose Allocation / Amount
       ↓
Fetch Historical / Current Data
       ↓
Calculate Position Value
       ↓
Aggregate Positions
       ↓
Portfolio Analytics
       ├── Return
       ├── CAGR
       ├── Volatility
       ├── Sharpe
       ├── Drawdown
       ├── Beta
       └── Correlation
       ↓
Risk / Diversification Insights
```

## 6. User Journey

``` text
Landing Page
    ↓
Register / Login
    ↓
Set Up Profile
    ↓
Add Stocks to Watchlist
    ↓
Explore Market Data
    ↓
Create Hypothetical Portfolio
    ↓
Run Investment Simulation
    ↓
Analyze Net Return
    ↓
Understand Risk & Attribution
    ↓
Compare Alternatives
    ↓
Save Simulation / Portfolio
```

## 7. Responsive Layout

``` text
                 FinSight Web App
                       │
              ┌────────┴────────┐
              │                 │
           Desktop            Mobile
              │                 │
        Sidebar/Nav        Bottom Nav / Menu
              │                 │
        Multi-column         Single-column
        dashboards            cards/charts
              │                 │
              └────────┬────────┘
                       ▼
                Same backend/API
```

------------------------------------------------------------------------

# FinSight --- How the System Works

## 1. End-to-End Data Flow

``` text
                    External Market APIs
                           │
                           ▼
                  ┌─────────────────┐
                  │ Data Ingestion   │
                  │ / Validation     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ PostgreSQL      │
                  │ Historical Data │
                  └────────┬────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
      Node/Express APIs          Python Analytics
              │                         │
              │                         ▼
              │                  Analytics Results
              │                         │
              └────────────┬────────────┘
                           ▼
                    React Frontend
                           │
                           ▼
                      User UI
```

## 2. Investment Calculation Pipeline

``` text
User Inputs
    │
    ├── Stock
    ├── Buy Date
    ├── Sell Date
    ├── Investment
    └── Currency
    │
    ▼
Validate Inputs
    ↓
Retrieve Historical Prices
    ↓
Retrieve Exchange Rates
    ↓
Retrieve Dividends / Corporate Actions
    ↓
Calculate Hypothetical Shares
    ↓
Calculate Gross Proceeds
    ↓
Calculate Stock Return
    ↓
Calculate Currency Effect
    ↓
Calculate Dividends
    ↓
Calculate Transaction Costs
    ↓
Estimate Applicable Taxes
    ↓
Calculate Net Proceeds
    ↓
Calculate Analytics
    ├── Absolute Return
    ├── Percentage Return
    ├── CAGR
    ├── Volatility
    ├── Drawdown
    └── Risk Metrics
    ↓
Return Structured Result
    ↓
React Visualization
```

## 3. Personal Finance Flow

``` text
User
 ↓
Add Income / Expense
 ↓
Categorize Transaction
 ↓
Store in PostgreSQL
 ↓
Aggregate by:
   ├── Day
   ├── Month
   ├── Category
   └── Budget
 ↓
Python Analytics
 ↓
Spending / Savings Metrics
 ↓
Dashboard
 ↓
Financial Insights
```

## 4. Backtesting Flow --- Future

``` text
User selects strategy
        ↓
Select asset(s)
        ↓
Select historical period
        ↓
Select investment amount/frequency
        ↓
Historical data
        ↓
Strategy engine
        ↓
Simulate each period
        ↓
Generate portfolio time series
        ↓
Calculate metrics
        ↓
Compare against benchmark
        ↓
Visualize results
```

# Final Website & UX Decisions --- Locked

## Navigation

``` text
Dashboard

INVEST
├── Markets
├── Watchlist
├── Portfolios
├── FinSight Lab
└── Stock Screener

FINANCE
├── Expenses
├── Budgets
├── Savings
└── Goals

ANALYZE
├── Insights
└── Backtesting

SYSTEM
└── Settings
```

Desktop uses a compact expandable sidebar + top bar. Mobile uses a top
bar + bottom navigation.

## Dashboard

The dashboard balances portfolio intelligence, markets, FinSight Lab,
watchlists, insights, and quick actions. Users can choose visible
sections, reorder them, select default benchmarks, add/remove market
indices, and personalize their watchlist.

## Stock Detail

``` text
Stock Header
  ↓
Price + Change
  ↓
Interactive ECharts price/performance chart
  ↓
Technical Indicators
  ↓
Fundamentals
  ↓
Historical Performance
  ↓
Dividends
  ↓
Corporate Actions
  ↓
Benchmark Comparison
  ↓
Simulate / Open in FinSight Lab
```

Technical indicators include moving averages, RSI, MACD, and Bollinger
Bands, with extensibility for future configurable indicators.

## FinSight Lab

``` text
FinSight Lab
├── Single Investment
├── Recurring Investment
├── Portfolio Scenario
├── Compare Scenarios
└── Backtest Strategy
```

Results visibly separate asset performance from FX impact, dividends,
fees, taxes, and benchmark performance. Include expandable Assumptions &
Methodology and source/freshness information.

## Personal Finance

Expenses, Budgets, Savings, and Goals live under the authenticated
user's Finance area. Expense tracking is profile/account data. Budgets
compare planned versus actual spending. Goals show progress and
projected completion. Finance can expose estimated investable surplus as
an input to FinSight Lab without providing investment recommendations.

## Visual System

-   Classy, elegant, luxurious, financial-terminal quality.
-   Charcoal/black dark foundation.
-   Champagne/gold accent.
-   Warm off-white light mode.
-   Red/green primarily for financial movement.
-   Strong typography, generous spacing, technical/monospace financial
    numbers.
-   Solid cards with selective transparency.
-   Subtle cursor-following ambient lighting.
-   Restrained hover/page transitions.

Avoid neon purple/blue gradients, excessive glow, giant gradient blobs,
glassmorphism everywhere, floating abstract shapes, generic AI-dashboard
styling, excessive animation, and pill-heavy layouts.

## Data States

Tables support sorting/filtering/pagination, column customization,
export, and responsive transformation. Loading uses skeletons and
cached/previous data where safe. Errors provide retry, cached-data
messaging, timestamp/source, and degraded-service state.

Market and FX displays must show freshness accurately: Live, Delayed,
End-of-day, or Historical.

# Final UX Reconciliation --- September 9, 2026

This section is authoritative where earlier flowcharts use older
terminology or omit newly locked flows.

## Navigation --- Locked

``` text
Dashboard

INVEST
├── Markets
├── Watchlist
├── Portfolios
├── FinSight Lab
└── Stock Screener

FINANCE
├── Expenses
├── Budgets
├── Savings
└── Goals

ANALYZE
├── Insights
└── Backtesting

SYSTEM
└── Settings
```

## FinSight Lab --- Locked User Flows

``` text
FinSight Lab
├── Single Investment
│   └── one asset + lump sum + historical period
├── Recurring Investment
│   └── asset(s) + contribution amount/frequency + historical period
├── Portfolio Scenario
│   └── multiple assets + allocations + contributions + rebalancing assumptions where supported
├── Compare Scenarios
│   └── select saved scenarios → shared comparison analytics
└── Backtest Strategy
    └── select strategy → shared Backtesting Engine
```

The `Backtest Strategy` tab and the standalone `Analyze → Backtesting`
page use the **same backend service and Python analytics engine**. They
are different presentation/entry points, not duplicated implementations.
The persisted backtest configuration/results use `backtests` and
`backtest_results`; `BACKTEST_STRATEGY` is not a `scenarios.scenario_type`.

`Compare Scenarios` selects and compares existing saved FinSight Lab
scenarios through `scenario_comparisons`; it does not create a separate
comparison scenario type.

The persisted FinSight Lab scenario types are limited to Single Investment,
Recurring Investment, and Portfolio Scenario. Backtest Strategy is persisted
through the dedicated backtest model rather than as a scenario type.

## Dashboard Personalization

Users may persist: - visible dashboard sections - section order -
default benchmark - selected market indices - watchlist display
preferences - theme/default currency preferences

These preferences are backed by the dedicated `user_preferences` model.

For recurring Portfolio Scenario contributions, the user may target a
specific asset or leave the asset unspecified so the contribution is
allocated according to the scenario's target-allocation policy.
The database must enforce duplicate protection for unspecified-asset
contributions with a partial unique index on `(scenario_id,
contribution_date)` where `scenario_asset_id IS NULL`. System timestamps
use `TIMESTAMPTZ`/UTC consistently across the final schema.

## Stock Screener --- Initial UX Scope

``` text
Screener
  ↓
Filter by exchange / country / sector / market cap / price
  ↓
Filter by P/E / EPS / dividend yield / revenue / profit / debt
  ↓
Filter by 52-week range / volume / RSI / moving-average relationship
  ↓
AND-combine filters
  ↓
Sort + paginate
  ↓
Open Stock Detail OR Add to Watchlist
```

Advanced custom formulas, saved screeners, alerts, and complex filter
groups are later extensions.

## Portfolio UX

Portfolio activity is represented as an investment transaction ledger:
`BUY | SELL | DIVIDEND | SPLIT | DEPOSIT | WITHDRAWAL | FEE`.

The UI may show current holdings, but transaction history is the
authoritative source from which portfolio state/analytics are derived.

## Data Freshness

Every market/FX view that uses external data must visibly distinguish:
`Live | Delayed | End-of-day | Historical`.

Show source and timestamp where relevant, especially in FinSight Lab
Assumptions & Methodology and reports.
