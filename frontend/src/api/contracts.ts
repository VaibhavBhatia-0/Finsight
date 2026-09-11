export type ApiId = string | number;

export interface User {
  id: string;
  email: string;
  name: string | null;
  baseCurrency: string;
  emailVerified: boolean;
}

export interface UserPreferences {
  id: ApiId;
  user_id: string;
  theme: 'dark' | 'light' | 'system';
  default_currency: string;
  default_benchmark_id: ApiId | null;
  dashboard_layout: { sections?: Array<{ id: string; order: number; visible: boolean }> };
  selected_market_indices: string[];
  watchlist_preferences: { sortBy?: 'symbol' | 'company_name' | 'added_at'; sortOrder?: 'asc' | 'desc' };
  tax_residency: 'IN' | 'US' | null;
  tax_status: string | null;
}

export interface AuthResponse {
  user: User;
  preferences: UserPreferences;
  token: string;
}

export interface ProfileResponse {
  user: User;
  preferences: UserPreferences;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  freshness: 'Synthetic';
  timestamp: string;
}

export interface MarketStock {
  id: ApiId;
  symbol: string;
  company_name: string;
  currency: string;
  sector: string | null;
  industry: string | null;
  exchange: string;
  exchange_code: string;
  country_code: string;
  quote: MarketQuote;
}

export interface MarketIndex {
  code: string;
  name: string;
  country: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  freshness: 'Synthetic';
  timestamp: string;
}

export interface MarketOverview {
  indices: MarketIndex[];
  india: MarketIndex[];
  us: MarketIndex[];
}

export interface StockFundamentals {
  marketCap: number;
  peRatio: number;
  eps: number;
  dividendYield: number;
  revenue: number;
  profit: number;
  totalDebt: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  rsi14: number;
  sma50: number;
  sma200: number;
}

export interface Dividend {
  id: ApiId;
  stock_id: ApiId;
  ex_date: string;
  payment_date: string | null;
  amount: number;
  currency: string;
}

export interface CorporateAction {
  id: ApiId;
  stock_id: ApiId;
  action_type: string;
  action_date: string;
  ratio: number | null;
  description: string | null;
}

export interface StockDetail {
  stock: Omit<MarketStock, 'quote'>;
  quote: MarketQuote;
  fundamentals: StockFundamentals;
  dividends: Dividend[];
  corporateActions: CorporateAction[];
}

export interface ScreenerStock {
  id: ApiId;
  symbol: string;
  name: string;
  exchange: string;
  exchangeCode: string;
  countryCode: string;
  currency: string;
  sector: string | null;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  eps: number;
  dividendYield: number;
  revenue: number;
  profit: number;
  debt: number;
  rsi14: number;
  sma50: number;
  sma200: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  yearPosition: number;
}

export interface ScreenerResponse {
  items: ScreenerStock[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface WatchlistItem {
  watchlist_id: ApiId;
  stock_id: ApiId;
  added_at: string;
  symbol: string;
  company_name: string;
  currency: string;
  sector: string | null;
  exchange_code: string;
  country_code: string;
  quote: MarketQuote;
}

export interface Watchlist {
  id: ApiId;
  user_id: string;
  name: string;
  created_at: string;
  items: WatchlistItem[];
}

export interface PortfolioHolding {
  stockId: ApiId;
  symbol: string;
  companyName: string;
  sector: string | null;
  exchange: string;
  assetCurrency: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currentPriceBase: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  dailyChangePct: number;
  weight: number;
}

export interface PortfolioValuation {
  portfolio: {
    id: ApiId;
    name: string;
    baseCurrency: string;
    benchmarkCode: string | null;
    benchmarkName: string | null;
    createdAt: string;
  };
  summary: {
    totalValue: number;
    cashBalance: number;
    holdingsValue: number;
    costBasis: number;
    totalInvested: number;
    unrealizedPnL: number;
    realizedPnL: number;
    totalReturnAmount: number;
    totalReturnPercentage: number;
    dividendsEarned: number;
    feesPaid: number;
  };
  holdings: PortfolioHolding[];
  risk: {
    volatility: number | null;
    sharpeRatio: number | null;
    maxDrawdown: number | null;
    beta: number | null;
    status: string;
  };
}

export type PortfolioTransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE';

export interface PortfolioTransactionRow {
  id: ApiId;
  portfolio_id: ApiId;
  stock_id: ApiId | null;
  transaction_type: PortfolioTransactionType;
  transaction_date: string;
  quantity: number | string | null;
  price: number | string | null;
  amount: number | string;
  currency: string;
  fee_amount: number | string;
  fx_rate: number | string | null;
  notes: string | null;
  symbol?: string | null;
  company_name?: string | null;
}

export interface PortfolioTransactionRequest {
  stockId?: ApiId;
  transactionType: PortfolioTransactionType;
  transactionDate: string;
  quantity?: number;
  price?: number;
  amount: number;
  currency: string;
  feeAmount?: number;
  fxRate?: number;
  notes?: string;
}

export interface PortfolioTransactionResponse {
  transaction: PortfolioTransactionRow;
  valuation: PortfolioValuation;
}

export interface ScenarioAssetInput {
  stockId?: ApiId;
  symbol?: string;
  weight: number;
}

export interface ScenarioRequest {
  scenarioType: 'SINGLE_INVESTMENT' | 'RECURRING_INVESTMENT' | 'PORTFOLIO_SCENARIO';
  stockId?: ApiId;
  symbol?: string;
  assets?: ScenarioAssetInput[];
  name?: string;
  startDate: string;
  endDate: string;
  initialAmount: number;
  baseCurrency: string;
  benchmarkCode?: string;
  taxRuleId?: ApiId;
  taxJurisdiction?: 'IN' | 'US';
  feeRate?: number;
  contributionFrequency?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
}

export interface ScenarioResult {
  mode: ScenarioRequest['scenarioType'];
  stock?: { id: ApiId; symbol: string; name: string; currency: string };
  assets?: Array<{ id: ApiId; symbol: string; name: string; currency: string; weight: number }>;
  details: Record<string, string | number>;
  financials: Record<string, number>;
  attribution: Record<string, number>;
  risk_metrics: Record<string, number | null>;
  assumptions: string[];
  contributions?: Array<Record<string, string | number>>;
  taxMethodology?: {
    applied: boolean;
    ruleId: ApiId | null;
    jurisdiction: 'IN' | 'US' | null;
    taxType: string | null;
    rate: number;
    exemptionAmount: number;
    holdingPeriodDays: number;
    sourceReference: string | null;
    methodology: 'NO_TAX_JURISDICTION_SELECTED' | 'EFFECTIVE_DATE_AND_HOLDING_PERIOD';
    disclaimer: string;
  };
  assetResults?: Array<{ symbol: string; weight: number; result: Omit<ScenarioResult, 'assets' | 'assetResults'> }>;
}

export interface SavedScenario {
  id: ApiId;
  name: string;
  scenario_type: ScenarioRequest['scenarioType'];
  base_currency: string;
  start_date: string;
  end_date: string;
  initial_amount: number | string;
  final_value: number | string | null;
  net_profit: number | string | null;
  return_percentage: number | string | null;
  created_at: string;
}

export interface ScenarioComparisonResponse {
  comparisons: SavedScenario[];
  metrics: Array<{
    scenarioId: ApiId;
    name: string;
    scenarioType: ScenarioRequest['scenarioType'];
    currency: string;
    finalValue: number | null;
    netProfit: number | null;
    returnPercentage: number | null;
    cagr: number | null;
    xirr: number | null;
    volatility: number | null;
    sharpeRatio: number | null;
    maxDrawdown: number | null;
  }>;
  normalization: {
    basis: 'PERCENTAGE_METRICS';
    currencies: string[];
    absoluteValuesComparable: boolean;
  };
}

export interface BacktestRequest {
  portfolioId: number;
  initialAmount: number;
  startDate: string;
  endDate: string;
  name?: string;
  strategyType?: 'BUY_AND_HOLD';
}

export interface BacktestResult {
  id: string;
  status: 'completed';
  createdAt: string;
  completedAt: string;
  summary: {
    totalInvested: number;
    finalValue: number;
    absoluteReturn: number;
    returnPercentage: number;
    cagr: number | null;
    volatility: number | null;
    maxDrawdown: number | null;
    sharpeRatio: number | null;
  };
  details: {
    timeSeries: Array<{ date: string; value: number }>;
    strategyType: 'BUY_AND_HOLD';
  };
}

export interface FinanceTransactionRow {
  id: ApiId;
  transaction_type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string;
  amount: number | string;
  currency: string;
  description: string | null;
  transaction_date: string;
  recurring: boolean;
  notes: string | null;
  recurring_rule_id: ApiId | null;
}

export interface FinanceTransactionRequest {
  transactionType: FinanceTransactionRow['transaction_type'];
  category: string;
  amount: number;
  currency: string;
  description?: string;
  transactionDate: string;
  notes?: string;
}

export interface FinanceRecurringRule {
  id: ApiId;
  transaction_type: FinanceTransactionRow['transaction_type'];
  category: string;
  amount: number | string;
  currency: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  active: boolean;
  notes: string | null;
}

export interface FinanceRecurringRuleRequest {
  transactionType: FinanceTransactionRow['transaction_type'];
  category: string;
  amount: number;
  currency: string;
  description?: string;
  startDate: string;
  endDate?: string;
  frequency: FinanceRecurringRule['frequency'];
  notes?: string;
}

export interface BudgetRow {
  id: ApiId;
  category: string;
  amount: number | string;
  start_date: string;
  end_date: string;
}

export interface GoalRow {
  id: ApiId;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  target_date: string | null;
}

export interface FinanceSummary {
  currency: string;
  calculation: {
    method: 'HISTORICAL_TRANSACTION_DATE_FX';
    hasSyntheticFx: boolean;
  };
  overview: {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRate: number;
    estimatedInvestableSurplus: number;
  };
  categoryBreakdown: Record<string, number>;
  budgets: Array<{
    id: string;
    category: string;
    budgetAmount: number;
    spentAmount: number;
    remainingAmount: number;
    spentPercentage: number;
    isExceeded: boolean;
    startDate: string;
    endDate: string;
  }>;
  goals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    remainingAmount: number;
    progressPercentage: number;
    targetDate: string | null;
    monthlyContributionRate: number;
    monthsToGoal: number | null;
    projectedCompletionDate: string | null;
    requiredMonthlyContribution: number | null;
  }>;
}

export interface Insight {
  id: string;
  category: 'CASH_FLOW' | 'BUDGET' | 'GOAL' | 'PORTFOLIO';
  severity: 'positive' | 'warning' | 'info';
  title: string;
  message: string;
  basis: 'LEDGER' | 'SYNTHETIC_MARKET_DATA';
  metric?: { label: string; value: number; unit: string };
}

export interface InsightsResponse {
  currency: string;
  calculation: {
    method: 'DETERMINISTIC_RULES';
    usesSyntheticMarketData: boolean;
    hasSyntheticFx: boolean;
  };
  insights: Insight[];
}
