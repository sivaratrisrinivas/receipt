import { randomUUID } from "node:crypto";

const REFUND_COMPLETED = "refund_completed";
const COMPLETED_STATEMENTS = new Set([
  "your refund is complete.",
  "your refund has been completed.",
]);

export function createSupportWorkflow({ trustedReferences, verifier }) {
  return { createRefundReference, submitRecognizedClaim, getProofCard, hasTrustedRefundReference };

  async function createRefundReference({ messageReference }) {
    assertMessageReference(messageReference);
    const refundReference = `refund-ref-${randomUUID()}`;
    await trustedReferences.create({ messageReference, refundReference });
    return refundReference;
  }

  async function submitRecognizedClaim({ messageReference, finalStatement }) {
    assertMessageReference(messageReference);
    recognizeRefundCompleted(finalStatement);
    const refundReference = await trustedReferences.findByMessageReference(messageReference);
    if (refundReference === null) {
      throw new Error("The trusted support workflow has no Refund Reference for this Message Reference.");
    }
    return verifier.verifyRecognizedClaim({
      id: `claim-${randomUUID()}`,
      type: REFUND_COMPLETED,
      messageReference,
      refundReference,
    });
  }

  async function getProofCard({ messageReference }) {
    assertMessageReference(messageReference);
    const claim = await verifier.findRecognizedClaim({ messageReference });
    if (claim === null) throw new Error("No recognized Claim exists for this Message Reference.");
    return verifier.toProofCard(claim);
  }

  function hasTrustedRefundReference({ refundReference }) {
    return trustedReferences.hasRefundReference(refundReference);
  }
}

function assertMessageReference(messageReference) {
  if (typeof messageReference !== "string" || messageReference.length === 0) {
    throw new Error("A Message Reference is required.");
  }
}

function recognizeRefundCompleted(finalStatement) {
  if (typeof finalStatement !== "string" || !COMPLETED_STATEMENTS.has(finalStatement.trim().toLowerCase())) {
    throw new Error("The final statement is not a supported refund_completed Claim.");
  }
}
