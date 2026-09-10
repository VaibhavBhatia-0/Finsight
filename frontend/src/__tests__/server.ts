// src/__tests__/server.ts
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Handlers for finance and report endpoints – can be overridden in individual tests.
export const handlers = [
  // Finance endpoints
  rest.get('/api/v1/finance/budgets', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 1, name: 'Monthly Budget', amount: 2000 },
        { id: 2, name: 'Vacation', amount: 1500 }
      ])
    );
  }),
  rest.get('/api/v1/finance/goals', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 1, description: 'Emergency Fund', target: 5000 },
        { id: 2, description: 'Car', target: 10000 }
      ])
    );
  }),
  rest.get('/api/v1/finance/savings', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 1, name: 'Savings Account', balance: 3000 },
        { id: 2, name: 'Investment', balance: 12000 }
      ])
    );
  }),
  // Report endpoints – CSV
  rest.get('/api/v1/reports/export-csv', (req, res, ctx) => {
    const csv = 'id,name\n1,Test';
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/csv'),
      ctx.set('Content-Disposition', 'attachment; filename="report.csv"'),
      ctx.body(csv)
    );
  }),
  // Report endpoint – PDF
  rest.get('/api/v1/reports/export-pdf', (req, res, ctx) => {
    const pdfBlob = new Uint8Array([37,80,68,70]); // minimal %PDF header
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'application/pdf'),
      ctx.set('Content-Disposition', 'attachment; filename="report.pdf"'),
      ctx.body(pdfBlob)
    );
  })
];

export const server = setupServer(...handlers);
