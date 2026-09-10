import { describe, expect, it } from 'vitest';
import { AnalyticsService } from '../../src/services/analytics.service';

const basePayload = {
  base_currency: 'INR', asset_currency: 'USD', start_date: '2020-01-01', end_date: '2021-01-01',
  initial_amount: 8200, fee_rate: 0, tax_rate: 0, benchmark_price_history: [],
  price_history: [{ date: '2020-01-01', close: 10 }, { date: '2021-01-01', close: 12 }],
  exchange_rates: [
    { base_currency: 'USD', quote_currency: 'INR', date: '2020-01-01', rate: 82 },
    { base_currency: 'USD', quote_currency: 'INR', date: '2020-06-01', rate: 82.5 },
    { base_currency: 'USD', quote_currency: 'INR', date: '2021-01-01', rate: 83 },
  ], corporate_actions: [], dividends: [],
};

describe('deterministic scenario calculations', () => {
  it('reconciles asset, FX, dividend, fee, and tax attribution exactly', async () => {
    const value = await AnalyticsService.runScript('simulations/simulator.py', {
      ...basePayload,
      mode: 'SINGLE_INVESTMENT',
      dividends: [{ ex_date: '2020-06-01', amount: 1 }],
    });
    expect(value.financials.gross_value).toBe(10785);
    expect(value.financials.gross_profit).toBe(2585);
    expect(value.attribution.asset_return_amount).toBe(1640);
    expect(value.attribution.fx_impact_amount).toBe(120);
    expect(value.attribution.dividend_amount).toBe(825);
    expect(value.attribution.reconciliation_difference).toBe(0);
  });

  it('pays a dividend using pre-split shares when the dividend precedes the split', async () => {
    const value = await AnalyticsService.runScript('simulations/simulator.py', {
      mode: 'SINGLE_INVESTMENT', base_currency: 'USD', asset_currency: 'USD', initial_amount: 100,
      start_date: '2020-01-01', end_date: '2020-12-31', fee_rate: 0, tax_rate: 0,
      price_history: [{ date: '2020-01-01', close: 10 }, { date: '2020-12-31', close: 5 }], exchange_rates: [],
      dividends: [{ ex_date: '2020-03-01', amount: 1 }],
      corporate_actions: [{ action_date: '2020-06-01', action_type: 'SPLIT', ratio: 2 }], benchmark_price_history: [],
    });
    expect(value.financials.dividends).toBe(10);
    expect(value.financials.gross_value).toBe(110);
    expect(value.financials.net_profit).toBe(10);
  });

  it('runs recurring contributions through the recurring engine', async () => {
    const value = await AnalyticsService.runScript('simulations/simulator.py', {
      mode: 'RECURRING_INVESTMENT', base_currency: 'USD', asset_currency: 'USD', initial_amount: 1000,
      start_date: '2020-01-01', end_date: '2020-02-03', contribution_frequency: 'MONTHLY', fee_rate: 0, tax_rate: 0,
      price_history: [{ date: '2020-01-01', close: 10 }, { date: '2020-02-03', close: 20 }], exchange_rates: [], dividends: [], corporate_actions: [],
    });
    expect(value.mode).toBe('RECURRING_INVESTMENT');
    expect(value.details.contribution_count).toBe(2);
    expect(value.financials.initial_investment).toBe(2000);
    expect(value.financials.gross_value).toBe(3000);
    expect(value.financials.net_profit).toBe(1000);
  });

  it('runs weighted assets through the portfolio scenario engine', async () => {
    const asset = (symbol: string, weight: number, start: number, end: number) => ({
      symbol, weight, asset_currency: 'USD', price_history: [{ date: '2020-01-01', close: start }, { date: '2021-01-01', close: end }], exchange_rates: [], dividends: [], corporate_actions: [],
    });
    const value = await AnalyticsService.runScript('simulations/simulator.py', {
      mode: 'PORTFOLIO_SCENARIO', base_currency: 'USD', initial_amount: 1000, start_date: '2020-01-01', end_date: '2021-01-01', fee_rate: 0, tax_rate: 0,
      benchmark_price_history: [], assets: [asset('A', 0.6, 10, 12), asset('B', 0.4, 20, 18)],
    });
    expect(value.mode).toBe('PORTFOLIO_SCENARIO');
    expect(value.financials.gross_value).toBe(1080);
    expect(value.financials.net_profit).toBe(80);
    expect(value.financials.net_return_percentage).toBe(8);
    expect(value.attribution.reconciliation_difference).toBe(0);
  });
});
