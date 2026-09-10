import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

// Real PostgreSQL 16 Engine test suite
describe('PostgreSQL Database Schema & Migration Verification', () => {
  let pg: PGlite;

  beforeAll(async () => {
    // Launch genuine WASM-compiled PostgreSQL 16 engine
    pg = new PGlite();
  });

  afterAll(async () => {
    if (pg) {
      await pg.close();
    }
  });

  it('1. Executes 001_initial_schema.sql migration cleanly against real PostgreSQL engine', async () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await expect(pg.exec(sql)).resolves.toBeDefined();
  });

  it('2. Confirms all 26 distinct entity tables exist in PostgreSQL information_schema', async () => {
    const res = await pg.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = res.rows.map(r => r.table_name);
    const expectedEntities = [
      'exchanges',
      'benchmarks',
      'tax_rules',
      'users',
      'user_preferences',
      'stocks',
      'price_history',
      'fundamentals',
      'dividends',
      'corporate_actions',
      'exchange_rates',
      'watchlists',
      'watchlist_items',
      'portfolios',
      'portfolio_holdings',
      'portfolio_transactions',
      'scenarios',
      'scenario_assets',
      'scenario_contributions',
      'scenario_comparisons',
      'simulation_results',
      'backtests',
      'backtest_results',
      'finance_transactions',
      'budgets',
      'savings_goals',
    ];

    expect(expectedEntities.length).toBe(26);
    for (const table of expectedEntities) {
      expect(tableNames, `Table ${table} should exist in database`).toContain(table);
    }
  });

  it('3. Confirms ALL system timestamp columns use TIMESTAMPTZ with UTC semantics', async () => {
    const res = await pg.query<{ table_name: string; column_name: string; data_type: string }>(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND column_name IN ('created_at', 'updated_at', 'added_at', 'observed_at', 'calculated_at', 'source_timestamp')
      ORDER BY table_name, column_name;
    `);

    expect(res.rows.length).toBeGreaterThan(0);
    for (const col of res.rows) {
      expect(
        col.data_type,
        `Column ${col.table_name}.${col.column_name} must be TIMESTAMPTZ (timestamp with time zone)`
      ).toBe('timestamp with time zone');
    }
  });

  it('4. Enforces Foreign Key constraints and rejects invalid foreign keys', async () => {
    // Attempting to insert a stock with a non-existent exchange_id
    await expect(
      pg.query(`
        INSERT INTO stocks (symbol, exchange_id, company_name, currency)
        VALUES ('TEST', 999999, 'Invalid Exchange Stock', 'INR');
      `)
    ).rejects.toThrow();
  });

  it('5. Enforces CHECK constraints on scenarios.scenario_type (Single, Recurring, Portfolio only)', async () => {
    // Insert prerequisite user
    const userId = 'a0000000-0000-0000-0000-000000000001';
    await pg.query(`
      INSERT INTO users (id, email, password_hash, name)
      VALUES ('${userId}', 'user1@test.com', 'hash123', 'Test User');
    `);

    // Valid scenario_type: SINGLE_INVESTMENT
    await expect(
      pg.query(`
        INSERT INTO scenarios (user_id, name, scenario_type, base_currency, start_date, end_date, initial_amount)
        VALUES ('${userId}', 'Valid Single', 'SINGLE_INVESTMENT', 'INR', '2024-01-01', '2025-01-01', 50000);
      `)
    ).resolves.toBeDefined();

    // Invalid scenario_type: COMPARE_SCENARIOS (must be rejected by CHECK constraint)
    await expect(
      pg.query(`
        INSERT INTO scenarios (user_id, name, scenario_type, base_currency, start_date, end_date, initial_amount)
        VALUES ('${userId}', 'Invalid Compare', 'COMPARE_SCENARIOS', 'INR', '2024-01-01', '2025-01-01', 50000);
      `)
    ).rejects.toThrow(/check constraint/i);

    // Invalid scenario_type: BACKTEST_STRATEGY (must be rejected by CHECK constraint)
    await expect(
      pg.query(`
        INSERT INTO scenarios (user_id, name, scenario_type, base_currency, start_date, end_date, initial_amount)
        VALUES ('${userId}', 'Invalid Backtest', 'BACKTEST_STRATEGY', 'INR', '2024-01-01', '2025-01-01', 50000);
      `)
    ).rejects.toThrow(/check constraint/i);
  });

  it('6. Demonstrably enforces the partial unique index uq_scenario_contrib_null_asset on NULL scenario_asset_id', async () => {
    // Retrieve the valid scenario created in the previous test
    const scenarioRes = await pg.query<{ id: string }>(`SELECT id FROM scenarios LIMIT 1;`);
    const scenarioId = scenarioRes.rows[0].id;

    // 1. Insert first contribution with scenario_asset_id = NULL on 2024-06-01
    await expect(
      pg.query(`
        INSERT INTO scenario_contributions (scenario_id, scenario_asset_id, contribution_date, amount, currency)
        VALUES (${scenarioId}, NULL, '2024-06-01', 5000, 'INR');
      `)
    ).resolves.toBeDefined();

    // 2. CRITICAL TEST: Attempt to insert a DUPLICATE NULL-asset contribution for the same scenario and date
    // This MUST BE REJECTED by uq_scenario_contrib_null_asset!
    await expect(
      pg.query(`
        INSERT INTO scenario_contributions (scenario_id, scenario_asset_id, contribution_date, amount, currency)
        VALUES (${scenarioId}, NULL, '2024-06-01', 5000, 'INR');
      `)
    ).rejects.toThrow(/unique/i);

    // 3. Insert a contribution on a DIFFERENT date with NULL asset -> Should succeed
    await expect(
      pg.query(`
        INSERT INTO scenario_contributions (scenario_id, scenario_asset_id, contribution_date, amount, currency)
        VALUES (${scenarioId}, NULL, '2024-07-01', 5000, 'INR');
      `)
    ).resolves.toBeDefined();
  });

  it('7. Preserves high precision in NUMERIC columns and JSONB structure', async () => {
    // Test NUMERIC(24,12) for FX rate
    await pg.query(`
      INSERT INTO exchange_rates (base_currency, quote_currency, rate_date, rate, source, freshness)
      VALUES ('USD', 'EUR', '2024-01-01', 0.912345678901, 'TEST', 'Historical');
    `);

    const fxRes = await pg.query<{ rate: string }>(`
      SELECT rate FROM exchange_rates WHERE base_currency = 'USD' AND quote_currency = 'EUR';
    `);
    expect(fxRes.rows[0].rate).toBe('0.912345678901');

    // Test JSONB querying
    await pg.query(`
      UPDATE scenarios 
      SET assumptions = '{"inflation_rate": 0.05, "rebalance": "quarterly"}'::jsonb
      WHERE name = 'Valid Single';
    `);

    const jsonbRes = await pg.query<{ rebalance: string }>(`
      SELECT assumptions->>'rebalance' as rebalance FROM scenarios WHERE name = 'Valid Single';
    `);
    expect(jsonbRes.rows[0].rebalance).toBe('quarterly');
  });

  it('8. Executes 001_initial_seeds.sql and verifies seeded reference data', async () => {
    const seedPath = path.resolve(__dirname, '../../../database/seeds/001_initial_seeds.sql');
    const sql = fs.readFileSync(seedPath, 'utf-8');
    await expect(pg.exec(sql)).resolves.toBeDefined();

    // Verify exchanges
    const exchangesRes = await pg.query(`SELECT code FROM exchanges ORDER BY code;`);
    const codes = exchangesRes.rows.map((r: any) => r.code);
    expect(codes).toContain('NSE');
    expect(codes).toContain('BSE');
    expect(codes).toContain('NASDAQ');
    expect(codes).toContain('NYSE');

    // Verify benchmarks
    const benchmarksRes = await pg.query(`SELECT code FROM benchmarks ORDER BY code;`);
    const bCodes = benchmarksRes.rows.map((r: any) => r.code);
    expect(bCodes).toContain('NIFTY_50');
    expect(bCodes).toContain('SENSEX');
    expect(bCodes).toContain('SP500');
    expect(bCodes).toContain('NASDAQ_COMP');

    // Verify tax rules
    const taxRes = await pg.query(`SELECT tax_type, jurisdiction FROM tax_rules;`);
    expect(taxRes.rows.length).toBeGreaterThanOrEqual(4);

    // Verify initial stocks
    const stocksRes = await pg.query(`SELECT symbol FROM stocks;`);
    const symbols = stocksRes.rows.map((r: any) => r.symbol);
    expect(symbols).toContain('RELIANCE');
    expect(symbols).toContain('NVDA');
  });
});
