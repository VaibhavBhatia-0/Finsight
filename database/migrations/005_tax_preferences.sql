ALTER TABLE user_preferences
    ADD COLUMN tax_residency VARCHAR(2),
    ADD COLUMN tax_status VARCHAR(40),
    ADD CONSTRAINT chk_user_preferences_tax_residency
        CHECK (tax_residency IS NULL OR tax_residency IN ('IN', 'US'));
