# Receipt: Hackathon and Platform Constraints

Research date: 2026-07-23 (Asia/Kolkata)

This note verifies the external assumptions behind Receipt against first-party hackathon pages, SigNoz documentation and source, Foundry documentation and source, and OpenTelemetry specifications. It is an input to product grilling and specification; it is not the product specification itself.

## Executive conclusions

Receipt is feasible, with one architectural correction that should govern the whole build:

> SigNoz is the observable evidence store and investigation surface; Receipt's deterministic verifier is the business-state judge.

An absent span cannot prove that a refund is absent. Receipt should query the authoritative ledger (or consume an authoritative ledger result), emit an explicit verification observation, and base `FALSE_SUCCESS` on that negative observation after the completion contract's deadline. Missing or incomplete telemetry should produce `PENDING` or `INCONCLUSIVE`.

The strongest hackathon implementation is therefore:

- A deterministic Receipt verifier producing the immediate proof-card verdict.
- OpenTelemetry traces and correlated logs showing the claim, tool action, business operation, and verifier result.
- SigNoz Query Builder and dashboards aggregating false-success rate, value at risk, and verification latency.
- A SigNoz alert on aggregated false-success telemetry.
- SigNoz MCP for investigation and for creating or inspecting dashboards and alerts—not for the deterministic verdict.

## 1. Hackathon constraints

### Dates and tracks

Agents of SigNoz runs **July 20–26, 2026**. The schedule confirms a July 20 kickoff, but the published pages do not give an exact July 26 cutoff time or timezone. ([overview](https://www.wemakedevs.org/hackathons/signoz), [schedule](https://www.wemakedevs.org/hackathons/signoz/schedule))

The three tracks are:

1. AI & Agent Observability
2. Signals & Dashboards
3. Build Your Own

Every project must use or integrate with SigNoz; the example projects are inspiration rather than restrictions. Receipt fits the AI & Agent Observability track. ([overview](https://www.wemakedevs.org/hackathons/signoz), [rules](https://www.wemakedevs.org/hackathons/signoz/rules))

### Judging

The six published criteria are Potential Impact, Creativity & Innovation, Technical Excellence, Best Use of SigNoz, User Experience, and Presentation Quality. “Best Use of SigNoz” explicitly calls out traces, metrics, logs, dashboards, and alerts. ([judging criteria](https://www.wemakedevs.org/hackathons/signoz#judging))

Implication: using each SigNoz surface should serve the proof story rather than exist as a checklist. A coherent claim-to-evidence trace, decision-oriented dashboard, actionable alert, and MCP investigation will score more credibly than disconnected telemetry demos.

### Team, originality, and disclosure rules

- Teams may contain **1–4 members**. Team composition could change only before the hackathon began. ([rules](https://www.wemakedevs.org/hackathons/signoz/rules))
- Templates, frameworks, open-source libraries, third-party tools, public APIs, and public assets are allowed; the team's original work on top is judged. ([rules](https://www.wemakedevs.org/hackathons/signoz/rules))
- AI assistants are allowed but **must be declared** in the submission; failure to disclose is grounds for disqualification. ([rules](https://www.wemakedevs.org/hackathons/signoz/rules))
- Strategy, written notes, sketches, and diagrams were allowed before the event, but coding and design work should begin only after the hackathon started. The published rules do not clearly define how a participant's own pre-existing implementation may be reused, so the safe course is not to depend on pre-event product code without organizer confirmation. ([rules](https://www.wemakedevs.org/hackathons/signoz/rules))
- IP created during the hackathon belongs to the team. ([rules](https://www.wemakedevs.org/hackathons/signoz/rules))

### Submission status

As of this research date, the project submission form is still described as “coming soon.” The authoritative pages do not yet specify the submission fields, repository visibility, required video length, or precise closing time. ([overview](https://www.wemakedevs.org/hackathons/signoz), [rules](https://www.wemakedevs.org/hackathons/signoz/rules))

Therefore the proposed three-minute demo is a good product constraint, but is **not yet a verified official duration requirement**. Monitor the official page and organizer channels for the form and final cutoff.

### Mandatory versus recommended platform use

The rules require:

- A project that uses or integrates with SigNoz.
- Installation of SigNoz using Foundry.
- Committed `casting.yaml` and `casting.yaml.lock` files so judges can rerun the deployment.

The rules recommend—rather than separately mandate—SigNoz MCP, Query Builder, dashboards, and alerts to improve the submission. ([rules](https://www.wemakedevs.org/hackathons/signoz/rules), [official resources](https://www.wemakedevs.org/hackathons/signoz/resources))

## 2. Foundry reproducibility

### Required deployment shape

A minimal Docker Compose casting uses `apiVersion: v1alpha1`, `kind: Installation`, a metadata name, and `spec.deployment` with `flavor: compose` and `mode: docker`. `foundryctl cast -f casting.yaml` validates the environment, renders deployment files under `pours/`, writes `casting.yaml.lock`, and starts the stack. The underlying stages are `gauge`, `forge`, and `cast`. ([SigNoz Docker/Foundry guide](https://signoz.io/docs/install/docker/), [Foundry CLI reference](https://github.com/SigNoz/foundry/blob/main/docs/reference/cli.md), [casting reference](https://github.com/SigNoz/foundry/blob/main/docs/reference/casting-file.md))

Useful commands are:

```text
foundryctl gauge -f casting.yaml
foundryctl forge -f casting.yaml
foundryctl cast -f casting.yaml
foundryctl cast --no-forge
```

`--no-forge` uses the existing generated state rather than regenerating it. ([Foundry CLI reference](https://github.com/SigNoz/foundry/blob/main/docs/reference/cli.md))

### MCP must be enabled explicitly

The hackathon rules say Foundry installs SigNoz and its MCP server “in one step,” but current Foundry documentation says the MCP component is optional and disabled by default. Receipt must explicitly set `spec.mcp.spec.enabled: true` and rerun `foundryctl cast`; the MCP service then listens on port `8000`. ([hackathon rules](https://www.wemakedevs.org/hackathons/signoz/rules), [SigNoz install guide](https://signoz.io/docs/install/docker/#step-5-enable-the-signoz-mcp-server-optional), [casting reference](https://github.com/SigNoz/foundry/blob/main/docs/reference/casting-file.md#mcp), [Compose + MCP example](https://github.com/SigNoz/foundry/tree/main/docs/examples/docker/compose-mcp))

Interpret the hackathon wording as “one configured cast,” not “MCP appears from the default casting.”

### What the lock file protects

`casting.yaml` is the declared source of truth for the deployment. Current Foundry code merges it with built-in defaults, enriches resolved component state/configuration, writes the resolved YAML object to `casting.yaml.lock`, and then `cast` consumes that generated state. ([casting concept](https://github.com/SigNoz/foundry/blob/main/docs/concepts/casting.md), [forge implementation](https://github.com/SigNoz/foundry/blob/main/internal/foundry/forge.go), [YAML configuration implementation](https://github.com/SigNoz/foundry/blob/main/internal/config/yamlconfig/config.go), [cast implementation](https://github.com/SigNoz/foundry/blob/main/cmd/foundryctl/cast.go))

The CLI documentation's shorthand description of the lock as containing checksums is incomplete: the current generated file is a resolved deployment snapshot, not merely a checksum manifest. It should be generated, committed, and never hand-edited.

### Reproduction recommendation

Foundry supports pinning the installer with `FOUNDRY_VERSION`. The latest official release observed during this research is `v0.2.16` (2026-07-21), which includes an MCP health-check fix. ([getting started](https://github.com/SigNoz/foundry/blob/main/docs/getting-started.md), [v0.2.16 release](https://github.com/SigNoz/foundry/releases/tag/v0.2.16))

Because a normal `cast` reruns `forge` using the invoking Foundry binary's built-in defaults, committing only the casting and lock does not completely protect against future default drift. This is an inference from the documented and implemented flow. The repository should:

1. Pin Foundry `v0.2.16` in setup instructions.
2. Pin important SigNoz/component image versions in `casting.yaml` rather than relying on `latest`.
3. Generate and commit the corresponding `casting.yaml.lock`.
4. Run a clean-machine reproduction before submission.

## 3. SigNoz capabilities relevant to Receipt

### OpenTelemetry ingestion

Self-hosted SigNoz accepts traces, metrics, and logs over OTLP/gRPC on port `4317` and OTLP/HTTP on `4318`. Receipt can use ordinary OpenTelemetry SDKs and Collector pipelines; it does not need a proprietary ingestion client. ([self-hosted ingestion](https://signoz.io/docs/ingestion/self-hosted/overview/))

### Traces and Query Builder

Query Builder is SigNoz's visual query interface for logs, traces, and metrics, and is also available in dashboards and alert rules. Trace Explorer supports raw span lists, full traces, time series, and tables. A full trace opens as a waterfall/flamegraph. ([Query Builder v5](https://signoz.io/docs/userguide/query-builder-v5/), [span details](https://signoz.io/docs/userguide/span-details/))

Trace matching can express direct-child (`A => B`), descendant (`A -> B`), same-trace conjunction (`A && B`), disjunction (`A || B`), and exclusion (`NOT A`) relationships. Receipt can therefore query traces that contain a claim but lack a matching evidence span **in the collected trace**. That query is useful for investigation; it is not by itself authoritative negative business evidence. ([multi-query analysis](https://signoz.io/docs/querying/multi-query-analysis/), [querying traces](https://signoz.io/docs/apm-and-distributed-tracing/querying-traces/))

SigNoz also exposes a programmatic traces query API via `POST /api/v5/query_range`; API access uses a service-account key. ([Traces API](https://signoz.io/docs/apm-and-distributed-tracing/traces-api/), [trace-query payload](https://signoz.io/docs/traces-management/trace-api/payload-model/))

### Logs and correlation

SigNoz can search, filter, aggregate, transform, and alert on OpenTelemetry logs. It correlates logs and traces through the OpenTelemetry trace and span identifiers; a log pipeline parser can normalize non-standard identifiers when necessary. ([logs overview](https://signoz.io/docs/logs-management/overview/), [trace/log correlation](https://signoz.io/docs/traces-management/guides/correlate-traces-and-logs/), [trace parser](https://signoz.io/docs/logs-pipelines/guides/trace/))

Receipt should emit structured evidence details as correlated logs when those details do not belong in span attributes. Avoid putting raw customer or model content into routinely indexed fields.

### Metrics and dashboards

Metrics Explorer supports discovery of ingested OpenTelemetry metrics, temporal and spatial aggregation, grouping, formulas, alert creation, and adding queries to dashboards. Custom Receipt counters and histograms are feasible. ([Metrics Explorer](https://signoz.io/docs/metrics-management/metrics-explorer/))

Dashboards can combine metrics, traces, and logs, use variables, support several panel types, and drill down to underlying telemetry. They can be created in the UI, imported/exported as JSON, or managed through MCP. ([dashboard overview](https://signoz.io/docs/dashboards/overview/), [manage dashboards](https://signoz.io/docs/userguide/manage-dashboards/), [dashboard interactivity](https://signoz.io/docs/dashboards/interactivity/))

### Alerts

SigNoz supports alerts over metrics, logs, traces, anomalies, and exceptions. Trace alerts can filter custom attributes, aggregate/group the result, evaluate formulas, and route notifications. ([alerts overview](https://signoz.io/docs/alerts/), [trace-based alerts](https://signoz.io/docs/alerts-management/trace-based-alerts/))

Alerts should not implement the proof-card response path. Trace alerts evaluate over windows and default to a one-minute evaluation interval, so they are appropriate for aggregated operational notification, not a two-second per-claim verdict. ([trace alert evaluation](https://signoz.io/docs/alerts-management/trace-based-alerts/))

### Official SigNoz MCP

The current official MCP server exposes tools that can:

- Search and aggregate traces and retrieve a complete trace with all spans.
- Search and aggregate logs and discover available fields/values.
- List and query metrics.
- List, retrieve, create, update, delete, and import dashboards.
- List alert instances; list, retrieve, create, update, and delete alert rules; retrieve alert history.
- Execute Query Builder v5 requests, including multi-query requests, formulas, PromQL, and ClickHouse SQL.
- Manage saved Explorer views and notification channels.

([MCP tool inventory](https://signoz.io/docs/ai/signoz-mcp-server/#available-tools), [official end-to-end investigation use case](https://signoz.io/docs/ai/use-cases/trace-failing-request-end-to-end/))

“MCP investigation” means an AI assistant orchestrates those query tools. There is no documented investigation-session object, dedicated Receipt verifier, or business-ledger tool. MCP is excellent for the demo investigation and for provisioning/inspecting dashboards and alerts; an LLM interpreting MCP output should not be in the deterministic verdict path.

For self-hosting, the MCP server needs the SigNoz URL and API key. Tool compatibility also constrains the pinned SigNoz version: alert-rule CRUD requires SigNoz `v0.120.0+`, alert history requires `v0.118.0+`, and metric-usage lookup requires `v0.131.0+`. ([MCP compatibility note](https://signoz.io/docs/ai/signoz-mcp-server/#available-tools))

## 4. OpenTelemetry conventions

### GenAI conventions are still evolving

OpenTelemetry's GenAI semantic conventions have moved into the official `open-telemetry/semantic-conventions-genai` repository and remain at **Development** status. They cover inference, agent, workflow, planning, evaluation, tool execution, and MCP telemetry. ([official GenAI repository](https://github.com/open-telemetry/semantic-conventions-genai), [GenAI status](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/README.md))

Agent telemetry includes operations such as `invoke_agent`, `invoke_workflow`, `plan`, and `execute_tool`, together with `gen_ai.agent.*`, conversation, model, token, and error attributes. ([agent spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md))

An instrumented tool execution should use:

- `gen_ai.operation.name=execute_tool`
- Span name `execute_tool {gen_ai.tool.name}`
- `INTERNAL` span kind
- Required `gen_ai.tool.name`
- Recommended call ID and tool type when available

Tool arguments and results are opt-in because they may be sensitive or large. ([execute-tool convention](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md#execute-tool-span))

Model instructions, inputs, outputs, tool arguments, and tool results should not be captured by default because of privacy, size, access-control, and storage risks. Prefer sanitized identifiers or references. ([content-capture guidance](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md#capturing-instructions-inputs-and-outputs))

### Receipt needs its own namespace

Receipt-specific concepts should use a distinct application namespace rather than inventing `gen_ai.*` or `otel.*` keys. OpenTelemetry reserves `otel.*` and recommends application-specific namespaces for application attributes. ([attribute naming](https://opentelemetry.io/docs/specs/semconv/general/naming/))

A suitable starting set is:

```text
receipt.claim.id
receipt.claim.type
receipt.contract.id
receipt.subject.type
receipt.subject.id
receipt.verdict
receipt.evidence.type
receipt.evidence.status
receipt.evidence.observed_at
receipt.verification.deadline
receipt.user_impact.amount
```

Standard GenAI fields should remain on agent and tool spans, such as `gen_ai.operation.name`, `gen_ai.agent.name`, `gen_ai.tool.name`, and `gen_ai.tool.call.id`.

### Trace/log correlation and asynchronous work

OpenTelemetry LogRecords have top-level `TraceId`, `SpanId`, and `TraceFlags` fields for correlation. ([logs data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/), [log correlation](https://opentelemetry.io/docs/specs/otel/logs/#log-correlation))

SigNoz trace matching operates inside one trace. Delayed settlement may occur after the original request or in a separate asynchronous trace, while OpenTelemetry supports producer/consumer modeling and links between causally related spans. Carry a stable business correlation key such as a sanitized refund ID across all signals and optionally use span links; do not assume SigNoz's within-trace matching traverses cross-trace links. ([SigNoz trace matching](https://signoz.io/docs/querying/multi-query-analysis/#trace-matching), [OpenTelemetry traces and links](https://opentelemetry.io/docs/concepts/signals/traces/))

## 5. Corrections to the proposed Receipt description

### Correction 1: absence of telemetry is not proof of absence in reality

Sampling, network/export failure, and incomplete instrumentation can all create missing spans or incomplete traces. ([SigNoz missing-span troubleshooting](https://signoz.io/docs/traces-management/troubleshooting/faqs/), [SigNoz ingestion retries and queues](https://signoz.io/docs/ingestion/self-hosted/overview/))

The safe rule is:

| Observation | Verdict implication |
| --- | --- |
| Authoritative ledger lookup confirms the expected record | Evidence may satisfy the contract |
| Authoritative lookup completed after the deadline and confirms no matching record | `FALSE_SUCCESS` |
| Evidence span/log is absent, but no authoritative negative check completed | `PENDING` or `INCONCLUSIVE` |
| Telemetry/export health is degraded | `INCONCLUSIVE` |

The verifier should emit an explicit span/log for the check result. The trace can then open at a verifier span annotated “required ledger evidence not found”; it cannot literally open at a database event that does not exist.

### Correction 2: SigNoz is not independently authoritative by itself

SigNoz can preserve, correlate, query, visualize, and alert on what instrumented systems send it. Its published APIs do not query Receipt's ledger as a business database. Therefore “SigNoz as independent witness” is accurate only if the verifier or ledger produces trustworthy evidence telemetry. The business-state read must happen in a deterministic Receipt adapter or authoritative service, and SigNoz records the resulting proof trail.

### Correction 3: a two-second verdict is not a default telemetry property

The OpenTelemetry environment specification gives the Batch Span Processor a default export delay of `5000 ms` and periodic metric export a default interval of `60000 ms`. Collectors may also queue and retry exports. ([OpenTelemetry SDK environment variables](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#batch-span-processor), [SigNoz self-hosted ingestion](https://signoz.io/docs/ingestion/self-hosted/overview/))

Consequences:

- The immediate proof card should call the deterministic verifier directly.
- Receipt should emit verdict telemetry for later SigNoz query/dashboard/alert consumption.
- If the demo also needs the trace visible within two seconds, explicitly tune and test span export/flush behavior; do not assume defaults meet the threshold.
- Metrics should not gate the proof card.

### Correction 4: delayed failures require temporal verdict semantics

A provider that can reject a refund later makes “PROVEN within two seconds” provisional unless the completion contract defines the authoritative state and its settlement deadline. The spec should distinguish at least:

- `PENDING`: the contract window is still open.
- `PROVEN`: authoritative evidence satisfies the contract at the observation time.
- `FALSE_SUCCESS`: the agent claimed completion but an authoritative post-deadline check disproved it.
- `INCONCLUSIVE`: the verifier or evidence channel could not establish the state.
- A revision mechanism for a previously proven claim invalidated by a later provider transition (the eventual name is a domain decision).

This is a domain consequence of asynchronous settlement, not a SigNoz feature limitation.

### Correction 5: MCP is an investigation aid, not the judge

MCP can retrieve complete traces, query signals, and manage dashboards and alerts, but it does not make the ledger authoritative and has no dedicated Receipt investigation entity. Use MCP to explain and navigate the failure after Receipt has produced a deterministic verdict. ([MCP tools](https://signoz.io/docs/ai/signoz-mcp-server/#available-tools))

### Correction 6: some proposed telemetry names should change

Keep the standardized `gen_ai.*` attributes defined by OpenTelemetry, but move custom claim/evidence concepts under `receipt.*`. In particular, replace proposed custom-looking fields such as `agent.claim.type`, `completion.contract_id`, `side_effect.expected`, and `verification.result` with a coherent `receipt.*` namespace. This avoids implying that Receipt fields are official GenAI conventions. ([OpenTelemetry naming guidance](https://opentelemetry.io/docs/specs/semconv/general/naming/))

## 6. Recommended prototype acceptance test

Before committing to the full build, the prototype should prove the following vertical slice:

1. Foundry `v0.2.16` produces a clean self-hosted SigNoz deployment from committed casting inputs with MCP explicitly enabled.
2. A support-agent run carries one claim ID and sanitized refund ID through the agent, tool, refund service, ledger, and verifier.
3. Genuine success produces an authoritative positive ledger check and a `PROVEN` verifier span.
4. False success produces an authoritative negative post-deadline ledger check and a `FALSE_SUCCESS` verifier span—not merely a missing child span.
5. SigNoz Trace Explorer shows the narrative and correlated logs.
6. Query Builder can aggregate the two verdicts and calculate the desired counters/rates.
7. A dashboard panel and an alert consume emitted verdict telemetry.
8. MCP can find the failed run and retrieve its complete trace.
9. The proof card receives its verdict directly from Receipt within the target latency; SigNoz visibility latency is measured separately.

If this slice works, the central architecture is proven. If it fails, the failure will reveal whether the blocker is Foundry deployment, telemetry propagation, business correlation, SigNoz query behavior, or UI latency before the full product is specified.

## 7. Items to monitor before submission

- Publication of the project submission form and exact July 26 cutoff/timezone.
- Any official repository, video, or demo-duration requirements added to the form.
- Organizer clarification on reuse of a participant's own pre-existing code if relevant.
- The Foundry/SigNoz versions actually generated into `casting.yaml.lock` after the final casting.
- A clean reproduction run on the intended WSL/Linux + Docker environment.
- Explicit disclosure of AI-assistant use in the submission.

