import { describe, it, expect } from 'vitest';
import { AnalyticsService } from '../../src/services/analytics.service';

describe('FinSight Financial Calculation Engine & Analytics Bridge', () => {
  it('1. Invokes Python simulator for known-value Single Investment scenario with FX and Taxes', async () => {
    // Known test case:
    // Buy 2023-01-02: NVDA price = $150, USD/INR = 82.0
    // Sell 2024-01-02: NVDA price = $480, USD/INR = 83.0
    // Initial amount: ₹82,000 INR
    // Expected:
    // USD invested = 82000 / 82 = $1000 USD
    // Shares = 1000 / 150 = 6.666667 shares
    // Dividend: $10/share paid on 2023-06-01 -> $66.66667
    // Exit equity: 6.666667 * 480 = $3200
    // Total proceeds in USD = $3266.6667
    // Converted to INR at 83.0: 3266.6667 * 83 = ₹271,133.33 INR
    // Gross profit: ₹189,133.33 INR
    // Asset return: ($3266.6667 - 1000) * 82 = ₹185,866.67
    // FX impact: $3266.6667 * (83 - 82) = ₹3,266.67

    const payload = {
      mode: 'SINGLE_INVESTMENT',
      initial_amount: 82000,
      base_currency: 'INR',
      asset_currency: 'USD',
      start_date: '2023-01-02',
      end_date: '2024-01-02',
      price_history: [
        { date: '2023-01-02', close: 150.0, open: 148.0, high: 152.0, low: 147.0, volume: 1000000 },
        { date: '2023-06-01', close: 380.0, open: 375.0, high: 385.0, low: 370.0, volume: 1200000 },
        { date: '2024-01-02', close: 480.0, open: 475.0, high: 485.0, low: 470.0, volume: 1500000 },
      ],
      exchange_rates: [
        { base_currency: 'USD', quote_currency: 'INR', date: '2023-01-02', rate: 82.0 },
        { base_currency: 'USD', quote_currency: 'INR', date: '2024-01-02', rate: 83.0 },
      ],
      dividends: [
        { ex_date: '2023-06-01', amount: 10.0 },
      ],
      corporate_actions: [],
      benchmark_price_history: [
        { date: '2023-01-02', close: 3800.0 },
        { date: '2024-01-02', close: 4750.0 }, // S&P 500: +25% return
      ],
      fee_rate: 0.001, // 0.1%
      tax_rate: 0.125, // 12.5% LTCG
    };

    const result = await AnalyticsService.runScript('simulations/simulator.py', payload);

    expect(result).toBeDefined();
    expect(result.mode).toBe('SINGLE_INVESTMENT');
    expect(result.financials.initial_investment).toBe(82000);

    // Verify gross value and profit in INR
    expect(result.financials.gross_value).toBeGreaterThan(270000);
    expect(result.financials.gross_profit).toBeGreaterThan(180000);

    // Verify clear separation of Asset Return vs FX Impact
    expect(result.attribution.asset_return_amount).toBeGreaterThan(180000);
    expect(result.attribution.fx_impact_amount).toBeGreaterThan(3000);
    expect(result.attribution.dividend_amount).toBeGreaterThan(5000);

    // Verify fees and taxes are accounted for
    expect(result.financials.fees).toBeGreaterThan(0);
    expect(result.financials.estimated_tax).toBeGreaterThan(0);
    expect(result.financials.net_value).toBeLessThan(result.financials.gross_value);

    // Verify risk metrics
    expect(result.risk_metrics.cagr).toBeGreaterThan(100);
    expect(result.risk_metrics.benchmark_return).toBe(25);
    expect(result.risk_metrics.benchmark_difference).toBeGreaterThan(0);
  });
});

