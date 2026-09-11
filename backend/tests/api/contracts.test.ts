import http from 'http';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { runMigrations } from '../../src/database/migrate';
import { runSeeds } from '../../src/database/seed';

describe('Canonical API contract integration', () => {
  let server: http.Server;
  let baseUrl: string;
  let token: string;

  beforeAll(async () => {
    await runMigrations();
    await runSeeds();
    server = await new Promise<http.Server>((resolve) => {
      const instance = createApp().listen(0, () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port');
    baseUrl = `http://localhost:${address.port}`;

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `contract_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Contract Test',
        baseCurrency: 'INR',
      }),
    });
    token = (await response.json()).data.token;
    return () => server.close();
  });

  const authenticated = (body?: object): RequestInit => ({
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  it('returns the standard error envelope for an unauthenticated finance request', async () => {
    const response = await fetch(`${baseUrl}/api/v1/finance/summary`);
    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication token is missing or invalid' },
    });
  });

  it('publishes the canonical route separation in OpenAPI', async () => {
    const response = await fetch(`${baseUrl}/api/v1/openapi.json`);
    const document = await response.json();
    expect(response.status).toBe(200);
    expect(document.openapi).toBe('3.1.0');
    expect(document.paths['/scenarios/simulate'].post.summary).toContain('scenario simulation');
    expect(document.paths['/backtests'].post.summary).toContain('backtesting engine');
    expect(document.paths['/reports/export'].get.security).toEqual([{ bearerAuth: [] }]);
  });

  it('uses the documented finance request fields and response envelope', async () => {
    const create = await fetch(`${baseUrl}/api/v1/finance/transactions`, {
      method: 'POST',
      ...authenticated({ transactionType: 'EXPENSE', category: 'Food', amount: 250, currency: 'INR', transactionDate: '2026-09-01' }),
    });
    const created = await create.json();
    expect(create.status).toBe(201);
    expect(created.success).toBe(true);
    expect(created.data).toMatchObject({ transaction_type: 'EXPENSE', category: 'Food', transaction_date: '2026-09-01T00:00:00.000Z' });
    expect(created.meta).toMatchObject({ freshness: 'Live' });

    const income = await fetch(`${baseUrl}/api/v1/finance/transactions`, {
      method: 'POST',
      ...authenticated({ transactionType: 'INCOME', category: 'Salary', amount: 10, currency: 'USD', transactionDate: '2024-01-02' }),
    });
    expect(income.status).toBe(201);

    const list = await fetch(`${baseUrl}/api/v1/finance/transactions?type=EXPENSE`, authenticated());
    const listed = await list.json();
    expect(listed.data).toHaveLength(1);
    expect(Number(listed.data[0].amount)).toBe(250);

    const budget = await fetch(`${baseUrl}/api/v1/finance/budgets`, {
      method: 'POST',
      ...authenticated({ category: 'Food', amount: 1000, startDate: '2026-09-01', endDate: '2026-09-30' }),
    });
    const goal = await fetch(`${baseUrl}/api/v1/finance/goals`, {
      method: 'POST',
      ...authenticated({ name: 'Emergency fund', targetAmount: 50000, currentAmount: 5000, targetDate: '2027-09-01' }),
    });
    expect((await budget.json()).data).toMatchObject({ category: 'Food' });
    const goalPayload = await goal.json();
    expect(goalPayload.data).toMatchObject({ name: 'Emergency fund' });

    const summary = await fetch(`${baseUrl}/api/v1/finance/summary`, authenticated());
    const summaryPayload = await summary.json();
    expect(summaryPayload.data).toMatchObject({ currency: 'INR', calculation: { method: 'HISTORICAL_TRANSACTION_DATE_FX', hasSyntheticFx: true } });
    expect(summaryPayload.data.overview).toMatchObject({ totalIncome: 833, totalExpense: 250, netSavings: 583, savingsRate: 69.99, estimatedInvestableSurplus: 583 });
    expect(summaryPayload.meta).toMatchObject({ freshness: 'Synthetic', degraded: true });
    expect(summaryPayload.data.budgets).toHaveLength(1);
    expect(summaryPayload.data.goals).toHaveLength(1);

    const insights = await fetch(`${baseUrl}/api/v1/insights`, authenticated());
    const insightsPayload = await insights.json();
    expect(insights.status).toBe(200);
    expect(insightsPayload.data.calculation).toMatchObject({ method: 'DETERMINISTIC_RULES', hasSyntheticFx: true });
    expect(insightsPayload.data.insights).toContainEqual(expect.objectContaining({
      id: 'cash-flow:savings-rate',
      severity: 'positive',
      metric: { label: 'Savings rate', value: 69.99, unit: '%' },
    }));

    const contribution = await fetch(`${baseUrl}/api/v1/finance/goals/${goalPayload.data.id}/contributions`, {
      method: 'POST',
      ...authenticated({ amount: 100, contributionDate: '2026-09-02', notes: 'Monthly saving' }),
    });
    const contributionPayload = await contribution.json();
    expect(contribution.status).toBe(201);
    expect(Number(contributionPayload.data.goal.current_amount)).toBe(5100);
    const updatedSummary = await fetch(`${baseUrl}/api/v1/finance/summary`, authenticated());
    expect((await updatedSummary.json()).data.goals[0]).toMatchObject({ currentAmount: 5100, monthlyContributionRate: 100 });
  });

  it('runs and retrieves a backtest through the canonical backtests route', async () => {
    const portfolioResponse = await fetch(`${baseUrl}/api/v1/portfolios`, {
      method: 'POST',
      ...authenticated({ name: 'Contract Portfolio', baseCurrency: 'INR' }),
    });
    const portfolioId = (await portfolioResponse.json()).data.portfolio.id;
    await fetch(`${baseUrl}/api/v1/portfolios/${portfolioId}/transactions`, {
      method: 'POST',
      ...authenticated({ stockId: 1, transactionType: 'BUY', transactionDate: '2024-01-15', quantity: 1, price: 1000, amount: 1000, currency: 'INR' }),
    });

    const run = await fetch(`${baseUrl}/api/v1/backtests`, {
      method: 'POST',
      ...authenticated({ portfolioId, startDate: '2023-06-01', endDate: '2024-01-02', initialAmount: 10000, strategyType: 'BUY_AND_HOLD' }),
    });
    const result = await run.json();
    expect(run.status).toBe(201);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ status: 'completed', details: { strategyType: 'BUY_AND_HOLD' } });
    expect(result.data.summary.totalInvested).toBe(10000);

    const get = await fetch(`${baseUrl}/api/v1/backtests/${result.data.id}`, authenticated());
    const retrieved = await get.json();
    expect(get.status).toBe(200);
    expect(retrieved.data.id).toBe(result.data.id);
  });

  it('materializes recurring finance rules once per scheduled date', async () => {
    const create = await fetch(`${baseUrl}/api/v1/finance/recurring-rules`, {
      method: 'POST',
      ...authenticated({
        transactionType: 'INCOME',
        category: 'Consulting retainer',
        amount: 100,
        currency: 'INR',
        startDate: '2024-01-31',
        endDate: '2024-03-31',
        frequency: 'MONTHLY',
      }),
    });
    const created = await create.json();
    expect(create.status).toBe(201);
    expect(created.data.occurrences.map((item: any) => item.transaction_date.slice(0, 10))).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);

    const firstRead = await fetch(`${baseUrl}/api/v1/finance/transactions?category=Consulting%20retainer`, authenticated());
    const secondRead = await fetch(`${baseUrl}/api/v1/finance/transactions?category=Consulting%20retainer`, authenticated());
    expect((await firstRead.json()).data).toHaveLength(3);
    expect((await secondRead.json()).data).toHaveLength(3);
  });

  it('exports authenticated CSV and PDF reports with methodology and disclaimers', async () => {
    const csv = await fetch(`${baseUrl}/api/v1/reports/export?reportType=finance_transactions&format=csv`, authenticated());
    const csvText = await csv.text();
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(csv.headers.get('content-disposition')).toContain('attachment;');
    expect(csvText).toContain('USER_FINANCE_LEDGER');
    expect(csvText).toContain('Educational estimates only. Not investment, tax, or legal advice.');
    expect(csvText).toContain('date,type,category,amount,currency,description,recurring');

    const pdf = await fetch(`${baseUrl}/api/v1/reports/export?reportType=finance_summary&format=pdf`, authenticated());
    const pdfBytes = Buffer.from(await pdf.arrayBuffer());
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    expect(pdfBytes.subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(pdfBytes.toString()).toContain('Educational estimates only. Not investment, tax, or legal advice.');
  });
});
