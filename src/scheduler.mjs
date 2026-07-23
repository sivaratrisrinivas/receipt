export function createVerificationScheduler({ clock, receipt, ledger }) {
  return { runDueWork };

  async function runDueWork() {
    const dueWork = await receipt.findDueSchedule(clock());
    for (const work of dueWork) {
      const checkedAt = clock().toISOString();
      const refundState = await ledger.readRefundState(work.refundReference);
      await receipt.recordScheduledCheck({
        scheduleId: work.scheduleId,
        claimId: work.claimId,
        checkedAt,
        refundState,
        trigger: work.kind,
      });
    }
    return dueWork.length;
  }
}
