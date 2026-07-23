# Use Neon Postgres for the Payment Ledger

Receipt will use Neon Postgres as the Payment Ledger's authoritative database, with committed schema migrations and repeatable seed/reset commands rather than a SQLite or in-memory fallback. This adds an external setup dependency but gives the demo durable, realistic business state; the application will receive its connection securely through environment configuration, and the Neon project will be provisioned during implementation after the design is complete.
