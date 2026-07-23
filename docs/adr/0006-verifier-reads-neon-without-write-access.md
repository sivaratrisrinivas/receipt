# Verifier cannot write Payment Ledger state

The Verifier will inspect the Payment Ledger directly through a Neon role with read-only access to the `ledger` area instead of trusting the service that attempted the refund to report its own success. It may write its Claims and Verdict History in the separate `receipt` area. This deliberately couples the refund verification adapter to the small ledger read model, but creates an independent deterministic check and prevents verification code from changing the business state it judges.
