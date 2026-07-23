const CONTRACT = Object.freeze({
  version: "refund_completed.v1-prototype",
  deadlineSeconds: 10,
  monitoringSeconds: 30,
  monitoringIntervalSeconds: 5,
  retryDelaySeconds: 1,
});

const clone = (value) => structuredClone(value);

export function createPrototypeState() {
  return {
    prototype: true,
    now: 0,
    claim: null,
    refundState: "MISSING",
    authoritativeRead: {
      failNext: false,
      lastResult: "NOT_RUN",
      lastCheckedAt: null,
    },
    evidenceTrailHealth: "COMPLETE",
    telemetry: {
      agent: true,
      refundService: true,
      ledgerCheck: true,
      notification: true,
    },
    lastAction: "Prototype reset",
    lastError: null,
  };
}

function recordVerdict(state, verdict, reason, trigger) {
  const claim = state.claim;
  const previous = claim.currentVerdict;

  claim.currentVerdict = verdict;
  claim.reason = reason;
  claim.lastCheckedAt = state.now;

  if (previous !== verdict) {
    claim.verdictHistory.push({
      verdict,
      at: state.now,
      trigger,
      reason,
    });
  }

  if (verdict === "PROVEN" && claim.firstProvenAt === null) {
    claim.firstProvenAt = state.now;
    claim.monitoringEndAt = state.now + CONTRACT.monitoringSeconds;
    claim.nextMonitoringAt =
      state.now + CONTRACT.monitoringIntervalSeconds;
  }

  if (
    claim.firstConclusiveVerdict === null &&
    (verdict === "PROVEN" || verdict === "FALSE_SUCCESS")
  ) {
    claim.firstConclusiveVerdict = verdict;
  }

  if (verdict !== "INCONCLUSIVE") {
    claim.nextRetryAt = null;
  }
}

function verify(state, trigger) {
  if (state.claim === null) {
    state.lastError = "Recognize the Claim before verifying it.";
    return;
  }

  state.authoritativeRead.lastCheckedAt = state.now;

  if (state.authoritativeRead.failNext) {
    state.authoritativeRead.failNext = false;
    state.authoritativeRead.lastResult = "READ_FAILED";
    state.claim.nextRetryAt = state.now + CONTRACT.retryDelaySeconds;
    recordVerdict(
      state,
      "INCONCLUSIVE",
      "The Payment Ledger could not be read reliably.",
      trigger,
    );
    return;
  }

  state.authoritativeRead.lastResult = state.refundState;

  const monitoringClosed =
    state.claim.firstProvenAt !== null &&
    state.claim.monitoringEndAt !== null &&
    state.now > state.claim.monitoringEndAt;

  if (monitoringClosed && state.claim.currentVerdict !== "INCONCLUSIVE") {
    state.claim.lastCheckedAt = state.now;
    state.claim.reason =
      `The Monitoring Window is closed; the ${state.claim.currentVerdict} verdict is retained.`;
    return;
  }

  if (state.refundState === "SUCCEEDED") {
    const late = state.claim.firstConclusiveVerdict === "FALSE_SUCCESS";
    recordVerdict(
      state,
      "PROVEN",
      late
        ? "Late Success: the Payment Ledger now records the refund as SUCCEEDED."
        : "The Payment Ledger records the refund as SUCCEEDED.",
      trigger,
    );
    return;
  }

  if (
    state.claim.firstProvenAt !== null &&
    state.claim.monitoringEndAt !== null &&
    state.now <= state.claim.monitoringEndAt
  ) {
    recordVerdict(
      state,
      "REVERSED",
      `The Payment Ledger now reports ${state.refundState} after earlier proof.`,
      trigger,
    );
    return;
  }

  if (state.now > state.claim.completionDeadlineAt) {
    recordVerdict(
      state,
      "FALSE_SUCCESS",
      `A fresh post-deadline ledger read reports ${state.refundState}.`,
      trigger,
    );
    return;
  }

  recordVerdict(
    state,
    "PENDING",
    `The refund is ${state.refundState} and the Completion Deadline is still open.`,
    trigger,
  );
}

function transitionRefund(state, next) {
  const legal = {
    MISSING: ["PROCESSING"],
    PROCESSING: ["SUCCEEDED", "REJECTED"],
    SUCCEEDED: ["REJECTED"],
    REJECTED: ["PROCESSING"],
  };

  if (!legal[state.refundState].includes(next)) {
    state.lastError = `Illegal Refund State transition: ${state.refundState} → ${next}`;
    return;
  }

  state.refundState = next;
  state.lastAction = `Payment Ledger moved to ${next}`;
}

function refreshEvidenceHealth(state) {
  state.evidenceTrailHealth = Object.values(state.telemetry).every(Boolean)
    ? "COMPLETE"
    : "DEGRADED";
}

export function dispatch(current, action) {
  const state = clone(current);
  state.lastError = null;

  switch (action.type) {
    case "RECOGNIZE_CLAIM":
      if (state.claim !== null) {
        state.lastError = "This prototype already has one recognized Claim.";
        break;
      }
      state.claim = {
        id: "claim-prototype-001",
        type: "refund_completed",
        refundReference: "refund-ref-prototype-001",
        contractVersion: CONTRACT.version,
        recognizedAt: state.now,
        completionDeadlineAt: state.now + CONTRACT.deadlineSeconds,
        monitoringEndAt: null,
        nextMonitoringAt: null,
        nextRetryAt: null,
        currentVerdict: "PENDING",
        firstConclusiveVerdict: null,
        firstProvenAt: null,
        lastCheckedAt: null,
        reason: "Waiting for the first authoritative ledger check.",
        verdictHistory: [
          {
            verdict: "PENDING",
            at: state.now,
            trigger: "CLAIM_RECOGNITION",
            reason: "The Claim was recognized and awaits verification.",
          },
        ],
      };
      state.lastAction = "Recognized one refund_completed Claim";
      break;

    case "VERIFY":
      state.lastAction = `Fresh authoritative read (${action.trigger ?? "MANUAL"})`;
      verify(state, action.trigger ?? "MANUAL");
      break;

    case "ADVANCE_POST_DEADLINE":
      if (state.claim === null) {
        state.lastError = "Recognize the Claim before advancing its schedule.";
        break;
      }
      state.now = Math.max(state.now, state.claim.completionDeadlineAt + 1);
      state.lastAction = "Advanced past Completion Deadline and verified";
      verify(state, "COMPLETION_DEADLINE");
      break;

    case "MONITOR":
      if (state.claim?.monitoringEndAt === null || state.claim === null) {
        state.lastError = "Monitoring begins only after the Claim is PROVEN.";
        break;
      }
      state.now = Math.min(
        state.claim.nextMonitoringAt ?? state.now,
        state.claim.monitoringEndAt,
      );
      state.claim.nextMonitoringAt =
        state.now < state.claim.monitoringEndAt
          ? Math.min(
              state.now + CONTRACT.monitoringIntervalSeconds,
              state.claim.monitoringEndAt,
            )
          : null;
      state.lastAction = "Ran scheduled monitoring check";
      verify(state, "MONITORING");
      break;

    case "FINAL_CHECK":
      if (state.claim?.monitoringEndAt === null || state.claim === null) {
        state.lastError = "A final check exists only after the Claim is PROVEN.";
        break;
      }
      state.now = Math.max(state.now, state.claim.monitoringEndAt);
      state.claim.nextMonitoringAt = null;
      state.lastAction = "Ran final Monitoring Window check";
      verify(state, "MONITORING_FINAL");
      break;

    case "FAIL_NEXT_READ":
      state.authoritativeRead.failNext = true;
      state.lastAction = "The next Payment Ledger read will fail";
      break;

    case "RETRY":
      if (state.claim?.nextRetryAt === null || state.claim === null) {
        state.lastError = "No authoritative-read retry is scheduled.";
        break;
      }
      state.now = Math.max(state.now, state.claim.nextRetryAt);
      state.lastAction = "Ran bounded-backoff retry";
      verify(state, "RETRY");
      break;

    case "GAP_TELEMETRY":
      state.telemetry.refundService = false;
      refreshEvidenceHealth(state);
      state.lastAction =
        "Removed refund-service telemetry without changing business evidence";
      break;

    case "RESTORE_TELEMETRY":
      for (const key of Object.keys(state.telemetry)) {
        state.telemetry[key] = true;
      }
      refreshEvidenceHealth(state);
      state.lastAction = "Restored the complete Evidence Trail";
      break;

    case "LEDGER_TRANSITION":
      transitionRefund(state, action.next);
      break;

    case "RESET":
      return createPrototypeState();

    default:
      state.lastError = `Unknown action: ${action.type}`;
  }

  return state;
}

export { CONTRACT };
