import type { ApiId } from './contracts';

const pathId = (id: ApiId) => encodeURIComponent(String(id));

export const endpoints = {
  auth: {
    login: '/api/v1/auth/login',
    logout: '/api/v1/auth/logout',
    register: '/api/v1/auth/register',
    me: '/api/v1/auth/me',
    preferences: '/api/v1/auth/preferences',
    requestVerification: '/api/v1/auth/verification/request',
    confirmVerification: '/api/v1/auth/verification/confirm',
    requestPasswordReset: '/api/v1/auth/password-reset/request',
    confirmPasswordReset: '/api/v1/auth/password-reset/confirm',
    google: '/api/v1/auth/google',
  },
  markets: {
    overview: '/api/v1/markets/overview',
    health: '/api/v1/markets/health',
    stocks: '/api/v1/markets/stocks',
    stock: (idOrSymbol: ApiId) => `/api/v1/markets/stocks/${pathId(idOrSymbol)}`,
    stockPrices: (id: ApiId) => `/api/v1/markets/stocks/${pathId(id)}/prices`,
    screener: '/api/v1/markets/screener',
    fx: '/api/v1/markets/fx',
    securitySearch: '/api/v1/markets/securities/search',
    universeStats: '/api/v1/markets/securities/stats',
    securityQuote: (id: ApiId) => `/api/v1/markets/securities/${pathId(id)}/quote`,
    historicalPrice: (id: ApiId) => `/api/v1/markets/securities/${pathId(id)}/historical-price`,
    technicals: (id: ApiId) => `/api/v1/markets/securities/${pathId(id)}/technicals`,
    compare: '/api/v1/markets/compare',
  },
  watchlists: {
    list: '/api/v1/watchlists',
    create: '/api/v1/watchlists',
    items: (watchlistId: ApiId) => `/api/v1/watchlists/${pathId(watchlistId)}/items`,
    item: (watchlistId: ApiId, stockId: ApiId) =>
      `/api/v1/watchlists/${pathId(watchlistId)}/items/${pathId(stockId)}`,
  },
  portfolios: {
    list: '/api/v1/portfolios',
    create: '/api/v1/portfolios',
    detail: (portfolioId: ApiId) => `/api/v1/portfolios/${pathId(portfolioId)}`,
    transactions: (portfolioId: ApiId) => `/api/v1/portfolios/${pathId(portfolioId)}/transactions`,
    intelligence: (portfolioId: ApiId) => `/api/v1/portfolios/${pathId(portfolioId)}/intelligence`,
    benchmarks: '/api/v1/portfolios/benchmarks',
    compare: '/api/v1/portfolios/compare',
    transactionPreview: (portfolioId: ApiId) => `/api/v1/portfolios/${pathId(portfolioId)}/transaction-preview`,
  },
  alerts: {
    list: '/api/v1/alerts',
    create: '/api/v1/alerts',
    detail: (id: ApiId) => `/api/v1/alerts/${pathId(id)}`,
  },
  planning: {
    requiredContribution: '/api/v1/planning/required-contribution',
    whatIf: '/api/v1/planning/what-if',
    replay: '/api/v1/planning/replay',
    recurring: '/api/v1/planning/recurring',
  },
  scenarios: {
    simulate: '/api/v1/scenarios/simulate',
    list: '/api/v1/scenarios',
    save: '/api/v1/scenarios',
    compare: '/api/v1/scenarios/compare',
    detail: (scenarioId: ApiId) => `/api/v1/scenarios/${pathId(scenarioId)}`,
  },
  backtests: {
    list: '/api/v1/backtests',
    run: '/api/v1/backtests',
    detail: (backtestId: ApiId) => `/api/v1/backtests/${pathId(backtestId)}`,
  },
  finance: {
    transactions: '/api/v1/finance/transactions',
    transaction: (transactionId: ApiId) => `/api/v1/finance/transactions/${pathId(transactionId)}`,
    recurringRules: '/api/v1/finance/recurring-rules',
    recurringRule: (ruleId: ApiId) => `/api/v1/finance/recurring-rules/${pathId(ruleId)}`,
    budgets: '/api/v1/finance/budgets',
    budget: (budgetId: ApiId) => `/api/v1/finance/budgets/${pathId(budgetId)}`,
    goals: '/api/v1/finance/goals',
    goal: (goalId: ApiId) => `/api/v1/finance/goals/${pathId(goalId)}`,
    goalContributions: (goalId: ApiId) => `/api/v1/finance/goals/${pathId(goalId)}/contributions`,
    summary: '/api/v1/finance/summary',
  },
  insights: {
    list: '/api/v1/insights',
  },
  reports: {
    export: '/api/v1/reports/export',
  },
} as const;
