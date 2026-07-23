ALTER TABLE receipt.claims
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0
  CHECK (retry_count >= 0);

ALTER TABLE receipt.claims DROP CONSTRAINT claims_verdict_check;
ALTER TABLE receipt.claims ADD CONSTRAINT claims_verdict_check
  CHECK (verdict IN ('PENDING', 'PROVEN', 'FALSE_SUCCESS', 'INCONCLUSIVE', 'REVERSED'));
