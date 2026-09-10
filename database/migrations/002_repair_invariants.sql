-- Repair-pass invariants. Keep 001 as the immutable baseline.

DELETE FROM tax_rules a
USING tax_rules b
WHERE a.id > b.id
  AND a.jurisdiction = b.jurisdiction
  AND a.tax_type = b.tax_type
  AND a.asset_type = b.asset_type
  AND a.effective_from = b.effective_from
  AND COALESCE(a.effective_to, DATE '9999-12-31') = COALESCE(b.effective_to, DATE '9999-12-31')
  AND COALESCE(a.holding_period_min_days, -1) = COALESCE(b.holding_period_min_days, -1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_rules_natural_version
  ON tax_rules (
    jurisdiction,
    tax_type,
    asset_type,
    effective_from,
    COALESCE(effective_to, DATE '9999-12-31'),
    COALESCE(holding_period_min_days, -1)
  );

ALTER TABLE portfolio_holdings
  ADD CONSTRAINT chk_portfolio_holdings_quantity_nonnegative CHECK (quantity >= 0),
  ADD CONSTRAINT chk_portfolio_holdings_average_cost_nonnegative CHECK (average_cost IS NULL OR average_cost >= 0);

ALTER TABLE portfolio_transactions
  ADD CONSTRAINT chk_portfolio_transaction_amount_nonnegative CHECK (amount >= 0),
  ADD CONSTRAINT chk_portfolio_transaction_fee_nonnegative CHECK (fee_amount >= 0),
  ADD CONSTRAINT chk_portfolio_transaction_fx_positive CHECK (fx_rate IS NULL OR fx_rate > 0),
  ADD CONSTRAINT chk_portfolio_transaction_trade_fields CHECK (
    (transaction_type IN ('BUY', 'SELL') AND stock_id IS NOT NULL AND quantity > 0 AND price > 0 AND amount > 0)
    OR (transaction_type = 'SPLIT' AND stock_id IS NOT NULL AND quantity > 0 AND amount = 0)
    OR (transaction_type IN ('DIVIDEND', 'DEPOSIT', 'WITHDRAWAL', 'FEE') AND amount > 0)
  );

ALTER TABLE scenarios
  ADD CONSTRAINT chk_scenario_date_range CHECK (start_date < end_date),
  ADD CONSTRAINT chk_scenario_initial_amount_positive CHECK (initial_amount IS NULL OR initial_amount > 0);

ALTER TABLE scenario_assets
  ADD CONSTRAINT chk_scenario_asset_weight CHECK (target_weight IS NULL OR (target_weight > 0 AND target_weight <= 1)),
  ADD CONSTRAINT chk_scenario_asset_amount CHECK (initial_amount IS NULL OR initial_amount > 0);
