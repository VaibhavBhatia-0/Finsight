-- Values originally inserted by 001_initial_seeds.sql are development fixtures,
-- not provider-verified historical observations.
UPDATE exchange_rates
SET source = 'FINSIGHT_DEVELOPMENT_FIXTURE', freshness = 'Synthetic'
WHERE source = 'RBI_REFERENCE'
  AND base_currency = 'USD'
  AND quote_currency = 'INR'
  AND (rate_date, rate) IN (
    (DATE '2023-01-02', 82.750000000000),
    (DATE '2024-01-02', 83.300000000000),
    (DATE '2025-01-02', 85.800000000000),
    (DATE '2026-09-08', 88.250000000000)
  );
