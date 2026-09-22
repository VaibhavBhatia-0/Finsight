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
  providerSymbol: string;
  provider: string;
  exchange: string;
  currency: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketTimestamp: string;
  timestamp: string;
  fetchedAt: string;
  freshnessSeconds: number;
  freshnessLabel: MarketFreshness;
  freshness: MarketFreshness;
  marketStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  isDelayed: boolean;
  isStale: boolean;
  source: string;
}

export type MarketFreshness = 'LIVE' | 'DELAYED' | 'LAST CLOSE' | 'STALE' | 'UNAVAILABLE' | 'SYNTHETIC';

export interface MarketStock {
  id: ApiId;
  symbol: string;
  company_name: string;
  currency: string;
  sector: string | null;
  industry: string | null;
  display_symbol: string;
  provider_symbol: string;
  asset_type: string;
  exchange: string;
  exchange_code: string;
  country_code: string;
  quote: MarketQuote | null;
  quoteError?: 'UNAVAILABLE';
}

export interface MarketStocksResponse {
  items: MarketStock[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface SecuritySearchItem {
  id: ApiId;
  symbol: string;
  display_symbol?: string;
  provider_symbol?: string;
  displaySymbol?: string;
  providerSymbol?: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  asset_type?: string;
  assetType?: string;
}

export interface SecuritySearchResponse {
  items: SecuritySearchItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface SecurityQuoteResponse { security: SecuritySearchItem; quote: MarketQuote }
export interface HistoricalPriceResponse {
  security: SecuritySearchItem; requestedDate: string; priceDate: string; price: number; currency: string;
  source: string; methodology: string;
}

export interface TechnicalPoint {
  date: string; close: number; volume: number;
  sma20: number | null; sma50: number | null; sma200: number | null; ema20: number | null; rsi14: number | null;
  macd: number | null; macdSignal: number | null; macdHistogram: number | null;
  bollingerUpper: number | null; bollingerMiddle: number | null; bollingerLower: number | null;
}
export interface TechnicalAnalysisResponse {
  security: SecuritySearchItem; period: string; provider: string; fetchedAt: string; series: TechnicalPoint[];
  summary: null | Omit<TechnicalPoint, 'date' | 'close' | 'volume' | 'bollingerUpper' | 'bollingerMiddle' | 'bollingerLower'> & { asOfDate: string; volatility: number | null; maxDrawdown: number | null };
  methodology: string;
}

export interface MarketComparisonResponse {
  securities: Array<{
    security: SecuritySearchItem & { sector: string | null };
    quote: MarketQuote | null; fundamentals: StockFundamentals;
    performance: Record<'1D' | '5D' | '1M' | 'YTD' | '1Y' | '5Y' | 'MAX', number | null>;
    risk: { volatility: number | null; maxDrawdown: number | null };
    technicals: TechnicalAnalysisResponse['summary'];
    normalizedSeries: Array<{ date: string; value: number }>;
    availability: { quote: string; fundamentals: string; history: string };
  }>;
  methodology: string;
}

export interface MarketIndex {
  code: string;
  name: string;
  country: string;
  currency: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  freshness: MarketFreshness;
  freshnessLabel: MarketFreshness;
  marketTimestamp: string;
  timestamp: string;
  fetchedAt: string;
  marketStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  isDelayed: boolean;
  isStale: boolean;
  provider: string;
  source: string;
}

export interface MarketOverview {
  indices: MarketIndex[];
  india: MarketIndex[];
  us: MarketIndex[];
}

export interface StockFundamentals {
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  revenue: number | null;
  profit: number | null;
  totalDebt: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  source: string;
  retrievedAt: string;
}

export interface MarketPriceBar { date: string; open: number; high: number; low: number; close: number; adjusted_close?: number; volume: number }
export interface MarketHistory { symbol: string; provider: string; currency: string; exchange: string; interval: string; range: string; fetchedAt: string; adjusted: boolean; bars: MarketPriceBar[]; events: Array<{ type: 'DIVIDEND' | 'SPLIT'; date: string; amount: number | null; ratio: number | null; currency: string; source: string }> }

export interface Dividend {
  id: ApiId;
  stock_id: ApiId;
  ex_date: string;
  payment_date: string | null;
  amount: number;
  currency: string;
  source?: string;
}

export interface CorporateAction {
  id: ApiId;
  stock_id: ApiId;
  action_type: string;
  action_date: string;
  ratio: number | null;
  description: string | null;
  source?: string;
}

export interface StockDetail {
  stock: Omit<MarketStock, 'quote' | 'quoteError'>;
  quote: MarketQuote;
  fundamentals: StockFundamentals;
  dividends: Dividend[];
  corporateActions: CorporateAction[];
  eventAvailability?: { dividends: string; splits: string; earnings: string };
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
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  revenue: number | null;
  profit: number | null;
  debt: number | null;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  yearPosition: number | null;
  volatility: number | null;
  quote: MarketQuote | null;
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
  quote: MarketQuote | null;
  quoteError?: 'UNAVAILABLE';
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
    allocationTargets: Record<string, number>;
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
    taxesPaid: number;
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

export type PortfolioTransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'TAX';

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

export interface PortfolioTransactionPreview {
  security: { id: ApiId; symbol: string; providerSymbol: string; name: string; exchange: string };
  transactionType: 'BUY' | 'SELL'; transactionDate: string; quantity: number; price: number;
  assetCurrency: string; gross: number; fee: number; totalAssetCurrency: number;
  portfolioCurrency: string; fxRate: number; fxRateDate: string; fxSource: string; portfolioCashImpact: number; methodology: string;
}

export type MarketAlertCondition = 'PRICE_ABOVE' | 'PRICE_BELOW' | 'DAILY_CHANGE_ABOVE' | 'DAILY_CHANGE_BELOW' | 'RSI_ABOVE' | 'RSI_BELOW';
export interface MarketAlert {
  id: ApiId; stock_id: ApiId; condition: MarketAlertCondition; threshold: number | string; enabled: boolean;
  triggered_at: string | null; created_at: string; updated_at: string;
  symbol: string; display_symbol: string; provider_symbol: string; company_name: string; currency: string; exchange_code: string; country_code: string;
}

export interface PortfolioBenchmark {
  id: ApiId;
  code: 'NIFTY_50' | 'SENSEX' | 'SP500' | 'NASDAQ_COMP';
  name: string;
  currency: string;
  exchange: string;
}

export interface PortfolioIntelligence {
  portfolio: {
    id: ApiId;
    name: string;
    baseCurrency: string;
    benchmarkId: ApiId | null;
    benchmarkCode: string | null;
    benchmarkName: string | null;
    allocationTargets: Record<string, number>;
  };
  status: 'AVAILABLE' | 'INSUFFICIENT_DATA';
  reason?: string;
  asOfDate?: string;
  performance: null | {
    startDate: string | null;
    endDate: string | null;
    currentValue: number;
    netContributions: number;
    netPnl: number;
    portfolioReturn: number | null;
    portfolioCagr: number | null;
    xirr: number | null;
    benchmark: { code: string; name: string } | null;
    benchmarkReturn: number | null;
    benchmarkCagr: number | null;
    absoluteDifference: number | null;
    cagrDifference: number | null;
    series: Array<{ date: string; portfolioValue: number | null; portfolioNormalized: number; benchmarkNormalized: number | null }>;
    methodology: string;
  };
  risk: {
    status: 'AVAILABLE' | 'INSUFFICIENT_HISTORICAL_DATA';
    observations?: number;
    volatility?: number | null;
    sharpeRatio?: number | null;
    maxDrawdown?: number | null;
    beta?: number | null;
    correlation?: number | null;
    downsideObservations?: number | null;
    downsidePercentage?: number | null;
    riskContribution?: Array<{ symbol: string; percentage: number | null }>;
    concentration?: { herfindahlIndex: number; largestHoldingPercentage: number; holdingCount: number };
  };
  allocation: {
    holdings: Array<{
      stockId: ApiId | null; symbol: string; name: string; sector: string | null; geography: string | null;
      currency: string; assetClass: string; quantity: number | null; price: number | null; fxRate: number;
      value: number; percentage: number; targetPercentage: number | null; targetDifference: number | null;
    }>;
    assetClasses: PortfolioExposure[];
    sectors: PortfolioExposure[];
    geographies: PortfolioExposure[];
    currencies: PortfolioExposure[];
    cash: { value: number; percentage: number };
  };
  attribution: {
    holdings: Array<{ stockId: ApiId | null; symbol: string; priceReturn: number; dividends: number; fxImpact: number; fees: number; taxes: number; netContribution: number }>;
    totals: { priceReturn: number; dividends: number; fxImpact: number; fees: number; taxes: number; netPnl: number; reconciliationDifference: number };
    invariant: string;
  };
  dataQuality?: { historicalObservations: number; benchmarkObservations: number; missingSectorCount: number; source: string };
  methodology?: Record<string, string>;
}

export interface PortfolioExposure { label: string; value: number; percentage: number }

export interface PortfolioComparison {
  portfolios: Array<Pick<PortfolioIntelligence, 'portfolio' | 'performance' | 'risk' | 'allocation'> & {
    contributionHistory: Array<{
      date: string;
      type: 'DEPOSIT' | 'WITHDRAWAL';
      currency: string;
      amount: number;
      baseCurrency: string;
      baseAmount: number;
    }>;
  }>;
  synchronizedPeriod: { startDate: string | null; endDate: string | null };
  comparisonSeries: Array<{ portfolioId: ApiId; name: string; values: Array<{ date: string; value: number }> }>;
  compatibility: {
    currencies: string[]; benchmarks: string[]; sameCurrency: boolean; sameBenchmark: boolean;
    differentStartDates: boolean; note: string;
  };
}

export interface RequiredContributionResult {
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  contributionCount: number;
  contributionDates: string[];
  noGrowth: { requiredContribution: number; totalContributions: number; estimatedGrowth: number };
  growthAssumption: null | { assumedAnnualReturn: number; requiredContribution: number; totalContributions: number; estimatedGrowth: number; disclaimer: string };
}

export interface PlanningSimulationResponse {
  hypothetical?: boolean;
  historicalReplay?: boolean;
  result: ScenarioResult;
  baseline?: ScenarioResult | null;
  comparison?: { finalValueDifference: number; contributionDifference: number } | null;
  disclaimer: string;
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
  contributionFrequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  contributionGrowthRate?: number;
  portfolioRecurring?: boolean;
}

export interface ScenarioResult {
  mode: ScenarioRequest['scenarioType'];
  baseCurrency?: string;
  stock?: { id: ApiId; symbol: string; name: string; currency: string };
  assets?: Array<{ id: ApiId; symbol: string; name: string; currency: string; weight: number }>;
  details: Record<string, string | number>;
  financials: Record<string, number>;
  attribution: Record<string, number>;
  risk_metrics: Record<string, number | null>;
  assumptions: string[];
  performance_series?: Array<{ date: string; value: number }>;
  provenance?: {
    marketDataSource: string;
    dataRange: { start: string; end: string };
    retrievedAt: string;
    fxSource: string;
    corporateActionMethodology: string;
    feeMethodology: string;
    taxMethodology: string;
  };
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
  benchmarkSymbol?: '^NSEI' | '^BSESN' | '^GSPC' | '^IXIC';
  feeRate?: number;
  fixedFee?: number;
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
    xirr: number | null;
    benchmarkReturn: number | null;
    benchmarkCagr: number | null;
    benchmarkDifference: number | null;
    relativePerformance: number | null;
    feesPaid: number;
    grossFinalValue: number;
  };
  details: {
    timeSeries: Array<{ date: string; value: number; strategy_value: number; benchmark_value: number | null }>;
    strategyType: 'BUY_AND_HOLD';
    benchmarkSymbol: string | null;
    feeRate: number;
    fixedFee: number;
    attribution: { gross_market_profit?: number; fee_impact?: number; net_profit?: number };
    methodology: string;
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
  base_currency: string;
  portfolio_id: ApiId | null;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
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
    baseCurrency: string;
    linkedPortfolioId: ApiId | null;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
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
