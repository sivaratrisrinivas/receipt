# Use separate services in one repository

Receipt will implement the support agent, refund service, payment ledger, email service, and verifier as separate small services that communicate over HTTP, while keeping them in one repository with one startup command. This adds some local orchestration work but gives SigNoz a genuine cross-service trace without making the hackathon project difficult to reproduce.
