import { randomUUID } from "node:crypto";

const REFUND_COMPLETED = "refund_completed";
const CONTRACT_VERSION = "refund_completed.v1";
const COMPLETION_DEADLINE_MS = 5 * 60 * 1000;
const COMPLETED_STATEMENTS = new Set([
  "your refund is complete.",
  "your refund has been completed.",
]);

export function createSupportWorkflow({
  clock,
  receipt,
  ledger,
  trustedReferences,
}) {
  return {
    createRefundReference,
    submitTrustedPromise,
  };

  async function createRefundReference() {
    const refundReference = `refund-ref-${randomUUID()}`;
    await trustedReferences.create(refundReference);
    return refundReference;
  }

  async function submitTrustedPromise({
    refundReference,
    messageReference,
    finalStatement,
  }) {
    assertTrustedReference(refundReference);
    assertMessageReference(messageReference);
    recognizeRefundCompleted(finalStatement);
    if (!(await trustedReferences.has(refundReference))) {
      throw new Error(
        "The Refund Reference was not created by the trusted support workflow.",
      );
    }

    const existingClaim = await receipt.findClaimByMessageReference(messageReference);
    if (existingClaim !== null) {
      return toProofCard(existingClaim);
    }

    const checkedAt = clock();
    const completionDeadlineAt = new Date(
      checkedAt.getTime() + COMPLETION_DEADLINE_MS,
    );
    const refundState = await ledger.readRefundState(refundReference);
    const claim = {
      id: `claim-${randomUUID()}`,
      type: REFUND_COMPLETED,
      messageReference,
      refundReference,
      contractVersion: CONTRACT_VERSION,
      recognizedAt: checkedAt.toISOString(),
      completionDeadlineAt: completionDeadlineAt.toISOString(),
      verdict: toPreDeadlineVerdict(refundState),
      lastCheckedAt: checkedAt.toISOString(),
    };

    await receipt.storePendingClaim({
      contractVersion: {
        version: CONTRACT_VERSION,
        claimType: REFUND_COMPLETED,
        completionDeadlineMs: COMPLETION_DEADLINE_MS,
      },
      claim,
      authoritativeCheck: {
        claimId: claim.id,
        checkedAt: claim.lastCheckedAt,
        refundState,
        trigger: "INITIAL",
      },
      schedule: [
        { claimId: claim.id, kind: "INITIAL", dueAt: claim.recognizedAt },
        {
          claimId: claim.id,
          kind: "COMPLETION_DEADLINE",
          dueAt: claim.completionDeadlineAt,
        },
      ],
    });

    return toProofCard(claim);
  }
}

function assertTrustedReference(refundReference) {
  if (typeof refundReference !== "string" || !refundReference.startsWith("refund-ref-")) {
    throw new Error("A trusted Refund Reference is required.");
  }
}

function assertMessageReference(messageReference) {
  if (typeof messageReference !== "string" || messageReference.length === 0) {
    throw new Error("A Message Reference is required.");
  }
}

function recognizeRefundCompleted(finalStatement) {
  if (
    typeof finalStatement !== "string" ||
    !COMPLETED_STATEMENTS.has(finalStatement.trim().toLowerCase())
  ) {
    throw new Error("The final statement is not a supported refund_completed Claim.");
  }
}

function toPreDeadlineVerdict(refundState) {
  if (refundState === "SUCCEEDED") {
    return "PROVEN";
  }
  return "PENDING";
}

function toProofCard(claim) {
  if (claim.verdict === "PROVEN") {
    return {
      claimType: REFUND_COMPLETED,
      verdict: "PROVEN",
      reason: "The Payment Ledger records the refund as completed.",
      customerGuidance: "No action is needed.",
      completionDeadlineAt: claim.completionDeadlineAt,
      lastCheckedAt: claim.lastCheckedAt,
    };
  }

  return {
    claimType: REFUND_COMPLETED,
    verdict: "PENDING",
    reason: "The refund is still processing and the Completion Deadline is open.",
    customerGuidance: "Wait for an automatic update.",
    completionDeadlineAt: claim.completionDeadlineAt,
    lastCheckedAt: claim.lastCheckedAt,
  };
}
