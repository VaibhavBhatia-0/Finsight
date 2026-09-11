CREATE TABLE IF NOT EXISTS finance_recurring_rules (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('INCOME','EXPENSE','TRANSFER')),
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    frequency VARCHAR(20) NOT NULL
        CHECK (frequency IN ('WEEKLY','MONTHLY','QUARTERLY','ANNUALLY')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date IS NULL OR end_date >= start_date)
);

ALTER TABLE finance_transactions
    ADD COLUMN recurring_rule_id BIGINT REFERENCES finance_recurring_rules(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_recurring_occurrence
    ON finance_transactions(recurring_rule_id, transaction_date)
    WHERE recurring_rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_recurring_rules_user_active
    ON finance_recurring_rules(user_id, active);
