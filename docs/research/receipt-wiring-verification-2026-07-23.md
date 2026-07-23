# Receipt wiring verification

Verified 2026-07-23 in the project's WSL environment. This is a point-in-time audit of official requirements, current local infrastructure, and the agreed Receipt MVP. It does not claim that the unimplemented application path works.

## Verdict

The **MVP design is aligned**, and the **local SigNoz base stack is healthy**, but Receipt is **not yet wired end to end or reproducible from this repository**.

- The host is Ubuntu 22.04 under WSL 2, with an active Docker Engine whose server root is `/var/lib/docker`; this is the native-WSL shape required by the current SigNoz guide.
- Foundry `v0.2.16` is installed.
- The SigNoz UI responds on `localhost:8080`; OTLP ports `4317` and `4318` are published; the MCP container is running and its `/livez` endpoint responds on loopback-only `localhost:8001`.
- The casting and lock that created this stack are under `/home/srinivas/signoz`, not in Receipt. Receipt currently has no `casting.yaml`, `casting.yaml.lock`, generated application, instrumentation, dashboard, alert, or executable MCP investigation.
- MCP liveness is proven, but authenticated SigNoz access is not. No service-account key was validated, and no `signoz` MCP server is configured in the inspected Codex configuration.

The correct next milestone is one production-quality vertical slice that moves a real `refund_completed` Claim through the support agent, refund service, Neon Payment Ledger, Verifier, Proof Card, OpenTelemetry, SigNoz, and authenticated MCP. Seeded cases must drive this same path; they must not become a parallel demo application.

## Official requirements verified

The [SigNoz introduction](https://signoz.io/docs/introduction/) presents traces/APM, logs, metrics, Query Builder, dashboards, alerts, and Trace Explorer as first-class product surfaces, with self-hosting through Docker as a supported deployment. That matches Receipt's agreed use of SigNoz as the connected evidence and investigation surface rather than as a decorative trace viewer.

### WSL, Docker, and Foundry

The current [SigNoz Docker installation guide](https://signoz.io/docs/install/docker/) requires Windows users to run everything in WSL 2 with Docker Engine installed natively inside the distribution, not through Docker Desktop's WSL integration. It requires Docker Engine 20.10+, Compose v2, at least 4 GB available to Docker, UI port `8080`, OTLP ports `4317`/`4318`, and port `8000` when MCP is enabled. Foundry is now the supported Docker Compose installation path; the legacy install script and repository Compose bundle are deprecated.

`foundryctl cast -f casting.yaml` validates the environment, generates Compose files under `pours/deployment`, writes `casting.yaml.lock`, and starts the stack. Generated `pours` files must not be hand-edited because Foundry overwrites them.

### MCP enablement and authentication

Despite the hackathon rule's shorthand that Foundry installs SigNoz and MCP “in one step,” the current [Docker guide, Step 5](https://signoz.io/docs/install/docker/#step-5-enable-the-signoz-mcp-server-optional) says MCP is disabled by default. A reproducible casting must include:

```yaml
spec:
  mcp:
    spec:
      enabled: true
```

After recasting, `/livez` proves only MCP server health. An actual investigation requires an API key from a SigNoz service account and the `SIGNOZ-API-KEY` header on the MCP client request.

The [service-account documentation](https://signoz.io/docs/manage/administrator-guide/iam/service-accounts/) requires an appropriately privileged user to create the account, assign managed or custom roles, and generate a key. The key is shown once, may be given an expiry, must be stored securely, and authenticates API requests through `SIGNOZ-API-KEY`. `GET /api/v1/service_accounts/me` is the documented validation call: `200` is valid; `401` is not. A key must never be committed.

The [MCP server documentation](https://signoz.io/docs/ai/signoz-mcp-server/) shows that MCP exposes both read operations and mutations for dashboards, alerts, saved views, and notification channels. Receipt therefore must not assume “MCP access” is inherently read-only. The Investigator credential should receive only the SigNoz transactions needed for telemetry investigation; any separate setup credential used to provision dashboards and alerts should be kept out of the running Receipt application.

### Hackathon

The official [overview](https://www.wemakedevs.org/hackathons/signoz), [rules](https://www.wemakedevs.org/hackathons/signoz/rules), [schedule](https://www.wemakedevs.org/hackathons/signoz/schedule), and [resources](https://www.wemakedevs.org/hackathons/signoz/resources) currently establish:

- Agents of SigNoz runs July 20–26, 2026. The published schedule still gives no exact July 26 cutoff time.
- Every project must use or integrate with SigNoz. Receipt naturally fits Track 1, AI & Agent Observability.
- Foundry is mandatory. The repository **must** contain `casting.yaml` and `casting.yaml.lock` because judges may recast them.
- MCP, Query Builder, dashboards, and alerts are recommended; judging explicitly rewards deep, effective use of traces, metrics, logs, dashboards, and alerts.
- AI assistants are permitted but must be declared in the submission; omission is disqualifying.
- README, demo, and submission clarity affect Presentation Quality, but the official pages do not currently mandate a three-minute video.
- The submission form and its final artifact checklist are still unpublished.

## Current local wiring

| Check | Observed | Assessment |
| --- | --- | --- |
| Host | Ubuntu 22.04.5, WSL 2 kernel | Matches the required platform shape |
| Docker server | Engine 29.5.3, active in WSL, root `/var/lib/docker` | Matches native-WSL guidance |
| Compose | v5.1.4 | Exceeds Compose v2 prerequisite |
| WSL memory visible to Docker | 4,021,948,416 bytes, reported as 3.7 GiB | Approximately a 4 GB nominal allocation; the stack is healthy, so this meets the small local-test purpose but leaves little workload headroom |
| Foundry | `v0.2.16` | Matches the version selected in existing research |
| SigNoz | Container healthy; UI HTTP `200` on `localhost:8080` | Base UI is live |
| OTLP | Collector publishes `4317` and `4318` | Listener publication is proven; Receipt export and SigNoz ingestion are not |
| MCP | Container up; `/livez` HTTP `200` on `127.0.0.1:8001` | Server is live and safely host-bound to loopback |
| Casting | Exists at `/home/srinivas/signoz/casting.yaml`; enables MCP and patches `127.0.0.1:8001:8000` | Sensible local setup, but outside Receipt and uses a non-default host port that README/client config must document |
| Lock | Exists at `/home/srinivas/signoz/casting.yaml.lock` | Not useful to judges until generated from and committed with Receipt's casting |
| Images | SigNoz, collector, and MCP resolve from `latest` | Reproduction can drift; pin compatible versions for the submitted build |
| MCP identity | No validated service-account request and no configured Codex `signoz` MCP server found | Authentication and usable investigation remain unproven |
| Receipt application | Repository contains product/domain/design/research documents only | No end-to-end application wiring exists yet |

The custom host mapping `127.0.0.1:8001:8000` is not itself a defect: it limits host exposure and avoids a local port collision. It must be preserved in the repository casting, documented consistently, and used by the MCP client as `http://localhost:8001/mcp`. Inside the Compose network, the MCP service still reaches SigNoz at its generated service address.

## Agreed MVP versus the original Receipt description

The original description and the current [Product](../../PRODUCT.md), [domain language](../../CONTEXT.md), [design](../../DESIGN.md), and ADRs describe the same bounded product:

| Original MVP intent | Agreed production-quality MVP |
| --- | --- |
| One customer-support refund scenario | One fully verified Claim Type, `refund_completed` |
| Refund service, Payment Ledger, and email service | Separate small services in one repository; Neon is the real authoritative Payment Ledger rather than an in-memory mock |
| Compare the agent's claim with real external state | Independent Claim Recognition plus a deterministic, read-only Verifier bound to a trusted Refund Reference |
| Green/red proof card | A safer lifecycle: `PENDING`, `PROVEN`, `FALSE_SUCCESS`, `INCONCLUSIVE`, and `REVERSED`, with preserved Verdict History |
| Cross-service trace, logs, metrics, dashboard, alert, and MCP | All retained; SigNoz explains and aggregates evidence but never substitutes for the authoritative ledger read |
| Genuine success and false success runs | Acceptance fixtures were expanded to cover those core outcomes plus telemetry loss, reversal, and unresolved recognition through the same code path |
| 50 synthetic validation runs | A deterministic 50-run corpus with stricter correctness and customer-semantics gates |
| No enterprise platform or autonomous remediation | Still explicitly out of scope |

The refinements do not broaden Receipt into a generic agent platform. They close correctness holes in the original sketch: missing telemetry cannot prove missing money, an unrelated refund cannot prove a Claim, and a later provider reversal cannot erase historical truth. The five seeded scenarios and compressed timings are fixtures for the real product path, not demo-only behavior.

## Mismatches to resolve before implementation can be called “wired”

1. **Required Foundry artifacts are absent from Receipt.** Copying files blindly is insufficient: create the repository casting, pin compatible images, run Foundry from it, and commit the newly generated matching lock.
2. **The running stack is infrastructure-only.** No Receipt service emits a trace, metric, or correlated log; no Verifier observation is visible in SigNoz.
3. **MCP authentication is unverified.** Create a purpose-specific service account, store its key outside Git, validate `/api/v1/service_accounts/me`, connect the client to `localhost:8001/mcp`, and prove a read such as “list available services.”
4. **MCP permissions need deliberate separation.** Runtime investigation should not inherit dashboard/alert/channel mutation just because the server exposes those tools. Use a separate provisioning path or credential if dashboard and alert creation is automated.
5. **The environment has little memory headroom.** The Docker server sees a
   nominal allocation of about 4 GB, reported by Linux as 3.7 GiB. The healthy
   stack is sufficient to begin the prototype under the current Docker guide;
   monitor swapping, OOM kills, container restarts, and timing variance, and
   increase WSL memory only if the combined Receipt acceptance workload needs
   it.
6. **`latest` image tags undermine reproducibility.** Pin versions known to support the MCP operations Receipt uses, regenerate the lock, and document the Foundry version.
7. **No clean recast has been proven from this repository.** Judges' actual path—clone, configure secrets, cast, migrate/seed Neon, start Receipt, run acceptance cases—must be exercised.
8. **Submission details remain volatile.** Recheck the official form, cutoff/timezone, and artifact fields when published; explicitly record AI-assistant use.

## Assumptions that require prototype validation

These are architecturally reasonable but cannot be certified from documentation or container health:

- Receipt can propagate one privacy-safe Claim/Refund correlation across agent, tool, refund service, Payment Ledger trigger, Verifier, and asynchronous traces.
- Neon roles actually prevent the Verifier from mutating `ledger` state while allowing it to write Receipt records.
- The authoritative check and durable schedule satisfy the two-second customer update gates.
- Tuned OpenTelemetry export makes a complete trace visible in SigNoz within the five-second target.
- The chosen metrics support the six dashboard panels and the False Success Spike formula without high-cardinality identifiers.
- The MCP service account can read the required traces, logs, metrics, dashboard, and alert history while remaining unable to perform unintended mutations.
- SigNoz deep links from the Evidence View remain stable for the pinned version.
- The 50-run corpus drives the normal production path and passes the agreed correctness gates.

## Production-quality vertical-slice exit criteria

Before expanding beyond the slice, prove all of the following from a clean checkout:

1. Repository `casting.yaml` and its generated lock recreate healthy SigNoz and MCP in native WSL Docker.
2. Secrets are supplied through ignored environment/configuration; no Neon or SigNoz key is committed.
3. The client performs an authenticated, least-privilege MCP telemetry read.
4. One genuine refund produces `PENDING → PROVEN`; one skipped/deceptive refund produces `PENDING → FALSE_SUCCESS` only after an authoritative post-deadline Neon read.
5. Both paths emit privacy-safe traces, correlated logs, and metrics that are queryable in SigNoz.
6. The Proof Card gets its verdict from Receipt, independent of telemetry ingestion latency.
7. One dashboard panel, the real alert rule, and the MCP investigation consume those same signals.
8. Seed/reset and acceptance commands use the same services and database path as the product.
9. The README documents native WSL Docker, Foundry/MCP port `8001`, service-account setup, Neon setup, clean reproduction, known limitations, and AI-assistant disclosure.

Passing this slice is the point at which “wired properly” becomes an evidence-backed statement. The current environment is a good base for it, not yet the completed wiring.

## Remediation update — 2026-07-23

The following pre-prototype infrastructure gaps were closed after the audit:

- Receipt now owns `casting.yaml` and its matching Foundry-generated
  `casting.yaml.lock`.
- SigNoz, the OpenTelemetry collector, MCP server, Postgres, ClickHouse
  server, and ClickHouse Keeper are pinned to the exact working image digests;
  the generated Compose file contains no `latest` image.
- SigNoz UI, OTLP/gRPC, OTLP/HTTP, and MCP host ports are all bound to
  `127.0.0.1`.
- Foundry `v0.2.16` successfully recast the running stack from the repository
  configuration while preserving the existing named data volumes.
- `scripts/signoz-doctor.sh` passed the Foundry gauge, immutable-image,
  Compose validation, SigNoz health, and MCP liveness checks after that recast.
- `.codex/config.toml` configures the local MCP endpoint, sources the
  `SIGNOZ-API-KEY` header from the environment, and allow-lists only read and
  investigation tools. Mutation tools remain outside the runtime client
  surface.
- Secret-bearing `.env` files and generated `pours/` files are ignored.
- WSL Node.js was located and executed successfully through NVM at `v24.18.0`;
  the repository now includes a matching `.nvmrc`. The earlier statement that
  Node.js was not installed was a sandbox/PATH false negative.

The following items remain genuine gates:

- An administrator must create the `receipt-investigator` service account,
  assign only the managed `SigNoz-Viewer` role, create its one-time key, and
  export it locally as `SIGNOZ_API_KEY`. The authenticated
  `/api/v1/service_accounts/me` check and a real MCP read remain unproven until
  that secret is available to the local process.
- WSL reports about 3.7 GiB from its nominal 4 GB allocation. The current
  SigNoz stack is healthy, so this is not a pre-prototype gate. Monitor memory
  during the combined Receipt workload and increase the WSL allocation if OOM
  kills, container restarts, heavy swapping, or unreliable timings appear.
- The recast proves this repository controls the live stack, but retained the
  existing data volumes. A destructive empty-volume rehearsal should occur
  only after explicitly deciding that the local SigNoz data can be discarded
  or after using a disposable environment.
- Receipt telemetry, Neon permissions, dashboards, alerts, and end-to-end
  Claim/Verdict behavior are application evidence. They belong to the single
  vertical-slice prototype and cannot honestly be certified before it exists.
