export function createVerificationScheduler({ clock, receipt, ledger }) {
  return { runDueWork };

  async function runDueWork() {
    const now = clock();
    const reclaimBefore = new Date(now.getTime() - 30_000);
    const dueWork = await receipt.findDueSchedule(now, reclaimBefore);
    for (const work of dueWork) {
      const checkedAt = clock().toISOString();
      if (!(await receipt.claimDueSchedule(work.scheduleId, checkedAt, reclaimBefore.toISOString()))) continue;
      try {
        const refundState = await ledger.readRefundState(work.refundReference);
        await receipt.recordVerificationOutcome({
          ...work, checkedAt, refundState, verdict: verdictFor(work, refundState, checkedAt),
        });
      } catch {
        await receipt.recordInconclusive({ ...work, checkedAt });
      }
    }
    return dueWork.length;
  }
}

function verdictFor(work, refundState, checkedAt) {
  if (refundState === "SUCCEEDED") return "PROVEN";
  if (work.firstConclusiveVerdict == null && new Date(work.completionDeadlineAt) <= new Date(checkedAt)) {
    return "FALSE_SUCCESS";
  }
  return work.currentVerdict;
}
