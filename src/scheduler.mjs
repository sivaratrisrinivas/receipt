export function createVerificationScheduler({ clock, receipt, ledger }) {
  return { runDueWork };

  async function runDueWork() {
    const dueWork = await receipt.findDueSchedule(clock());
    for (const work of dueWork) {
      const checkedAt = clock().toISOString();
      if (!(await receipt.claimDueSchedule(work.scheduleId, checkedAt))) continue;
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
  return new Date(work.completionDeadlineAt) <= new Date(checkedAt)
    ? "FALSE_SUCCESS"
    : "PENDING";
}
