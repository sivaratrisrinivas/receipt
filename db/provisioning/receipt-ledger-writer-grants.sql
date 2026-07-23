-- Run only after an administrator has explicitly provisioned receipt_ledger_writer.
-- The Refund Service can mutate authoritative refund state, but cannot access Receipt records.
GRANT USAGE ON SCHEMA ledger TO receipt_ledger_writer;
GRANT SELECT, INSERT, UPDATE ON ledger.refunds TO receipt_ledger_writer;
