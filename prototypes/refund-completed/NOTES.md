# Prototype findings

Fill this in after driving the difficult sequences by hand.

## Question

Does the explicit `refund_completed` state model preserve the intended meaning
of `PENDING`, `PROVEN`, `FALSE_SUCCESS`, `REVERSED`, and `INCONCLUSIVE` across
deadline, monitoring, retry, and Investigator Recheck triggers?

## Findings

- `PENDING → PROVEN → REVERSED` is representable without consulting
  telemetry.
- `PENDING → FALSE_SUCCESS → PROVEN` preserves `FALSE_SUCCESS` as the First
  Conclusive Verdict and labels the later proof as Late Success.
- A failed authoritative read can produce `INCONCLUSIVE`; a bounded retry can
  recover to `PROVEN` without restarting the original Monitoring Window.
- Removing refund-service telemetry changes Evidence Trail Health from
  `COMPLETE` to `DEGRADED` without changing a supported Verification Verdict.
- Explicit Refund State transitions reject shortcuts such as
  `MISSING → SUCCEEDED`; Remediation must use `REJECTED → PROCESSING →
  SUCCEEDED`.

## Decisions to retain

- Keep Verification Verdict and Evidence Trail Health as independent state.
- Preserve First Conclusive Verdict separately from the current verdict.
- Record the first `PROVEN` time and Monitoring Window once; recovery must not
  restart it.
- Every verification trigger performs a fresh authoritative read.
- Production persistence will need both Verdict History and a separate audit
  of same-verdict checks, because the prototype history intentionally records
  only transitions.
- After the Monitoring Window closes, an Investigator Recheck records an
  investigator-visible After-window Observation without changing the
  customer-facing Verification Verdict or Verdict History.

## Resolved product confirmations

- A post-window Investigator Recheck is informational: it appends an
  After-window Observation to the authoritative-check audit while the last
  monitored Verification Verdict remains on the Proof Card.
- An authoritative read failure before any conclusive verdict surfaces
  `INCONCLUSIVE` immediately, as recorded in ADR 0018.

## Prototype disposition

- The product questions are resolved. Keep the prototype temporarily until
  the production specification captures the validated decisions; delete the
  terminal shell only with explicit user direction.
