type HttpMethod = 'get' | 'post' | 'put' | 'delete';

const operation = (summary: string, secured = true, contentTypes = ['application/json']) => ({
  summary,
  ...(secured ? { security: [{ bearerAuth: [] }] } : {}),
  responses: {
    '200': { description: 'Successful response', content: Object.fromEntries(contentTypes.map(type => [type, { schema: type === 'application/json' ? { $ref: '#/components/schemas/ApiEnvelope' } : { type: 'string', format: 'binary' } }])) },
    '400': { $ref: '#/components/responses/BadRequest' },
    ...(secured ? { '401': { $ref: '#/components/responses/Unauthorized' } } : {}),
  },
});

const path = (methods: Partial<Record<HttpMethod, ReturnType<typeof operation>>>) => methods;

export const openApiDocument = {
  openapi: '3.1.0',
  info: { title: 'FinSight API', version: '1.0.0', description: 'Canonical layered-monolith API. Scenario simulation and backtesting are separate engines.' },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/auth/register': path({ post: operation('Register with email and password', false) }),
    '/auth/login': path({ post: operation('Sign in with email and password', false) }),
    '/auth/me': path({ get: operation('Get the authenticated profile') }),
    '/auth/preferences': path({ put: operation('Update canonical user preferences') }),
    '/auth/verification/request': path({ post: operation('Request email verification delivery', false) }),
    '/auth/verification/confirm': path({ post: operation('Consume an email verification token', false) }),
    '/auth/password-reset/request': path({ post: operation('Request password reset delivery', false) }),
    '/auth/password-reset/confirm': path({ post: operation('Consume a password reset token', false) }),
    '/auth/google': path({ get: operation('Start Google OAuth with persisted state', false) }),
    '/auth/google/callback': path({ get: operation('Complete Google OAuth', false, ['text/html']) }),
    '/markets/overview': path({ get: operation('Get market index overview', false) }),
    '/markets/stocks': path({ get: operation('List or search stocks', false) }),
    '/markets/stocks/{id}': path({ get: operation('Get stock detail', false) }),
    '/markets/stocks/{id}/prices': path({ get: operation('Get dated stock prices', false) }),
    '/markets/screener': path({ get: operation('Screen stocks with AND-combined filters', false) }),
    '/markets/fx': path({ get: operation('Resolve current or historical FX', false) }),
    '/watchlists': path({ get: operation('List user watchlists'), post: operation('Create a watchlist') }),
    '/watchlists/{id}': path({ delete: operation('Delete an owned watchlist') }),
    '/watchlists/{id}/items': path({ post: operation('Add an item to an owned watchlist') }),
    '/watchlists/{id}/items/{stockId}': path({ delete: operation('Remove an item from an owned watchlist') }),
    '/portfolios': path({ get: operation('List portfolio valuations'), post: operation('Create a portfolio') }),
    '/portfolios/{id}': path({ get: operation('Get a portfolio valuation'), delete: operation('Delete an owned portfolio') }),
    '/portfolios/{id}/transactions': path({ get: operation('Get the authoritative portfolio ledger'), post: operation('Append a validated portfolio transaction') }),
    '/scenarios/simulate': path({ post: operation('Run SINGLE, RECURRING, or PORTFOLIO scenario simulation', false) }),
    '/scenarios': path({ get: operation('List saved scenarios'), post: operation('Atomically save a scenario result') }),
    '/scenarios/compare': path({ post: operation('Persist and calculate a scenario comparison') }),
    '/scenarios/{id}': path({ get: operation('Get saved scenario detail'), delete: operation('Delete a saved scenario') }),
    '/backtests': path({ get: operation('List canonical backtests'), post: operation('Run the canonical backtesting engine') }),
    '/backtests/{id}': path({ get: operation('Get a backtest'), delete: operation('Delete a backtest') }),
    '/finance/transactions': path({ get: operation('List the finance ledger'), post: operation('Create a finance transaction') }),
    '/finance/transactions/{id}': path({ put: operation('Update a finance transaction'), delete: operation('Delete a finance transaction') }),
    '/finance/recurring-rules': path({ get: operation('List recurring finance rules'), post: operation('Create and materialize a recurring rule') }),
    '/finance/recurring-rules/{id}': path({ delete: operation('Deactivate a recurring finance rule') }),
    '/finance/budgets': path({ get: operation('List budgets'), post: operation('Create a budget') }),
    '/finance/budgets/{id}': path({ put: operation('Update a budget'), delete: operation('Delete a budget') }),
    '/finance/goals': path({ get: operation('List savings goals'), post: operation('Create a savings goal') }),
    '/finance/goals/{id}': path({ put: operation('Update a savings goal'), delete: operation('Delete a savings goal') }),
    '/finance/goals/{id}/contributions': path({ post: operation('Atomically record a goal contribution') }),
    '/finance/summary': path({ get: operation('Get historical-FX-normalized finance summary') }),
    '/insights': path({ get: operation('Get deterministic descriptive insights') }),
    '/reports/export': path({ get: operation('Export an authenticated CSV or PDF report', true, ['text/csv', 'application/pdf']) }),
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      ApiEnvelope: { type: 'object', required: ['success', 'data', 'error', 'meta'], properties: { success: { const: true }, data: {}, error: { type: 'null' }, meta: { type: 'object', required: ['timestamp', 'freshness'], properties: { timestamp: { type: 'string', format: 'date-time' }, freshness: { enum: ['Live', 'Delayed', 'End-of-day', 'Historical', 'Static', 'Synthetic'] } } } } },
      ApiError: { type: 'object', required: ['success', 'error'], properties: { success: { const: false }, error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' }, details: { type: 'array' } } } } },
    },
    responses: {
      BadRequest: { description: 'Input validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
      Unauthorized: { description: 'Authentication failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
    },
  },
} as const;
