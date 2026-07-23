ALTER TABLE receipt.contract_versions
  ADD COLUMN IF NOT EXISTS monitoring_window_ms integer NOT NULL DEFAULT 604800000
  CHECK (monitoring_window_ms > 0);

ALTER TABLE receipt.claims
  ADD COLUMN IF NOT EXISTS first_proven_at timestamptz,
  ADD COLUMN IF NOT EXISTS monitoring_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_conclusive_verdict text
    CHECK (first_conclusive_verdict IN ('PROVEN', 'FALSE_SUCCESS')),
  ADD COLUMN IF NOT EXISTS first_conclusive_at timestamptz;

ALTER TABLE receipt.verification_schedule DROP CONSTRAINT verification_schedule_kind_check;
ALTER TABLE receipt.verification_schedule
  ADD CONSTRAINT verification_schedule_kind_check
  CHECK (kind IN ('INITIAL', 'COMPLETION_DEADLINE', 'RETRY', 'MONITORING', 'MONITORING_FINAL'));
