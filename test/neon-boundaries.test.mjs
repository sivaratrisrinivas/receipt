import test from "node:test";
import assert from "node:assert/strict";

import {
  createNeonLedgerReader,
  createNeonLedgerWriter,
  createNeonReceiptStore,
} from "../src/neon-repositories.mjs";

test("the Verifier's ledger adapter only performs a parameterized read", async () => {
  const calls = [];
  const ledger = createNeonLedgerReader({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ state: "PROCESSING" }] };
    },
  });

  assert.equal(await ledger.readRefundState("refund-ref-1"), "PROCESSING");
  assert.deepEqual(calls, [
    {
      sql: "SELECT state FROM ledger.refunds WHERE refund_reference = $1",
      values: ["refund-ref-1"],
    },
  ]);
});

test("the Refund Service writer changes a ledger row only through a legal transition", async () => {
  const calls = [];
  const ledger = createNeonLedgerWriter({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ state: "SUCCEEDED" }] };
    },
  });

  assert.equal(await ledger.transitionRefund("refund-ref-1", "SUCCEEDED"), true);
  assert.match(calls[0].sql, /INSERT INTO ledger\.refunds/);
  assert.match(calls[0].sql, /state = \$2/);
  assert.deepEqual(calls[0].values, ["refund-ref-1", "SUCCEEDED"]);
  await assert.rejects(() => ledger.transitionRefund("refund-ref-1", "MISSING"), /Refund State/);
});

test("the Receipt adapter stores the Claim and its initial durable work together", async () => {
  const calls = [];
  const receipt = createNeonReceiptStore({
    async query(sql, values = []) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  });

  await receipt.storeClaimWithInitialCheckAndSchedule({
    contractVersion: {
      version: "refund_completed.v1",
      claimType: "refund_completed",
      completionDeadlineMs: 300000,
    },
    claim: {
      id: "claim-1",
      type: "refund_completed",
      messageReference: "message-1",
      refundReference: "refund-ref-1",
      contractVersion: "refund_completed.v1",
      recognizedAt: "2026-07-24T10:00:00.000Z",
      completionDeadlineAt: "2026-07-24T10:05:00.000Z",
      verdict: "PENDING",
      lastCheckedAt: "2026-07-24T10:00:00.000Z",
    },
    authoritativeCheck: {
      claimId: "claim-1",
      checkedAt: "2026-07-24T10:00:00.000Z",
      refundState: "PROCESSING",
      trigger: "INITIAL",
    },
    schedule: [
      { claimId: "claim-1", kind: "INITIAL", dueAt: "2026-07-24T10:00:00.000Z" },
    ],
  });

  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-1).sql, "COMMIT");
  assert.ok(calls.some(({ sql }) => sql.includes("INSERT INTO receipt.claims")));
  assert.ok(calls.some(({ sql }) => sql.includes("INSERT INTO receipt.verdict_history")));
  assert.ok(calls.some(({ sql }) => sql.includes("INSERT INTO receipt.verification_schedule")));
});

test("a duplicate Verification Trigger cannot append a second verdict transition", async () => {
  const calls = [];
  const receipt = createNeonReceiptStore({
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("RETURNING id")) return { rows: [] };
      return { rows: [] };
    },
  });

  await receipt.recordTriggeredVerification({
    claim: { id: "claim-1", verdict: "PENDING" },
    checkedAt: "2026-07-24T10:00:00.000Z",
    refundState: "SUCCEEDED",
    verdict: "PROVEN",
    monitoringEndsAt: "2026-07-31T10:00:00.000Z",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WHERE id = \$4 AND verdict <> \$1/);
  assert.match(calls[0].sql, /SELECT id, \$1, \$2, 'LEDGER_CHANGE' FROM transition/);
});

test("a deadline FALSE_SUCCESS preserves the first conclusive verdict in one durable transition", async () => {
  const calls = [];
  const receipt = createNeonReceiptStore({
    async query(sql, values = []) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  });

  await receipt.recordVerificationOutcome({
    scheduleId: 1,
    claimId: "claim-1",
    checkedAt: "2026-07-24T10:05:00.000Z",
    refundState: "MISSING",
    kind: "COMPLETION_DEADLINE",
    currentVerdict: "PENDING",
    verdict: "FALSE_SUCCESS",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /first_conclusive_verdict = CASE WHEN \$5 IN \('PROVEN', 'FALSE_SUCCESS'\)/);
  assert.match(calls[0].sql, /COALESCE\(first_conclusive_verdict, \$5\)/);
  assert.match(calls[0].sql, /SELECT id, \$5, \$2, \$4 FROM transition/);
  assert.deepEqual(calls[0].values, ["claim-1", "2026-07-24T10:05:00.000Z", "MISSING", "COMPLETION_DEADLINE", "FALSE_SUCCESS", 1]);
});

test("a stale claimed schedule can be reclaimed after a service restart", async () => {
  const calls = [];
  const receipt = createNeonReceiptStore({
    async query(sql, values = []) {
      calls.push({ sql, values });
      return { rows: [{ id: 1 }] };
    },
  });

  const now = new Date("2026-07-24T10:06:00.000Z");
  const reclaimBefore = new Date("2026-07-24T10:05:30.000Z");
  await receipt.findDueSchedule(now, reclaimBefore);
  assert.match(calls[0].sql, /schedule\.claimed_at IS NULL OR schedule\.claimed_at <= \$2/);
  assert.deepEqual(calls[0].values, [now.toISOString(), reclaimBefore.toISOString()]);

  assert.equal(await receipt.claimDueSchedule(1, now.toISOString(), reclaimBefore.toISOString()), true);
  assert.match(calls[1].sql, /claimed_at IS NULL OR claimed_at <= \$3/);
  assert.deepEqual(calls[1].values, [now.toISOString(), 1, reclaimBefore.toISOString()]);
});

test("a failed authoritative read records INCONCLUSIVE and a capped durable retry together", async () => {
  const calls = [];
  const receipt = createNeonReceiptStore({
    async query(sql, values = []) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  });

  await receipt.recordInconclusive({
    scheduleId: 1,
    claimId: "claim-1",
    checkedAt: "2026-07-24T10:05:00.000Z",
    kind: "COMPLETION_DEADLINE",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /refund_state, trigger\)\s+VALUES \(\$1, \$2, 'READ_FAILED', \$3\)/);
  assert.match(calls[0].sql, /SET verdict = 'INCONCLUSIVE', last_checked_at = \$2, retry_count = retry_count \+ 1/);
  assert.match(calls[0].sql, /SELECT id, 'RETRY', \$2::timestamptz \+ LEAST\(POWER\(2, retry_count - 1\), 5\)/);
  assert.match(calls[0].sql, /UPDATE receipt\.verification_schedule SET completed_at = \$2 WHERE id = \$4/);
  assert.deepEqual(calls[0].values, ["claim-1", "2026-07-24T10:05:00.000Z", "COMPLETION_DEADLINE", 1]);
});
