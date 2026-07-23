# Receipt deferred work

Last reviewed: 2026-07-23 (Asia/Kolkata)

This file is the durable queue for work intentionally left after the
pre-prototype wiring pass. It prevents open gates and prototype findings from
being mistaken for completed infrastructure. Product terms follow
`CONTEXT.md`.

## Current boundary

As of 2026-07-24, authenticated MCP validation is an external integration gate,
not a blocker for the pure `refund_completed` state-model prototype. The
prototype may proceed without claiming that Neon permissions, SigNoz data
queries, dashboards, alerts, or MCP investigation work. Those claims remain
blocked until their real integrations pass.

The repository-owned, pinned SigNoz stack is running and healthy. On
2026-07-23, the non-strict `scripts/signoz-doctor.sh` passed Foundry,
immutable-image, Compose, SigNoz health, MCP liveness/readiness, and
unauthenticated-request rejection. It skipped service-account authentication
because `SIGNOZ_API_KEY` was unavailable.

## Capacity observation

### WSL memory

Status: **sufficient to begin; monitor during the combined workload**

Current observation:

- WSL exposes 4,021,948,416 bytes, displayed by Linux as about 3.7 GiB, plus
  1 GiB swap.
- The repository-owned SigNoz stack and every non-authenticated doctor check
  are healthy at this allocation.
- The current official SigNoz Docker guide requires at least 4 GB allocated
  to Docker. It does not require 6 GB.

No host change is required before the prototype. During the Receipt vertical
slice, watch for OOM kills, container restarts, heavy swapping, or unreliable
timing measurements. If those symptoms appear, add optional headroom with a
larger `.wslconfig` allocation and restart WSL from Windows PowerShell.

Official source:
<https://signoz.io/docs/install/docker/#prerequisites>

## Pre-prototype gates

### 1. Create the SigNoz investigation identity

Status: **ready for the documented SigNoz administrator action**

Human action in local SigNoz:

1. Create the `receipt-investigator` service account.
2. Assign only the managed `SigNoz-Viewer` role.
3. Generate the one-time key `local-investigation`.
4. Store it in the ignored local `.env` file as `SIGNOZ_API_KEY`.

Never paste or print the key in chat, command arguments, committed files, or
logs.

Acceptance:

```bash
set -a
source .env
set +a
REQUIRE_SIGNOZ_AUTH=1 ./scripts/signoz-doctor.sh
```

The strict doctor must pass `GET /api/v1/service_accounts/me`.

### 2. Prove one authenticated read-only MCP query

Status: **deferred; blocked by gate 1**

After the key is loaded into the environment and Codex has been restarted,
run one real read such as `signoz_list_services`. Confirm that the
project-scoped MCP client still exposes only the read/investigation allow-list
in `.codex/config.toml`.

Any WSL Node command for a standalone MCP test client requires explicit user
approval. Keep the key in the inherited environment/header, never in the
command argument.

### 3. Close the infrastructure milestone

Status: **partially complete; authenticated closure blocked by gates 1–2**

After all gates pass:

1. Update only the remediation/status section of
   `docs/research/receipt-wiring-verification-2026-07-23.md`.
2. Run `git diff --check`.
3. Run `bash -n scripts/signoz-doctor.sh`.
4. Run the strict authenticated doctor again.
5. State explicitly that pre-prototype infrastructure is green.

## Prepared prototype

Status: **authorized to proceed on 2026-07-24 without external integrations**

### Question

Can one clean, reproducible, privacy-safe `refund_completed` slice satisfy the
agreed Claim lifecycle and latency model while SigNoz remains an
Evidence-Trail/investigation layer rather than a source of business truth?

### Shape

Use the `prototype` skill's **logic** branch because the uncertainty is the
Claim/Refund state model and integration boundary, not visual styling.

The throwaway shell should be a tiny terminal driver around a pure explicit
state machine. It must render the complete Claim, Refund State, Verification
Schedule, current Verification Verdict, Verdict History, and Evidence Trail
Health after every action. Persistence and permissions are part of this
question, so the prototype may use an explicitly disposable Neon branch or
scratch database; no in-memory fallback may be used to claim that Neon
permissions work.

The terminal shell is disposable. Any validated state-machine decision must
be captured in a findings note before the shell is deleted or absorbed into
the production specification.

### Minimum actions to exercise

- Recognize one `refund_completed` Claim bound to one trusted Refund Reference.
- Perform immediate, Completion Deadline, monitoring, final, retry, and
  Investigator Recheck triggers.
- Move Refund State through missing, `PROCESSING`, `SUCCEEDED`, and `REJECTED`
  cases using only legal transitions.
- Demonstrate `PENDING → PROVEN`.
- Demonstrate `PENDING → FALSE_SUCCESS` only after a fresh authoritative
  post-deadline read.
- Demonstrate `PROVEN → REVERSED`.
- Demonstrate `FALSE_SUCCESS → PROVEN` as Late Success without rewriting the
  First Conclusive Verdict.
- Demonstrate a failed authoritative recheck producing `INCONCLUSIVE`, then
  recovery without restarting the original Monitoring Window.
- Remove telemetry independently and show Evidence Trail Health degrade
  without changing a supported Verification Verdict.

### Vertical-slice evidence still to produce

- A trusted Refund Reference propagates through support workflow, Refund
  Service, Payment Ledger, Verifier, and privacy-safe telemetry.
- Neon roles allow the Verifier to read `ledger` and write `receipt`, while a
  direct attempt to mutate `ledger` fails.
- Proof Card updates are driven by Receipt independently of telemetry
  ingestion.
- Privacy-safe traces, correlated logs, and metrics are queryable in SigNoz.
- One real dashboard panel consumes the emitted metrics.
- The agreed False Success Spike alert consumes the same production-shaped
  signals.
- An authenticated MCP investigation can read the resulting service, trace,
  log, metric, dashboard, and alert history without mutation access.
- Proof Card update latency and SigNoz trace visibility latency are measured
  separately.
- Seed/reset and acceptance commands use the same service and database path
  as the proposed product.
- Exact versions, commands, measurements, permissions, failures, and
  workarounds are captured in a findings artifact under `docs/research/`.

## Deferred until after the slice

- Run a clean, empty-volume Foundry rehearsal only in a disposable environment
  or after explicit authorization to remove or isolate existing SigNoz data.
- Expand from the minimum slice to all five deterministic acceptance
  scenarios and the 50-run evaluation corpus through the same product path.
- Validate every correctness, freshness, dashboard, and alert gate in
  `PRODUCT.md`.
- Resolve implementation-time visual tokens and components still marked as
  placeholders in `DESIGN.md`.
- Recheck the hackathon submission form, exact cutoff/timezone, required
  artifacts, and AI-assistant disclosure when the official details are
  published.
- Reconcile only evidence-backed prototype findings into `PRODUCT.md`,
  `CONTEXT.md`, `DESIGN.md`, or a new ADR; then continue through specification
  and implementation tickets.

## Safety constraints

- Do not commit, push, provision Neon, or mutate external resources without
  explicit authorization.
- Do not delete or reset existing SigNoz volumes without explicit
  authorization.
- Do not add MCP create, update, import, or delete tools to the Investigator
  client.
- Do not create a parallel demo application. Seeded scenarios must exercise
  the single production path.
- Receipt never performs Remediation, and telemetry never determines a
  Verification Verdict.
