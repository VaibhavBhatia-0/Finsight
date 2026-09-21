ALTER TABLE security_universe_syncs
  ALTER COLUMN source_timestamp TYPE TIMESTAMPTZ
  USING source_timestamp::TIMESTAMPTZ;
