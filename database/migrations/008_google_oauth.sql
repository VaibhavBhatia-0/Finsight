ALTER TABLE users
    ADD COLUMN google_subject VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_subject
    ON users(google_subject) WHERE google_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID PRIMARY KEY,
    state_hash CHAR(64) NOT NULL UNIQUE,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('GOOGLE')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
