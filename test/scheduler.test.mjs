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

test("a rejected refund becomes FALSE_SUCCESS only at its Completion Deadline", async () => {
  const checks = [];
  const scheduler = createVerificationScheduler({
    clock: () => new Date("2026-07-24T10:05:00.000Z"),
    receipt: {
      async findDueSchedule() { return [{ scheduleId: 1, claimId: "claim-1", refundReference: "refund-ref-1", kind: "COMPLETION_DEADLINE", currentVerdict: "PENDING", completionDeadlineAt: "2026-07-24T10:05:00.000Z" }]; },
      async claimDueSchedule() { return true; },
      async recordVerificationOutcome(check) { checks.push(check); },
    },
    ledger: { async readRefundState() { return "REJECTED"; } },
  });

  await scheduler.runDueWork();
  assert.equal(checks[0].verdict, "FALSE_SUCCESS");
  assert.equal(checks[0].refundState, "REJECTED");
});

test("a restart reclaims deadline work abandoned by a crashed worker", async () => {
  const calls = [];
  const scheduler = createVerificationScheduler({
    clock: () => new Date("2026-07-24T10:06:00.000Z"),
    receipt: {
      async findDueSchedule(now, reclaimBefore) {
        calls.push({ now: now.toISOString(), reclaimBefore: reclaimBefore.toISOString() });
        return [{ scheduleId: 1, claimId: "claim-1", refundReference: "refund-ref-1", kind: "COMPLETION_DEADLINE", currentVerdict: "PENDING", completionDeadlineAt: "2026-07-24T10:05:00.000Z" }];
      },
      async claimDueSchedule(scheduleId, claimedAt, reclaimBefore) { calls.push({ scheduleId, claimedAt, reclaimBefore }); return true; },
      async recordVerificationOutcome(check) { calls.push(check); },
    },
    ledger: { async readRefundState() { return "MISSING"; } },
  });

  await scheduler.runDueWork();
  assert.equal(calls[0].reclaimBefore, "2026-07-24T10:05:30.000Z");
  assert.equal(calls[1].reclaimBefore, "2026-07-24T10:05:30.000Z");
  assert.equal(calls[2].verdict, "FALSE_SUCCESS");
});

test("a later non-successful monitoring read reverses a proven Claim without calling it FALSE_SUCCESS", async () => {
  const checks = [];
  const scheduler = createVerificationScheduler({
    clock: () => new Date("2026-07-24T10:05:00.000Z"),
    receipt: {
      async findDueSchedule() { return [{ scheduleId: 1, claimId: "claim-1", refundReference: "refund-ref-1", kind: "MONITORING_FINAL", currentVerdict: "PROVEN", firstConclusiveVerdict: "PROVEN", completionDeadlineAt: "2026-07-24T10:00:00.000Z" }]; },
      async claimDueSchedule() { return true; },
      async recordVerificationOutcome(check) { checks.push(check); },
    },
    ledger: { async readRefundState() { return "REJECTED"; } },
  });

  await scheduler.runDueWork();
  assert.equal(checks[0].verdict, "REVERSED");
});
