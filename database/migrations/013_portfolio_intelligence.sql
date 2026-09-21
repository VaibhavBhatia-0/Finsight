-- Portfolio intelligence and goal-planning extensions.
-- Derived analytics remain calculated from the transaction ledger and are not persisted.

ALTER TABLE portfolios
    ADD COLUMN allocation_targets JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE savings_goals
    ADD COLUMN base_currency CHAR(3) NOT NULL DEFAULT 'INR',
    ADD COLUMN portfolio_id BIGINT REFERENCES portfolios(id) ON DELETE SET NULL,
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE savings_goals
    ADD CONSTRAINT chk_savings_goals_status
        CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED')),
    ADD CONSTRAINT chk_savings_goals_amounts
        CHECK (target_amount > 0 AND current_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_status
    ON savings_goals(user_id, status);

CREATE INDEX IF NOT EXISTS idx_savings_goals_portfolio
    ON savings_goals(portfolio_id)
    WHERE portfolio_id IS NOT NULL;

-- Taxes are first-class ledger entries so attribution can reconcile exactly.
ALTER TABLE portfolio_transactions
    DROP CONSTRAINT chk_portfolio_transaction_trade_fields;

ALTER TABLE portfolio_transactions
    DROP CONSTRAINT portfolio_transactions_transaction_type_check;

ALTER TABLE portfolio_transactions
    ADD CONSTRAINT portfolio_transactions_transaction_type_check
        CHECK (transaction_type IN ('BUY','SELL','DIVIDEND','SPLIT','DEPOSIT','WITHDRAWAL','FEE','TAX')),
    ADD CONSTRAINT chk_portfolio_transaction_trade_fields CHECK (
        (transaction_type IN ('BUY', 'SELL') AND stock_id IS NOT NULL AND quantity > 0 AND price > 0 AND amount > 0)
        OR (transaction_type = 'SPLIT' AND stock_id IS NOT NULL AND quantity > 0 AND amount = 0)
        OR (transaction_type IN ('DIVIDEND', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'TAX') AND amount > 0)
    );
