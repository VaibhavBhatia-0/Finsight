-- Essential market reference data belongs to the application schema lifecycle.
-- This migration intentionally contains no prices, FX rates, fundamentals, or
-- other observations that could be mistaken for live market data.

INSERT INTO exchanges (code, name, country_code, currency, timezone) VALUES
  ('NSE', 'National Stock Exchange of India', 'IN', 'INR', 'Asia/Kolkata'),
  ('BSE', 'Bombay Stock Exchange', 'IN', 'INR', 'Asia/Kolkata'),
  ('NASDAQ', 'NASDAQ Stock Market', 'US', 'USD', 'America/New_York'),
  ('NYSE', 'New York Stock Exchange', 'US', 'USD', 'America/New_York')
ON CONFLICT (code) DO NOTHING;

INSERT INTO benchmarks (code, name, exchange_id, currency, description) VALUES
  ('NIFTY_50', 'NIFTY 50', (SELECT id FROM exchanges WHERE code = 'NSE'), 'INR', 'Flagship Indian large-cap benchmark'),
  ('SENSEX', 'BSE SENSEX', (SELECT id FROM exchanges WHERE code = 'BSE'), 'INR', 'Bombay Stock Exchange benchmark'),
  ('SP500', 'S&P 500', (SELECT id FROM exchanges WHERE code = 'NYSE'), 'USD', 'United States large-cap benchmark'),
  ('NASDAQ_COMP', 'NASDAQ Composite', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'USD', 'NASDAQ composite benchmark')
ON CONFLICT (code) DO NOTHING;

INSERT INTO stocks (
  symbol, display_symbol, provider_symbol, exchange_id, exchange,
  company_name, currency, sector, industry, asset_type, is_active
) VALUES
  ('RELIANCE', 'RELIANCE', 'RELIANCE.NS', (SELECT id FROM exchanges WHERE code = 'NSE'), 'NSE', 'Reliance Industries Ltd.', 'INR', 'Energy', 'Oil & Gas Refining', 'EQUITY', TRUE),
  ('TCS', 'TCS', 'TCS.NS', (SELECT id FROM exchanges WHERE code = 'NSE'), 'NSE', 'Tata Consultancy Services Ltd.', 'INR', 'Technology', 'IT Services', 'EQUITY', TRUE),
  ('HDFCBANK', 'HDFCBANK', 'HDFCBANK.NS', (SELECT id FROM exchanges WHERE code = 'NSE'), 'NSE', 'HDFC Bank Ltd.', 'INR', 'Financial Services', 'Banking', 'EQUITY', TRUE),
  ('INFY', 'INFY', 'INFY.NS', (SELECT id FROM exchanges WHERE code = 'NSE'), 'NSE', 'Infosys Ltd.', 'INR', 'Technology', 'IT Consulting', 'EQUITY', TRUE),
  ('NVDA', 'NVDA', 'NVDA', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'NASDAQ', 'NVIDIA Corporation', 'USD', 'Technology', 'Semiconductors', 'EQUITY', TRUE),
  ('AAPL', 'AAPL', 'AAPL', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'NASDAQ', 'Apple Inc.', 'USD', 'Technology', 'Consumer Electronics', 'EQUITY', TRUE),
  ('MSFT', 'MSFT', 'MSFT', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'NASDAQ', 'Microsoft Corporation', 'USD', 'Technology', 'Software', 'EQUITY', TRUE),
  ('GOOGL', 'GOOGL', 'GOOGL', (SELECT id FROM exchanges WHERE code = 'NASDAQ'), 'NASDAQ', 'Alphabet Inc.', 'USD', 'Technology', 'Internet & Software', 'EQUITY', TRUE)
ON CONFLICT (symbol, exchange_id) DO UPDATE SET
  display_symbol = EXCLUDED.display_symbol,
  provider_symbol = EXCLUDED.provider_symbol,
  company_name = EXCLUDED.company_name,
  currency = EXCLUDED.currency,
  asset_type = EXCLUDED.asset_type,
  is_active = TRUE;
