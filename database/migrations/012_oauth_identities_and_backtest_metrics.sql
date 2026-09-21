-- Normalize external identities without removing the legacy users.google_subject column.
-- The legacy column is retained for rollback compatibility and backfilled below.
CREATE TABLE IF NOT EXISTS auth_identities (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('GOOGLE')),
    provider_subject VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_subject),
    UNIQUE (provider, user_id)
);

INSERT INTO auth_identities (id, user_id, provider, provider_subject)
SELECT md5('GOOGLE:' || id::text)::uuid, id, 'GOOGLE', google_subject
FROM users
WHERE google_subject IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE oauth_states
    ADD COLUMN nonce_hash CHAR(64);

ALTER TABLE backtest_results
    ADD COLUMN benchmark_cagr NUMERIC(18,8),
    ADD COLUMN relative_performance NUMERIC(18,8),
    ADD COLUMN fees_paid NUMERIC(24,8),
    ADD COLUMN gross_final_value NUMERIC(24,8),
    ADD COLUMN attribution JSONB NOT NULL DEFAULT '{}'::jsonb;
