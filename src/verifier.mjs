const CONTRACT_VERSION = "refund_completed.v1";
const COMPLETION_DEADLINE_MS = 5 * 60 * 1000;
const MONITORING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const INITIAL_RETRY_DELAY_MS = 1_000;

export function createVerifier({ clock, receipt, ledger }) {
  return { verifyRecognizedClaim, verifyRefundStateChange, findRecognizedClaim, toProofCard };

  async function verifyRecognizedClaim(recognizedClaim) {
    const existingClaim = await receipt.findClaimByMessageReference(recognizedClaim.messageReference);
    if (existingClaim !== null) return toProofCard(existingClaim);

    const checkedAt = clock();
    const completionDeadlineAt = new Date(checkedAt.getTime() + COMPLETION_DEADLINE_MS);
    let refundState;
    try {
      refundState = await ledger.readRefundState(recognizedClaim.refundReference);
    } catch {
      refundState = "READ_FAILED";
    }
    const claim = {
      ...recognizedClaim,
      contractVersion: CONTRACT_VERSION,
      recognizedAt: checkedAt.toISOString(),
      completionDeadlineAt: completionDeadlineAt.toISOString(),
      verdict: refundState === "READ_FAILED" ? "INCONCLUSIVE" : refundState === "SUCCEEDED" ? "PROVEN" : "PENDING",
      lastCheckedAt: checkedAt.toISOString(),
      retryCount: refundState === "READ_FAILED" ? 1 : 0,
    };
    if (claim.verdict === "PROVEN") {
      claim.firstProvenAt = claim.lastCheckedAt;
      claim.monitoringEndsAt = new Date(checkedAt.getTime() + MONITORING_WINDOW_MS).toISOString();
      claim.firstConclusiveVerdict = "PROVEN";
      claim.firstConclusiveAt = claim.lastCheckedAt;
    }
    try {
      await receipt.storeClaimWithInitialCheckAndSchedule({
      contractVersion: { version: CONTRACT_VERSION, claimType: claim.type, completionDeadlineMs: COMPLETION_DEADLINE_MS, monitoringWindowMs: MONITORING_WINDOW_MS },
      claim,
      authoritativeCheck: { claimId: claim.id, checkedAt: claim.lastCheckedAt, refundState, trigger: "INITIAL" },
      schedule: [
        { claimId: claim.id, kind: "INITIAL", dueAt: claim.recognizedAt, completedAt: claim.recognizedAt },
        { claimId: claim.id, kind: "COMPLETION_DEADLINE", dueAt: claim.completionDeadlineAt },
        ...(refundState === "READ_FAILED" ? [{ claimId: claim.id, kind: "RETRY", dueAt: new Date(checkedAt.getTime() + INITIAL_RETRY_DELAY_MS).toISOString() }] : []),
        ...(claim.monitoringEndsAt === undefined ? [] : [{ claimId: claim.id, kind: "MONITORING_FINAL", dueAt: claim.monitoringEndsAt }]),
      ],
      });
    } catch (error) {
      if (error.code !== "23505") throw error;
      const concurrentClaim = await receipt.findClaimByMessageReference(recognizedClaim.messageReference);
      if (concurrentClaim === null) throw error;
      return toProofCard(concurrentClaim);
    }
    return toProofCard(claim);
  }

  async function verifyRefundStateChange({ refundReference }) {
    const claim = await receipt.findClaimByRefundReference(refundReference);
    if (claim === null) return null;
    const checkedAt = clock();
    let refundState;
    try {
      refundState = await ledger.readRefundState(refundReference);
    } catch {
      await receipt.recordInconclusive({ claimId: claim.id, checkedAt: checkedAt.toISOString(), kind: "LEDGER_CHANGE" });
      return toProofCard({ ...claim, verdict: "INCONCLUSIVE", lastCheckedAt: checkedAt.toISOString() });
    }
    const verdict = refundState === "SUCCEEDED"
      ? "PROVEN"
      : claim.firstConclusiveVerdict === "PROVEN"
        ? "REVERSED"
        : new Date(claim.completionDeadlineAt) <= checkedAt
          ? "FALSE_SUCCESS"
          : "PENDING";
    const monitoringEndsAt = verdict === "PROVEN" && claim.firstProvenAt == null
      ? new Date(checkedAt.getTime() + MONITORING_WINDOW_MS).toISOString()
      : null;
    await receipt.recordTriggeredVerification({
      claim,
      checkedAt: checkedAt.toISOString(),
      refundState,
      verdict,
      monitoringEndsAt,
    });
    return toProofCard({ ...claim, verdict, lastCheckedAt: checkedAt.toISOString(), ...(monitoringEndsAt === null ? {} : { firstProvenAt: checkedAt.toISOString(), monitoringEndsAt }) });
  }

  function findRecognizedClaim({ messageReference }) {
    return receipt.findClaimByMessageReference(messageReference);
  }
}

function toProofCard(claim) {
  const proven = claim.verdict === "PROVEN";
  const falseSuccess = claim.verdict === "FALSE_SUCCESS";
  const inconclusive = claim.verdict === "INCONCLUSIVE";
  const reversed = claim.verdict === "REVERSED";
  return {
    claimType: "refund_completed",
    verdict: claim.verdict,
    reason: proven
      ? "The Payment Ledger records the refund as completed."
      : falseSuccess
        ? "The Payment Ledger did not record the refund as completed by the Completion Deadline."
        : inconclusive
          ? "Receipt could not reliably read the Payment Ledger."
          : reversed
            ? "The Payment Ledger no longer records the refund as completed."
          : "The refund is still processing and the Completion Deadline is open.",
    customerGuidance: proven ? "No action is needed." : falseSuccess || inconclusive || reversed ? "Do not retry. Contact support." : "Wait for an automatic update.",
    completionDeadlineAt: claim.completionDeadlineAt,
    lastCheckedAt: claim.lastCheckedAt,
    ...(claim.firstProvenAt == null ? {} : { firstProvenAt: claim.firstProvenAt }),
    ...(claim.monitoringEndsAt == null ? {} : { monitoringEndsAt: claim.monitoringEndsAt }),
  };
}
