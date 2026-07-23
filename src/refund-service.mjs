export function createRefundService({ ledger, trustedReferences, verificationTrigger }) {
  return { completeRefund };

  async function completeRefund({ refundReference }) {
    if (!(await trustedReferences.hasRefundReference(refundReference))) {
      throw new Error("The Refund Service requires a trusted Refund Reference.");
    }
    await transitionAndTrigger(refundReference, "PROCESSING");
    await transitionAndTrigger(refundReference, "SUCCEEDED");
  }

  async function transitionAndTrigger(refundReference, nextState) {
    await ledger.transitionRefund(refundReference, nextState);
    await verificationTrigger({ refundReference });
  }
}
