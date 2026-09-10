import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const envelope = <T,>(data: T) => ({
  success: true as const,
  data,
  error: null,
  meta: { timestamp: '2024-01-01T00:00:00.000Z', freshness: 'Static' },
});

export const handlers = [
  http.get('http://localhost/api/v1/finance/budgets', () => HttpResponse.json(envelope([
    { id: '1', category: 'Housing', amount: '2000', start_date: '2024-01-01', end_date: '2024-01-31' },
    { id: '2', category: 'Travel', amount: '1500', start_date: '2024-01-01', end_date: '2024-12-31' },
  ]))),
  http.get('http://localhost/api/v1/finance/goals', () => HttpResponse.json(envelope([
    { id: '1', name: 'Emergency Fund', target_amount: '5000', current_amount: '1000', target_date: '2025-01-01' },
    { id: '2', name: 'Car', target_amount: '10000', current_amount: '2500', target_date: '2026-01-01' },
  ]))),
  http.get('http://localhost/api/v1/finance/savings', () => HttpResponse.json(envelope([
    { id: 1, name: 'Savings Account', balance: 3000 },
    { id: 2, name: 'Investment', balance: 12000 },
  ]))),
  http.get('http://localhost/api/v1/reports/export-csv', () => new HttpResponse('id,name\n1,Test', {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="report.csv"' },
  })),
  http.get('http://localhost/api/v1/reports/export-pdf', () => new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="report.pdf"' },
  })),
];

export const server = setupServer(...handlers);
