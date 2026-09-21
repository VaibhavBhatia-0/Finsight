CREATE TABLE IF NOT EXISTS security_universe_syncs (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(80) NOT NULL,
  security_count INTEGER NOT NULL CHECK (security_count >= 0),
  source_timestamp TIMESTAMPTZ,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_universe_syncs_completed
  ON security_universe_syncs(completed_at DESC);
