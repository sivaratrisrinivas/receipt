import test from "node:test";
import assert from "node:assert/strict";
import { createSupportWorkflow } from "../src/support-workflow.mjs";
import { createVerifier } from "../src/verifier.mjs";
import { createSupportWorkflowServer } from "../src/http-server.mjs";
import { createRefundService } from "../src/refund-service.mjs";
import { createRefundServiceServer } from "../src/refund-server.mjs";
import { createVerifierServer, createVerificationTriggerClient } from "../src/verifier-server.mjs";
import { createTrustedReferenceClient } from "../src/trusted-reference-client.mjs";

const now = () => new Date("2026-07-24T10:00:00.000Z");

test("the public support-workflow doorway returns a private PENDING Proof Card", async (t) => {
  const receipt = new InMemoryReceiptStore();
  const workflow = makeWorkflow(receipt, new LedgerReader({ "refund-ref-1": "PROCESSING" }));
  await receipt.create({ messageReference: "message-1", refundReference: "refund-ref-1" });
  const server = createSupportWorkflowServer(workflow);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/trusted-promises`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messageReference: "message-1", finalStatement: "Your refund is complete." }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    claimType: "refund_completed", verdict: "PENDING",
    reason: "The refund is still processing and the Completion Deadline is open.",
    customerGuidance: "Wait for an automatic update.",
    completionDeadlineAt: "2026-07-24T10:05:00.000Z", lastCheckedAt: "2026-07-24T10:00:00.000Z",
  });
  assert.equal(receipt.claims.length, 1);
  assert.equal(receipt.authoritativeChecks.length, 1);
  assert.equal(receipt.schedules.length, 2);
});

test("replaying a Message Reference after a restart does not create another Claim", async () => {
  const receipt = new InMemoryReceiptStore();
  await receipt.create({ messageReference: "message-1", refundReference: "refund-ref-1" });
  const ledger = new LedgerReader({ "refund-ref-1": "PROCESSING" });
  const input = { messageReference: "message-1", finalStatement: "Your refund is complete." };
  const first = await makeWorkflow(receipt, ledger).submitRecognizedClaim(input);
  const replay = await makeWorkflow(receipt, ledger).submitRecognizedClaim(input);
  assert.deepEqual(replay, first);
  assert.equal(receipt.claims.length, 1);
  assert.equal(receipt.schedules.length, 2);
});

test("Claim Recognition cannot select another valid Refund Reference", async () => {
  const receipt = new InMemoryReceiptStore();
  await receipt.create({ messageReference: "message-1", refundReference: "refund-ref-1" });
  await receipt.create({ messageReference: "message-2", refundReference: "refund-ref-2" });
  await makeWorkflow(receipt, new LedgerReader({ "refund-ref-1": "PROCESSING", "refund-ref-2": "SUCCEEDED" }))
    .submitRecognizedClaim({ messageReference: "message-1", finalStatement: "Your refund is complete.", refundReference: "refund-ref-2" });
  assert.equal(receipt.claims[0].refundReference, "refund-ref-1");
});

test("a completed refund triggers a fresh check and updates the existing Proof Card to PROVEN", async (t) => {
  const receipt = new InMemoryReceiptStore();
  const ledger = new WritableLedger({ "refund-ref-1": "PROCESSING" });
  await receipt.create({ messageReference: "message-1", refundReference: "refund-ref-1" });
  const verifier = createVerifier({ clock: now, receipt, ledger });
  const workflow = createSupportWorkflow({ trustedReferences: receipt, verifier });

  assert.equal((await workflow.submitRecognizedClaim({ messageReference: "message-1", finalStatement: "Your refund is complete." })).verdict, "PENDING");
  const supportServer = createSupportWorkflowServer(workflow);
  await new Promise((resolve) => supportServer.listen(0, "127.0.0.1", resolve));
  t.after(() => supportServer.close());
  const verifierServer = createVerifierServer(verifier);
  await new Promise((resolve) => verifierServer.listen(0, "127.0.0.1", resolve));
  t.after(() => verifierServer.close());
  const refundService = createRefundService({
    ledger,
    trustedReferences: createTrustedReferenceClient({ baseUrl: `http://127.0.0.1:${supportServer.address().port}` }),
    verificationTrigger: createVerificationTriggerClient({ baseUrl: `http://127.0.0.1:${verifierServer.address().port}` }),
  });
  const refundServer = createRefundServiceServer(refundService);
  await new Promise((resolve) => refundServer.listen(0, "127.0.0.1", resolve));
  t.after(() => refundServer.close());

  const completion = await fetch(`http://127.0.0.1:${refundServer.address().port}/refunds/complete`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refundReference: "refund-ref-1" }),
  });
  assert.equal(completion.status, 202);

  const proofCard = await fetch(`http://127.0.0.1:${supportServer.address().port}/proof-cards?messageReference=message-1`);
  assert.equal(proofCard.status, 200);
  assert.deepEqual(await proofCard.json(), {
    claimType: "refund_completed",
    verdict: "PROVEN",
    reason: "The Payment Ledger records the refund as completed.",
    customerGuidance: "No action is needed.",
    completionDeadlineAt: "2026-07-24T10:05:00.000Z",
    lastCheckedAt: "2026-07-24T10:00:00.000Z",
    firstProvenAt: "2026-07-24T10:00:00.000Z",
    monitoringEndsAt: "2026-07-31T10:00:00.000Z",
  });
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["PROVEN"]);
  assert.deepEqual(
    { verdict: receipt.claims[0].firstConclusiveVerdict, at: receipt.claims[0].firstConclusiveAt },
    { verdict: "PROVEN", at: "2026-07-24T10:00:00.000Z" },
  );
  assert.equal(receipt.schedules.filter(({ kind }) => kind === "MONITORING_FINAL").length, 1);
  assert.equal(ledger.reads, 2, "the trigger does not carry a verdict; the Verifier reads the ledger again");

  const duplicate = await fetch(`http://127.0.0.1:${refundServer.address().port}/refunds/complete`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refundReference: "refund-ref-1" }),
  });
  assert.equal(duplicate.status, 202);
  assert.equal(receipt.verdictHistory.length, 1, "duplicate refund requests do not duplicate verdict transitions");
});

function makeWorkflow(receipt, ledger) {
  return createSupportWorkflow({ trustedReferences: receipt, verifier: createVerifier({ clock: now, receipt, ledger }) });
}
class LedgerReader { constructor(refunds) { this.refunds = refunds; this.reads = 0; } async readRefundState(ref) { this.reads += 1; return this.refunds[ref] ?? "MISSING"; } }
class WritableLedger extends LedgerReader {
  async transitionRefund(refundReference, nextState) {
    const current = this.refunds[refundReference] ?? "MISSING";
    const legal = (current === "MISSING" && nextState === "PROCESSING")
      || (current === "PROCESSING" && ["SUCCEEDED", "REJECTED"].includes(nextState))
      || (current === "SUCCEEDED" && nextState === "REJECTED");
    if (!legal) return false;
    this.refunds[refundReference] = nextState;
    return true;
  }
}
class InMemoryReceiptStore {
  claims = []; contractVersions = []; authoritativeChecks = []; verdictHistory = []; schedules = []; trusted = new Map();
  async create({ messageReference, refundReference }) { this.trusted.set(messageReference, refundReference); }
  async findByMessageReference(messageReference) { return this.trusted.get(messageReference) ?? null; }
  async hasRefundReference(refundReference) { return [...this.trusted.values()].includes(refundReference); }
  async findClaimByMessageReference(messageReference) { return this.claims.find((claim) => claim.messageReference === messageReference) ?? null; }
  async storeClaimWithInitialCheckAndSchedule(record) { this.contractVersions.push(record.contractVersion); this.claims.push(record.claim); this.authoritativeChecks.push(record.authoritativeCheck); this.schedules.push(...record.schedule); }
  async findClaimByRefundReference(refundReference) { return this.claims.find((claim) => claim.refundReference === refundReference) ?? null; }
  async recordTriggeredVerification({ claim, checkedAt, refundState, verdict, monitoringEndsAt }) {
    this.authoritativeChecks.push({ claimId: claim.id, checkedAt, refundState, trigger: "LEDGER_CHANGE" });
    const changed = claim.verdict !== verdict;
    claim.verdict = verdict;
    claim.lastCheckedAt = checkedAt;
    if (verdict === "PROVEN" && claim.firstProvenAt === undefined) {
      claim.firstProvenAt = checkedAt;
      claim.monitoringEndsAt = monitoringEndsAt;
      claim.firstConclusiveVerdict ??= "PROVEN";
      claim.firstConclusiveAt ??= checkedAt;
      this.schedules.push({ claimId: claim.id, kind: "MONITORING_FINAL", dueAt: monitoringEndsAt });
    }
    if (changed) this.verdictHistory.push({ claimId: claim.id, verdict, recordedAt: checkedAt, trigger: "LEDGER_CHANGE" });
  }
}
