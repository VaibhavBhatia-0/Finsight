ALTER TABLE stocks
  ADD COLUMN IF NOT EXISTS display_symbol VARCHAR(30),
  ADD COLUMN IF NOT EXISTS provider_symbol VARCHAR(40),
  ADD COLUMN IF NOT EXISTS asset_type VARCHAR(30) NOT NULL DEFAULT 'EQUITY',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE stocks s
SET display_symbol = COALESCE(display_symbol, symbol),
    provider_symbol = COALESCE(provider_symbol,
      CASE
        WHEN s.exchange = 'NSE' THEN s.symbol || '.NS'
        WHEN s.exchange = 'BSE' THEN s.symbol || '.BO'
        ELSE s.symbol
      END)
WHERE display_symbol IS NULL OR provider_symbol IS NULL;

ALTER TABLE stocks
  ALTER COLUMN display_symbol SET NOT NULL,
  ALTER COLUMN provider_symbol SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stocks_active_search
  ON stocks(is_active, symbol, company_name);
CREATE INDEX IF NOT EXISTS idx_stocks_provider_symbol
  ON stocks(provider_symbol);

ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;
