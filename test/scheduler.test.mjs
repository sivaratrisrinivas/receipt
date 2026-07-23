import test from "node:test";
import assert from "node:assert/strict";
import { createVerificationScheduler } from "../src/scheduler.mjs";

test("durable deadline work is freshly checked after a restart", async () => {
  const checks = [];
  const scheduler = createVerificationScheduler({
    clock: () => new Date("2026-07-24T10:05:00.000Z"),
    receipt: {
      async findDueSchedule() { return [{ scheduleId: 1, claimId: "claim-1", refundReference: "refund-ref-1", kind: "COMPLETION_DEADLINE", currentVerdict: "PENDING", completionDeadlineAt: "2026-07-24T10:05:00.000Z" }]; },
      async claimDueSchedule() { return true; },
      async recordVerificationOutcome(check) { checks.push(check); },
    },
    ledger: { async readRefundState() { return "PROCESSING"; } },
  });
  assert.equal(await scheduler.runDueWork(), 1);
  assert.deepEqual(checks, [{ scheduleId: 1, claimId: "claim-1", refundReference: "refund-ref-1", kind: "COMPLETION_DEADLINE", currentVerdict: "PENDING", completionDeadlineAt: "2026-07-24T10:05:00.000Z", checkedAt: "2026-07-24T10:05:00.000Z", refundState: "PROCESSING", verdict: "FALSE_SUCCESS" }]);
});
