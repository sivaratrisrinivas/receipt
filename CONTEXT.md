# Receipt

Receipt verifies consequential claims made by AI agents against evidence of what actually happened in the outside world.

## Language

**Claim**:
An independently verifiable statement by an agent that a consequential real-world outcome has occurred. One agent message may contain zero or more Claims, and the same statement made in a later message is a separate Claim even when it concerns the same outcome.
_Avoid_: Message, response, workflow result

**Related Claims**:
Separate Claims that concern the same real-world outcome, such as repeated statements about one refund. They may be grouped for understanding, but each retains its own Proof Card, Completion Deadline, Contract Version, and Verdict History.
_Avoid_: Duplicate delivery, merged claim

**Claim Type**:
A named kind of Claim whose meaning determines what proof it needs, such as `refund_initiated` or `refund_completed`.
_Avoid_: Intent, workflow name

**`refund_completed`**:
The only Claim Type fully verified by the MVP, meaning the matching refund has reached `SUCCEEDED` in the Payment Ledger. Refund-service activity, tool calls, and customer-notification telemetry contribute to Evidence Trail Health but cannot prove or disprove this Claim.
_Avoid_: Refund requested, refund accepted, customer notified

**Claim Recognition**:
Receipt's process of determining whether an agent's final words contain consequential Claims and mapping each one to a supported Claim Type without relying on the agent to declare them. Recognition may use AI, but it does not decide whether a Claim is true; confident ordinary speech produces no Claim, while a plausible statement that cannot be mapped safely becomes an Unresolved Claim.
_Avoid_: Agent self-report, verification, proof

**Refund Reference**:
An opaque, privacy-safe identifier created by the trusted support workflow before the agent acts and used to bind a `refund_completed` Claim to exactly one expected refund. Claim Recognition cannot invent or change it; without one unique Refund Reference, Receipt returns `INCONCLUSIVE`.
_Avoid_: Customer identifier, model-extracted refund ID, raw order ID

**Unresolved Claim**:
A plausible consequential statement that Claim Recognition could not confidently map to a supported Claim Type because recognition was ambiguous, failed, or found no supported contract. It remains visible with an `INCONCLUSIVE` Proof Card rather than being guessed or silently discarded.
_Avoid_: No Claim, unsupported verdict, false success

**Completion Contract**:
A deterministic, versioned set of rules that says which Authoritative Evidence a Claim Type needs before it can receive a particular Verification Verdict and how long a proven Claim remains monitored.
_Avoid_: Prompt, model judgment

**Contract Version**:
An unchangeable version of a Completion Contract remembered by every Claim it evaluates. A changed contract receives a new version rather than rewriting old verification history.
_Avoid_: Current contract

**Completion Deadline**:
The configurable time set by a Completion Contract for a Claim Type by which the required evidence must exist. The `refund_completed` contract uses 10 seconds in the compressed demo and a production-shaped default of 5 minutes.
_Avoid_: Request timeout

**Monitoring Window**:
The period defined by a Completion Contract beginning when a Claim first becomes `PROVEN`, during which Receipt continues checking whether later Authoritative Evidence changes its verdict. The `refund_completed` contract uses 30 seconds in the compressed demo and a production-shaped default of 7 days; after the window closes, the last verdict remains visible with the monitoring end time.
_Avoid_: Completion Deadline, permanent monitoring

**Authoritative Evidence**:
The result of a check against the system that owns the real business state, such as the payment ledger for a refund. Telemetry alone is not Authoritative Evidence.
_Avoid_: Span presence, HTTP success

**Payment Ledger**:
The system of record that owns the current state of every refund and supplies Authoritative Evidence for refund Claims.
_Avoid_: Trace store, tool response

**Refund State**:
The Payment Ledger's current business state for a refund: `PROCESSING`, `SUCCEEDED`, or `REJECTED`. A missing record means no refund reached the ledger; normal processing moves to `SUCCEEDED` or `REJECTED`, provider reversal may move `SUCCEEDED` to `REJECTED`, and external Remediation must move `REJECTED` through `PROCESSING` before `SUCCEEDED`.
_Avoid_: Verification Verdict, tool-call status

**Verifier**:
The Receipt component that checks a Completion Contract against Authoritative Evidence and produces a Verification Verdict. It can inspect business state but cannot change it.
_Avoid_: Agent judge, refund processor, remediator

**Remediation**:
An action by the system that owns the business outcome to correct a `FALSE_SUCCESS` or `REVERSED` Claim. Receipt may recommend a next step but does not perform Remediation.
_Avoid_: Verification, verifier retry

**Verification Trigger**:
A signal telling the Verifier to check a Claim now. It may speed up verification but is not Authoritative Evidence.
_Avoid_: Proof, verdict

**Verification Schedule**:
The durable timetable of immediate, deadline, monitoring, final, and retry checks required by a Completion Contract. The compressed `refund_completed` profile checks every 5 seconds while monitoring and caps retry backoff at 5 seconds; the production-shaped profile checks every 6 hours and caps retry backoff at 5 minutes.
_Avoid_: In-memory timer, Verification Trigger, evidence

**Evidence Trail**:
The connected technical history of a Claim, including agent, tool, service, ledger-check, and notification telemetry. It explains a Verification Verdict but does not replace Authoritative Evidence.
_Avoid_: Business truth

**Evidence Trail Health**:
Receipt's conclusion about whether a Claim's linked SigNoz evidence is usable for investigation: `COMPLETE`, `DEGRADED`, or `UNAVAILABLE`. It is separate from the Verification Verdict; a fully observed workflow that skipped an expected business action may still have a `COMPLETE` trail.
_Avoid_: Verification Verdict

**COMPLETE**:
An Evidence Trail Health state meaning telemetry expected for the actions that actually occurred is linked and usable, including the Verifier check. It describes observation completeness rather than workflow success.

**DEGRADED**:
An Evidence Trail Health state meaning some expected telemetry or correlation is missing, but enough linked evidence remains for a partial investigation.

**UNAVAILABLE**:
An Evidence Trail Health state meaning no usable SigNoz evidence is linked to the Claim.

**Proof Card**:
The simple customer-facing view of one Claim, its Verification Verdict, plain-language reason, impact, Customer Guidance, and last check time. When one agent message contains multiple Claims, each Claim has its own Proof Card.
_Avoid_: Dashboard, trace view

**Customer Guidance**:
The safe next step shown on a Proof Card: no action for `PROVEN`, wait for an automatic update for `PENDING`, and contact support without retrying for `FALSE_SUCCESS`, `INCONCLUSIVE`, or `REVERSED`. It may recommend Remediation but never performs or initiates it.
_Avoid_: Remediation, retry action

**Evidence View**:
The restricted view in which an Investigator explains a Proof Card through its Evidence Trail and may follow a link to the complete SigNoz trace. It is never part of the customer view.
_Avoid_: Proof Card, customer message

**Investigator**:
An authorized support engineer or developer who may inspect the Evidence View, use its linked SigNoz trace, and request a fresh authoritative recheck of a recognized Claim. An Investigator cannot choose the result or edit the Claim Type, Refund Reference, Completion Contract, Verdict History, Payment Ledger, or an Unresolved Claim; the hackathon represents this restricted access with a clearly labeled mode rather than production authentication.
_Avoid_: Customer, administrator

**Investigator Recheck**:
A recorded Verification Trigger requested by an Investigator for an already recognized Claim. It performs a fresh authoritative read and cannot carry, select, or override a verdict; after the Monitoring Window closes, its result becomes an After-window Observation instead of changing the Claim's Verification Verdict.
_Avoid_: Manual verdict, Remediation, Claim reclassification

**After-window Observation**:
The result of an Investigator Recheck performed after a Claim's Monitoring Window has closed. It remains visible to investigators as Authoritative Evidence but does not change the customer-facing Verification Verdict or Verdict History.
_Avoid_: Current verdict, extended monitoring, REVERSED

**Safe Claim Summary**:
A plain-language description of a Claim built from approved structured fields without names, contact details, payment details, or full conversation text. It is safe to place in the Evidence Trail.
_Avoid_: Raw prompt, full agent response

**Message Reference**:
A privacy-safe identifier that connects a Claim to the original agent message without copying the message into Receipt's records. Reprocessing the same recognized statement from the same Message Reference does not create another Claim.
_Avoid_: Message content, conversation copy

**Verification Verdict**:
Receipt's current conclusion about whether Authoritative Evidence supports a Claim.
_Avoid_: Agent confidence, tool response

**PROVEN**:
A Verification Verdict meaning Authoritative Evidence satisfies the Claim. The customer needs to take no action.

**FALSE_SUCCESS**:
A Verification Verdict meaning the agent claimed success but an authoritative check completed after the allowed deadline and disproved it. The customer should not retry and should contact support.
_Avoid_: Missing telemetry

**PENDING**:
A Verification Verdict meaning the Claim may still become true within its allowed completion time. Receipt will check automatically by the Completion Deadline, so the customer should wait.

**INCONCLUSIVE**:
A Verification Verdict meaning Receipt could not perform a reliable authoritative check or could not determine a supported Completion Contract safely. After an earlier `PROVEN`, it preserves that historical proof without presenting it as current certainty; a later recovery does not restart the original Monitoring Window.
_Avoid_: Failed, false success

**REVERSED**:
A Verification Verdict meaning a Claim was previously `PROVEN`, but later Authoritative Evidence no longer supports it. It does not mean the original proof was wrong; the customer should contact support if the outcome still needs to be resolved.
_Avoid_: False success, revoked

**Late Success**:
A Claim whose Verdict History moves from `FALSE_SUCCESS` to `PROVEN` after the external outcome owner performs Remediation. Its First Conclusive Verdict remains `FALSE_SUCCESS`, and its Monitoring Window begins when the later `PROVEN` verdict is recorded.
_Avoid_: Rewritten success, Receipt remediation, false alarm

**Verdict History**:
The ordered record of every Verification Verdict a Claim has received as evidence changed. Earlier verdicts are preserved rather than overwritten.
_Avoid_: Current status

**First Conclusive Verdict**:
The first `PROVEN` or `FALSE_SUCCESS` verdict in a Claim's Verdict History. `PENDING` and `INCONCLUSIVE` do not qualify, and a later `REVERSED` verdict does not rewrite this original outcome.
_Avoid_: Current verdict, final verdict

**False-success Rate**:
The number of Claims whose First Conclusive Verdict is `FALSE_SUCCESS` divided by all Claims whose First Conclusive Verdict is either `PROVEN` or `FALSE_SUCCESS`. Each Claim is counted once in the time window when that verdict occurred.
_Avoid_: Failure rate, inconclusive rate, reversal rate

**Non-conclusive Claims**:
Claims whose current Verification Verdict is `PENDING` or `INCONCLUSIVE`, reported separately by verdict. This operational population is broader than Unresolved Claims, which specifically failed Claim Recognition.
_Avoid_: Unresolved Claims, failed Claims

**Verification Latency**:
The elapsed time from Claim Recognition to the First Conclusive Verdict. Receipt reports its distribution rather than treating the Completion Deadline itself as latency.
_Avoid_: Authoritative-check latency, trace visibility latency

**Reversal Rate**:
The number of distinct Claims that reach `REVERSED` divided by the number of distinct Claims that have ever reached `PROVEN`. Reversals and their customer-impact amount remain separate from False-success Rate.
_Avoid_: False-success Rate, current failure rate

**Degraded Evidence-Trail Rate**:
The proportion of Claims whose Evidence Trail Health is degraded, regardless of their Verification Verdict. It measures investigability rather than business truth.
_Avoid_: False-success Rate, verifier failure rate
