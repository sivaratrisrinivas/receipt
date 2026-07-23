ALTER TABLE receipt.claims DROP CONSTRAINT claims_verdict_check;
ALTER TABLE receipt.claims ADD CONSTRAINT claims_verdict_check
  CHECK (verdict IN ('PENDING', 'PROVEN', 'FALSE_SUCCESS', 'INCONCLUSIVE'));
ALTER TABLE receipt.verification_schedule DROP CONSTRAINT verification_schedule_kind_check;
ALTER TABLE receipt.verification_schedule ADD CONSTRAINT verification_schedule_kind_check
  CHECK (kind IN ('INITIAL', 'COMPLETION_DEADLINE', 'RETRY'));
CREATE TABLE IF NOT EXISTS receipt.verdict_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id text NOT NULL REFERENCES receipt.claims(id),
  verdict text NOT NULL,
  recorded_at timestamptz NOT NULL,
  trigger text NOT NULL
);
