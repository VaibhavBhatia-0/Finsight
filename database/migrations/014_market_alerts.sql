-- User-owned configured market alerts. No background monitoring is implied.
CREATE TABLE IF NOT EXISTS user_market_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_id BIGINT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  condition VARCHAR(30) NOT NULL CHECK (condition IN (
    'PRICE_ABOVE', 'PRICE_BELOW', 'DAILY_CHANGE_ABOVE', 'DAILY_CHANGE_BELOW', 'RSI_ABOVE', 'RSI_BELOW'
  )),
  threshold NUMERIC(24,8) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, stock_id, condition, threshold)
);

CREATE INDEX IF NOT EXISTS idx_user_market_alerts_user_enabled
  ON user_market_alerts(user_id, enabled, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_market_alerts_stock
  ON user_market_alerts(stock_id, enabled);
