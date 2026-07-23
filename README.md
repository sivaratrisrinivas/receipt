# Receipt

Receipt checks important promises made by AI agents against the system that
actually owns the result. It does not trust a tool call, an HTTP success, or a
trace by itself.

The first working path checks one promise: **“your refund is complete.”** A
trusted support workflow creates a private Refund Reference before the agent
speaks. Receipt recognizes the supported promise, asks the Payment Ledger for
the real Refund State, and shows a simple Proof Card:

- `PENDING`: Receipt is still waiting for the deadline.
- `PROVEN`: the ledger says the refund succeeded.
- `FALSE_SUCCESS`: the deadline passed and the ledger did not show success.
- `INCONCLUSIVE`: Receipt could not safely read the ledger and will retry.

The customer sees only the verdict, reason, and next step. Investigators can
later use the separate evidence path. Raw conversations, payment details, and
database credentials do not belong in Receipt records or Git.

## Run the refund check locally

Use Node.js 24.18.0 and an ignored `.env` file:

```bash
nvm use
npm install
cp .env.example .env
# Set VERIFIER_DATABASE_URL and LEDGER_DATABASE_URL to their purpose-specific Neon roles.
npm test
npm start
```

The support workflow first sends `POST /trusted-refund-references` with a
Message Reference. It then sends the agent’s final statement and that Message
Reference to `POST /trusted-promises`. Receipt stores the Claim, its Completion
Contract, every authoritative check, its Verdict History, and durable
verification work in Neon. The scheduler resumes uncompleted work after a
restart.

The separately bound Refund Service listens on `REFUND_SERVICE_PORT` (default
`3001`). `POST /refunds/complete` accepts the trusted Refund Reference and
uses the Ledger writer role to move a refund through its legal states. Every
actual state change causes Receipt to perform a new independent Ledger read;
the service response itself never proves a Claim.

## Verify refund completion against Neon

An administrator must apply the committed migrations and explicitly provision
the two database roles before the application is started. This is a deliberate
external database action; never put an administrator URL in `.env` or Git.

```bash
# With an administrator connection supplied only for this shell:
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_pending_refund_claim.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0002_record_deadline_verdicts.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0003_claim_schedule_work.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0004_monitor_proven_refunds.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/provisioning/receipt-verifier-grants.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/provisioning/receipt-ledger-writer-grants.sql

# With only purpose-specific URLs in ignored .env:
npm run acceptance:refund
```

The acceptance command starts the same Support Workflow, Refund Service, and
Verifier used by `npm start`. It proves `PENDING → PROVEN`, repeats the refund
request to confirm idempotency, and emits a privacy-safe proof-card update
latency measurement. Telemetry visibility is intentionally reported separately
and remains outside this issue's Evidence Trail work.

The project is deliberately still small. Its product goals, planned Evidence
View, SigNoz dashboard, and later Claim Types are described in
[PRODUCT.md](PRODUCT.md). The terminal prototype under `prototypes/` is prior
art for state decisions, not the production path.

## Local SigNoz foundation

Receipt uses SigNoz through Foundry on native Docker Engine inside WSL 2.
The committed [casting.yaml](casting.yaml) enables the SigNoz MCP server and
pins every container image by digest. Foundry-generated `pours/` files are
deliberately ignored; [casting.yaml.lock](casting.yaml.lock) is the committed,
reproducible resolved configuration.

Prerequisites:

- WSL 2 with at least 4 GB allocated to Docker, as required by the SigNoz
  Docker guide. More memory is optional headroom for the later Receipt
  acceptance workload, not a SigNoz installation requirement.
- native Docker Engine and Docker Compose v2 inside WSL
- Foundry `v0.2.16`
- Node.js `24.18.0` inside WSL for the later Receipt application and MCP test
  client (`nvm use` reads the committed [.nvmrc](.nvmrc))

Generate and start the pinned stack:

```bash
./scripts/signoz-up.sh
```

Local endpoints are loopback-only:

| Surface | Endpoint |
| --- | --- |
| SigNoz UI/API | `http://127.0.0.1:8080` |
| OTLP/gRPC | `http://127.0.0.1:4317` |
| OTLP/HTTP | `http://127.0.0.1:4318` |
| SigNoz MCP | `http://127.0.0.1:8001/mcp` |
| MCP liveness | `http://127.0.0.1:8001/livez` |

Run the infrastructure checks after casting:

```bash
./scripts/signoz-doctor.sh
```

## Read-only MCP investigation

In SigNoz, open **Settings → Service Accounts**, create
`receipt-investigator`, assign only the managed **SigNoz-Viewer** role, and add
a key named `local-investigation`. Do not assign SigNoz-Editor or SigNoz-Admin,
and do not use an administrator or provisioning key for runtime investigation.

SigNoz requires an API key for access to its observability APIs. Foundry keeps
the MCP deployment secret-free and the client sends its own credential. Store
the key only in the ignored local `.env`, then launch Codex through the WSL
wrapper so the key is available to the client process:

```bash
cp .env.example .env
# Edit .env and set SIGNOZ_API_KEY to the key shown once by SigNoz.
./scripts/codex-with-signoz.sh --doctor
./scripts/codex-with-signoz.sh
```

The trusted project-scoped [.codex/config.toml](.codex/config.toml) maps the
`SIGNOZ_API_KEY` environment variable to the `SIGNOZ-API-KEY` request header
and allow-lists read/investigation tools. The value is never written to the
Codex configuration or casting files. Dashboard, alert, saved-view, and
notification-channel mutation tools are not exposed to the Receipt
investigation client. Inside Codex, run `/mcp` and confirm `signoz` is
connected.

Provisioning dashboards and alerts is a separate operator action and must use a
separate credential. No SigNoz or Neon key belongs in Git; `.env` files are
ignored, and [.env.example](.env.example) contains names only.

## Reproduction boundary

The infrastructure checks above prove the pinned local SigNoz/MCP foundation.
Receipt application telemetry, the Neon roles, the Proof Card lifecycle,
dashboard, alert, and authenticated investigation query are intentionally
proved by the next vertical-slice phase through the single production path
defined in [PRODUCT.md](PRODUCT.md). Seeded acceptance cases must never become
a parallel demo implementation.

Use of AI coding assistants must be disclosed in the hackathon submission.
