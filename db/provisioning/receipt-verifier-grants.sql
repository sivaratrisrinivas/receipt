-- Run only after an administrator has explicitly provisioned receipt_verifier.
-- This role may inspect authoritative refund state but cannot change it.
GRANT USAGE ON SCHEMA ledger TO receipt_verifier;
GRANT SELECT ON ledger.refunds TO receipt_verifier;

GRANT USAGE ON SCHEMA receipt TO receipt_verifier;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA receipt TO receipt_verifier;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA receipt TO receipt_verifier;
