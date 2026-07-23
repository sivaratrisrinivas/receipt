const CONTRACT_VERSION = "refund_completed.v1";
const COMPLETION_DEADLINE_MS = 5 * 60 * 1000;

export function createVerifier({ clock, receipt, ledger }) {
  return { verifyRecognizedClaim };

  async function verifyRecognizedClaim(recognizedClaim) {
    const existingClaim = await receipt.findClaimByMessageReference(recognizedClaim.messageReference);
    if (existingClaim !== null) return toProofCard(existingClaim);

    const checkedAt = clock();
    const completionDeadlineAt = new Date(checkedAt.getTime() + COMPLETION_DEADLINE_MS);
    const refundState = await ledger.readRefundState(recognizedClaim.refundReference);
    const claim = {
      ...recognizedClaim,
      contractVersion: CONTRACT_VERSION,
      recognizedAt: checkedAt.toISOString(),
      completionDeadlineAt: completionDeadlineAt.toISOString(),
      verdict: refundState === "SUCCEEDED" ? "PROVEN" : "PENDING",
      lastCheckedAt: checkedAt.toISOString(),
    };
    try {
      await receipt.storeClaimWithInitialCheckAndSchedule({
      contractVersion: { version: CONTRACT_VERSION, claimType: claim.type, completionDeadlineMs: COMPLETION_DEADLINE_MS },
      claim,
      authoritativeCheck: { claimId: claim.id, checkedAt: claim.lastCheckedAt, refundState, trigger: "INITIAL" },
      schedule: [
        { claimId: claim.id, kind: "INITIAL", dueAt: claim.recognizedAt, completedAt: claim.recognizedAt },
        { claimId: claim.id, kind: "COMPLETION_DEADLINE", dueAt: claim.completionDeadlineAt },
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
}

function toProofCard(claim) {
  const proven = claim.verdict === "PROVEN";
  return {
    claimType: "refund_completed",
    verdict: claim.verdict,
    reason: proven ? "The Payment Ledger records the refund as completed." : "The refund is still processing and the Completion Deadline is open.",
    customerGuidance: proven ? "No action is needed." : "Wait for an automatic update.",
    completionDeadlineAt: claim.completionDeadlineAt,
    lastCheckedAt: claim.lastCheckedAt,
  };
}
