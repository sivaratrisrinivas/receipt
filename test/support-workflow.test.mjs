import test from "node:test";
import assert from "node:assert/strict";

import { createSupportWorkflow } from "../src/support-workflow.mjs";
import { createSupportWorkflowServer } from "../src/http-server.mjs";

test("the public support-workflow doorway returns a private PENDING Proof Card", async (t) => {
  const receipt = new InMemoryReceiptStore();
  const ledger = new LedgerReader({ "refund-ref-1": "PROCESSING" });
  const workflow = createSupportWorkflow({
    clock: () => new Date("2026-07-24T10:00:00.000Z"),
    receipt,
    ledger,
    trustedReferences: new TrustedRefundReferences(["refund-ref-1"]),
  });

  const server = createSupportWorkflowServer(workflow);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/trusted-promises`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refundReference: "refund-ref-1",
        messageReference: "message-1",
        finalStatement: "Your refund is complete.",
      }),
    },
  );
  const proofCard = await response.json();

  assert.equal(response.status, 201);
  assert.deepEqual(proofCard, {
    claimType: "refund_completed",
    verdict: "PENDING",
    reason: "The refund is still processing and the Completion Deadline is open.",
    customerGuidance: "Wait for an automatic update.",
    completionDeadlineAt: "2026-07-24T10:05:00.000Z",
    lastCheckedAt: "2026-07-24T10:00:00.000Z",
  });
  assert.equal(receipt.claims.length, 1);
  assert.equal(receipt.contractVersions.length, 1);
  assert.equal(receipt.authoritativeChecks.length, 1);
  assert.deepEqual(receipt.schedules.map(({ kind, dueAt }) => ({ kind, dueAt })), [
    { kind: "INITIAL", dueAt: "2026-07-24T10:00:00.000Z" },
    { kind: "COMPLETION_DEADLINE", dueAt: "2026-07-24T10:05:00.000Z" },
  ]);
  assert.equal(receipt.schedules[0].claimId, receipt.schedules[1].claimId);
});

test("replaying a Message Reference does not create another Claim", async () => {
  const receipt = new InMemoryReceiptStore();
  const workflow = createSupportWorkflow({
    clock: () => new Date("2026-07-24T10:00:00.000Z"),
    receipt,
    ledger: new LedgerReader({ "refund-ref-1": "PROCESSING" }),
    trustedReferences: new TrustedRefundReferences(["refund-ref-1"]),
  });
  const promise = {
    refundReference: "refund-ref-1",
    messageReference: "message-1",
    finalStatement: "Your refund is complete.",
  };

  const first = await workflow.submitTrustedPromise(promise);
  const restartedWorkflow = createSupportWorkflow({
    clock: () => new Date("2026-07-24T10:00:00.000Z"),
    receipt,
    ledger: new LedgerReader({ "refund-ref-1": "PROCESSING" }),
    trustedReferences: new TrustedRefundReferences(["refund-ref-1"]),
  });
  const replay = await restartedWorkflow.submitTrustedPromise(promise);

  assert.deepEqual(replay, first);
  assert.equal(receipt.claims.length, 1);
  assert.equal(receipt.authoritativeChecks.length, 1);
});

test("Claim Recognition rejects a Refund Reference that the support workflow did not create", async () => {
  const receipt = new InMemoryReceiptStore();
  const workflow = createSupportWorkflow({
    clock: () => new Date("2026-07-24T10:00:00.000Z"),
    receipt,
    ledger: new LedgerReader({ "refund-ref-invented": "PROCESSING" }),
    trustedReferences: new TrustedRefundReferences(),
  });

  await assert.rejects(
    workflow.submitTrustedPromise({
      refundReference: "refund-ref-invented",
      messageReference: "message-1",
      finalStatement: "Your refund is complete.",
    }),
    /created by the trusted support workflow/,
  );
  assert.equal(receipt.claims.length, 0);
});

class LedgerReader {
  constructor(refunds) {
    this.refunds = refunds;
  }

  async readRefundState(refundReference) {
    return this.refunds[refundReference] ?? "MISSING";
  }
}

class InMemoryReceiptStore {
  claims = [];
  contractVersions = [];
  authoritativeChecks = [];
  schedules = [];

  async findClaimByMessageReference(messageReference) {
    return this.claims.find((claim) => claim.messageReference === messageReference) ?? null;
  }

  async storePendingClaim(record) {
    this.contractVersions.push(record.contractVersion);
    this.claims.push(record.claim);
    this.authoritativeChecks.push(record.authoritativeCheck);
    this.schedules.push(...record.schedule);
  }
}

class TrustedRefundReferences {
  constructor(references = []) {
    this.references = new Set(references);
  }

  async create(refundReference) {
    this.references.add(refundReference);
  }

  async has(refundReference) {
    return this.references.has(refundReference);
  }
}
