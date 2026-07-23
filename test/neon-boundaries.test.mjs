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
