ALTER TABLE receipt.verification_schedule ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE receipt.verification_schedule DROP CONSTRAINT verification_schedule_claim_id_kind_key;
ALTER TABLE receipt.verification_schedule
  ADD CONSTRAINT verification_schedule_claim_id_kind_due_at_key UNIQUE (claim_id, kind, due_at);
