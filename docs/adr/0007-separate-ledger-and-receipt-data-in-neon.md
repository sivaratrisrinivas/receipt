# Separate ledger and Receipt data in Neon

One Neon project will contain a `ledger` area for authoritative refund state and a `receipt` area for Claims, Contract Versions, Verdict History, and safe evidence references. Separate database permissions will let the Payment Ledger write refund state and let the Verifier read—but never change—that state while recording verification data, keeping setup small without weakening the business-state boundary.
