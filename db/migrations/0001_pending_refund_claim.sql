CREATE SCHEMA IF NOT EXISTS ledger;
CREATE SCHEMA IF NOT EXISTS receipt;

CREATE TABLE IF NOT EXISTS ledger.refunds (
  refund_reference text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('PROCESSING', 'SUCCEEDED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS receipt.contract_versions (
  version text PRIMARY KEY,
  claim_type text NOT NULL,
  completion_deadline_ms integer NOT NULL CHECK (completion_deadline_ms > 0)
);

CREATE TABLE IF NOT EXISTS receipt.trusted_refund_references (
  message_reference text PRIMARY KEY,
  refund_reference text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receipt.claims (
  id text PRIMARY KEY,
  claim_type text NOT NULL,
  message_reference text NOT NULL UNIQUE,
  refund_reference text NOT NULL REFERENCES receipt.trusted_refund_references(refund_reference),
  contract_version text NOT NULL REFERENCES receipt.contract_versions(version),
  recognized_at timestamptz NOT NULL,
  completion_deadline_at timestamptz NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('PENDING', 'PROVEN')),
  last_checked_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS receipt.authoritative_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id text NOT NULL REFERENCES receipt.claims(id),
  checked_at timestamptz NOT NULL,
  refund_state text NOT NULL,
  trigger text NOT NULL
);

CREATE TABLE IF NOT EXISTS receipt.verification_schedule (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id text NOT NULL REFERENCES receipt.claims(id),
  kind text NOT NULL CHECK (kind IN ('INITIAL', 'COMPLETION_DEADLINE')),
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  UNIQUE (claim_id, kind)
);
