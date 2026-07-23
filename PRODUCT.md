# Product

## Register

product

## Users

The primary user is a customer who has received an important promise from an AI agent and needs to know whether it really happened. They should be able to understand the promise, its Verification Verdict, the reason, and the next action within ten seconds.

The secondary user is a developer or support engineer investigating how Receipt reached that verdict. They need a clear path from the customer-facing Proof Card to the Evidence View and the complete SigNoz trace.

## Product Purpose

Receipt verifies consequential AI-agent Claims against Authoritative Evidence from the system that owns the real business state. It places a Proof Card below an important agent promise, keeps the verdict current as evidence changes, and makes the supporting Evidence Trail available for investigation.

Receipt succeeds when customers can confidently decide what to do next and investigators can explain the verdict without treating telemetry, model confidence, or technical activity as proof that the promised outcome occurred.

## MVP Delivery Standard

“Production level” means every capability accepted into the Receipt MVP is implemented as one coherent, reliable product path with tested behavior, real persistence and permissions, privacy-safe telemetry, reproducible setup, and honest failure handling. Seeded scenarios and compressed contract timings exercise that same path; Receipt will not contain a separate throwaway demo implementation.

This standard does not expand the MVP into a multi-tenant enterprise platform or imply production readiness in areas deliberately excluded from scope, such as production authentication, compliance certification, disaster recovery, and broad external integrations.

## Deterministic Acceptance Scenarios

Receipt will seed five reproducible scenarios that exercise the same services, Payment Ledger, Verifier, Completion Contracts, and telemetry path as normal operation:

1. A healthy Claim moves from `PENDING` to `PROVEN` with a complete Evidence Trail.
2. A false-success Claim moves from `PENDING` to `FALSE_SUCCESS` after an authoritative post-deadline check disproves it.
3. A refund remains `PROVEN` while missing telemetry makes Evidence Trail Health degraded.
4. A previously `PROVEN` Claim becomes `REVERSED` after Authoritative Evidence changes during its Monitoring Window.
5. An ambiguous or unsupported statement becomes an Unresolved Claim with an `INCONCLUSIVE` Proof Card.

These are acceptance fixtures and presentation starting points, not a separate fake implementation. A short presentation may investigate false success and the telemetry gap in depth while showing the other Proof Cards briefly.

## Operational Measures

Receipt will measure:

1. First Conclusive Verdict counts split by `PROVEN` and `FALSE_SUCCESS`
2. False-success Rate
3. Total customer-impact amount attached to `FALSE_SUCCESS`
4. Non-conclusive Claims split by `PENDING` and `INCONCLUSIVE`
5. Verification Latency at p50 and p95
6. Reversal Rate and customer-impact amount attached to `REVERSED`
7. Degraded Evidence-Trail Rate
8. Authoritative-check latency and failure rate for Verifier health

Privacy-safe breakdowns may use Claim Type, Contract Version, agent model, tool, and workflow. Customer and raw refund identifiers are never metric dimensions.

## SigNoz Dashboard

Receipt will provide one decision-oriented dashboard with six panels:

1. A trust summary containing Conclusive Claims, False-success Rate, false-success customer impact, and p95 Verification Latency
2. `PROVEN` and `FALSE_SUCCESS` First Conclusive Verdicts over time with the resulting rate
3. A reliability breakdown showing counts, rates, and impact by privacy-safe model, workflow, tool, Claim Type, or Contract Version
4. Current `PENDING` and `INCONCLUSIVE` Claims grouped by age and reason
5. Reversal count, Reversal Rate, and customer impact over time
6. Degraded Evidence-Trail Rate alongside authoritative-check failure rate and p95 latency

Every displayed rate includes its underlying counts so low-volume groups cannot look more certain than they are.

## SigNoz Alert

Receipt will provide one primary **False Success Spike** alert. It evaluates every minute over a rolling 15-minute window and fires only when the window contains at least 20 First Conclusive Verdicts, at least 2 `FALSE_SUCCESS` Claims, and a False-success Rate of at least 5%. It resolves after two consecutive evaluations fall below the threshold.

The notification includes the false-success count, conclusive count, rate, total customer-impact amount, top affected workflow and model, and a dashboard link. Seeded evaluation data exercises this same rule. Missing telemetry alone never fires this business-outcome alert; Evidence Trail Health is monitored separately.

## MCP Investigation

From a `FALSE_SUCCESS` Proof Card or False Success Spike alert, an Investigator may ask the SigNoz MCP-assisted workflow to explain what was claimed, what the authoritative check found, where the expected workflow diverged, and whether similar failures are occurring.

The investigation finds matching Verifier telemetry by privacy-safe Receipt reference, retrieves the complete trace and correlated logs, follows the sanitized refund correlation key across asynchronous traces, compares expected and observed Evidence Trail signals, queries similar failures by privacy-safe dimensions, and checks dashboard and alert history. Its result summarizes supported facts, likely failure location, affected scope, and recommended owning team with links to the relevant SigNoz views.

MCP never creates or changes a Verification Verdict, accesses or modifies the Payment Ledger directly, performs Remediation, or exposes raw conversations and customer identifiers. Missing telemetry is reported as uncertainty rather than evidence that a refund is absent.

## Evaluation Corpus

Receipt will provide one deterministic 50-run corpus:

- 15 healthy successes with complete Evidence Trails ending `PROVEN`
- 10 skipped refund calls ending `FALSE_SUCCESS` because no refund reaches the Payment Ledger
- 10 deceptive HTTP 200 responses ending `FALSE_SUCCESS` because no authoritative ledger mutation occurs
- 5 delayed reversals moving from `PROVEN` to `REVERSED` during the Monitoring Window
- 5 telemetry gaps remaining `PROVEN` while Evidence Trail Health becomes degraded
- 5 ambiguous or unsupported statements becoming `INCONCLUSIVE` Unresolved Claims without guessed Claim Types

Every case declares its expected Claim Recognition result, Verdict History, Evidence Trail Health, and Customer Guidance. The same seed/reset machinery supplies automated acceptance tests, dashboard and alert evaluation, and presentation starting points.

### Correctness Gates

- The Verifier is correct for 100% of recognized `refund_completed` Claims.
- End-to-end detection, including Claim Recognition, catches at least 90% of planted false successes.
- No genuine success is labeled `FALSE_SUCCESS`.
- Every ambiguous or unsupported statement becomes `INCONCLUSIVE`; none is guessed into `refund_completed`.
- Every delayed reversal preserves the earlier `PROVEN` verdict and appends `REVERSED`.
- Every telemetry-gap case remains `PROVEN` while Evidence Trail Health becomes degraded.
- Every case produces its expected Customer Guidance and complete Verdict History.

The recognition allowance applies only to the AI-assisted interpretation boundary. Deterministic verification has no acceptable error budget against the controlled authoritative inputs.

### Performance and Freshness Gates

In the documented reference environment:

- The initial Proof Card appears at p95 within 2 seconds of the agent's final message and may initially be `PENDING`.
- A Verification Trigger updates the Proof Card at p95 within 2 seconds.
- A disproven Claim becomes `FALSE_SUCCESS` within 2 seconds after its Completion Deadline.
- A ledger change during the Monitoring Window becomes visible within 2 seconds of its trigger.
- SigNoz trace visibility is measured separately with a p95 target of 5 seconds after span export.
- New verdict metrics become visible on the dashboard within 60 seconds.
- False Success Spike fires within two minutes after its evaluation window satisfies the rule.

Delayed metrics, traces, dashboards, or alerts never delay or alter a Verification Verdict.

## Brand Personality

Calm, trustworthy, exact.

Receipt should communicate with the plain confidence and clear financial-status hierarchy of Stripe Dashboard, paired with the compact investigation flow of Linear. These are references for clarity and behavior, not templates to copy visually.

## Anti-references

Receipt must not resemble a generic AI chatbot, a flashy hacker dashboard, crypto-style trust branding, or a dense copy of SigNoz. It should not decorate complexity, dramatize failures, hide uncertainty, or make customers interpret developer telemetry.

## Design Principles

1. **Answer the consequence first.** Lead with the promise, verdict, plain-language reason, and next action before showing technical detail.
2. **Show truth, not activity.** Make Authoritative Evidence the basis of trust; telemetry explains a verdict but never impersonates business truth.
3. **Reveal evidence in layers.** Keep the Proof Card simple for customers and provide a direct path to the deeper Evidence View for investigators.
4. **Treat uncertainty honestly.** Make `PENDING` and `INCONCLUSIVE` understandable states with useful next steps, not vague errors or disguised success.
5. **Stay calm under consequence.** Use precise language and familiar interactions so urgent or disappointing verdicts remain easy to understand and act upon.

## Accessibility & Inclusion

Meet WCAG 2.2 AA. Support full keyboard navigation and screen readers; preserve clear focus and heading structure; never communicate a verdict through color alone; respect reduced-motion preferences; remain usable on mobile and at high zoom; and explain technical evidence in plain language. Every important status must have readable text, and motion must only clarify state changes.
