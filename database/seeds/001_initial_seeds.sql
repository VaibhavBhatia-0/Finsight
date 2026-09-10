-- ============================================================================
-- Seeds: 001_initial_seeds.sql
-- Description: Baseline reference data for FinSight platform
-- Exchanges, Benchmarks, Tax Rules, Baseline Equities, and Initial FX rates
-- ============================================================================

-- EXCHANGES
INSERT INTO exchanges (code, name, country_code, currency, timezone) VALUES
('NSE', 'National Stock Exchange of India', 'IN', 'INR', 'Asia/Kolkata'),
('BSE', 'Bombay Stock Exchange', 'IN', 'INR', 'Asia/Kolkata'),
('NASDAQ', 'NASDAQ Stock Market', 'US', 'USD', 'America/New_York'),
('NYSE', 'New York Stock Exchange', 'US', 'USD', 'America/New_York')
ON CONFLICT (code) DO NOTHING;

-- BENCHMARKS
INSERT INTO benchmarks (code, name, exchange_id, currency, description) VALUES
('NIFTY_50', 'NIFTY 50', (SELECT id FROM exchanges WHERE code = 'NSE'), 'INR', 'Flagship Indian benchmark index tracking 50 largest blue-chip companies'),
('SENSEX', 'BSE SENSEX', (SELECT id FROM exchanges WHERE code = 'BSE'), 'INR', 'Benchmark index of the Bombay Stock Exchange tracking 30 well-established companies'),
('SP500', 'S&P 500 Index', (SELECT id FROM exchanges WHERE code = 'NYSE'), 'USD', 'Standard & Poor 500 market-cap-weighted index of 500 leading US publicly traded companies'),
('NASDAQ_COMP', 'NASDAQ Composite', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'USD', 'Broad-based capitalization-weighted index of approximately 3,000 common equities listed on NASDAQ')
ON CONFLICT (code) DO NOTHING;

-- TAX RULES (Versioned & Effective-Dated Educational Rules)
INSERT INTO tax_rules (jurisdiction, tax_type, asset_type, effective_from, effective_to, holding_period_min_days, rate, applicability, source_reference) VALUES
('IN', 'LTCG', 'EQUITY', '2024-07-23', NULL, 365, 0.12500000, '{"description": "Long Term Capital Gains on Indian Listed Equities (Finance Act 2024)", "exemption_limit": 125000}'::jsonb, 'Indian Income Tax Act / Budget 2024'),
('IN', 'STCG', 'EQUITY', '2024-07-23', NULL, 0, 0.20000000, '{"description": "Short Term Capital Gains on Indian Listed Equities (Finance Act 2024)"}'::jsonb, 'Indian Income Tax Act / Budget 2024'),
('US', 'LTCG', 'EQUITY', '2023-01-01', NULL, 366, 0.15000000, '{"description": "US Federal Long Term Capital Gains typical middle bracket"}'::jsonb, 'IRS Publication 550'),
('US', 'STCG', 'EQUITY', '2023-01-01', NULL, 0, 0.24000000, '{"description": "US Federal Short Term Capital Gains treated as ordinary income"}'::jsonb, 'IRS Publication 550')
ON CONFLICT DO NOTHING;

-- STOCKS (Baseline Indian and US Equities)
INSERT INTO stocks (symbol, exchange_id, exchange, company_name, currency, sector, industry) VALUES
('RELIANCE', (SELECT id FROM exchanges WHERE code = 'NSE'), 'NSE', 'Reliance Industries Ltd.', 'INR', 'Energy', 'Oil & Gas Refining'),
('TCS', (SELECT id FROM exchanges WHERE code = 'NSE'), 'NSE', 'Tata Consultancy Services Ltd.', 'INR', 'Technology', 'IT Services'),
('HDFCBANK', (SELECT id FROM exchanges WHERE code = 'NSE'), 'NSE', 'HDFC Bank Ltd.', 'INR', 'Financial Services', 'Banking'),
('INFY', (SELECT id FROM exchanges WHERE code = 'NSE'), 'NSE', 'Infosys Ltd.', 'INR', 'Technology', 'IT Consulting'),
('NVDA', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'NASDAQ', 'NVIDIA Corporation', 'USD', 'Technology', 'Semiconductors'),
('AAPL', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'NASDAQ', 'Apple Inc.', 'USD', 'Technology', 'Consumer Electronics'),
('MSFT', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'NASDAQ', 'Microsoft Corporation', 'USD', 'Technology', 'Software'),
('GOOGL', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'NASDAQ', 'Alphabet Inc.', 'USD', 'Technology', 'Internet & Software')
ON CONFLICT (symbol, exchange_id) DO NOTHING;

-- INITIAL FX RATES (USD/INR historical sample and current reference)
INSERT INTO exchange_rates (base_currency, quote_currency, rate_date, rate, source, observed_at, freshness) VALUES
('USD', 'INR', '2023-01-02', 82.750000000000, 'RBI_REFERENCE', '2023-01-02T13:00:00Z', 'Historical'),
('USD', 'INR', '2024-01-02', 83.300000000000, 'RBI_REFERENCE', '2024-01-02T13:00:00Z', 'Historical'),
('USD', 'INR', '2025-01-02', 85.800000000000, 'RBI_REFERENCE', '2025-01-02T13:00:00Z', 'Historical'),
('USD', 'INR', '2026-09-08', 88.250000000000, 'RBI_REFERENCE', '2026-09-08T13:00:00Z', 'End-of-day')
ON CONFLICT (base_currency, quote_currency, rate_date) DO NOTHING;

