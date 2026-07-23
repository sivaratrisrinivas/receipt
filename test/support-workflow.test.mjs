import test from "node:test";
import assert from "node:assert/strict";
import { createSupportWorkflow } from "../src/support-workflow.mjs";
import { createVerifier } from "../src/verifier.mjs";
import { createSupportWorkflowServer } from "../src/http-server.mjs";
import { createRefundService } from "../src/refund-service.mjs";
import { createRefundServiceServer } from "../src/refund-server.mjs";
import { createVerifierServer, createVerificationTriggerClient } from "../src/verifier-server.mjs";
import { createTrustedReferenceClient } from "../src/trusted-reference-client.mjs";
import { createVerificationScheduler } from "../src/scheduler.mjs";

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

test("the public support-workflow doorway returns INCONCLUSIVE when its initial Payment Ledger read fails", async (t) => {
  const receipt = new InMemoryReceiptStore();
  const ledger = new FailingLedgerReader({});
  ledger.failNextRead();
  await receipt.create({ messageReference: "message-1", refundReference: "refund-ref-1" });
  const server = createSupportWorkflowServer(makeWorkflow(receipt, ledger));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/trusted-promises`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messageReference: "message-1", finalStatement: "Your refund is complete." }),
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).verdict, "INCONCLUSIVE");
  assert.deepEqual(receipt.authoritativeChecks.map(({ refundState }) => refundState), ["READ_FAILED"]);
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["INCONCLUSIVE"]);
  assert.deepEqual(receipt.schedules.map(({ kind }) => kind), ["INITIAL", "COMPLETION_DEADLINE", "RETRY"]);
});

test("the public support workflow changes a skipped refund from PENDING to FALSE_SUCCESS at its Completion Deadline", async (t) => {
  let currentTime = new Date("2026-07-24T10:00:00.000Z");
  const clock = () => currentTime;
  const receipt = new InMemoryReceiptStore();
  const ledger = new LedgerReader({});
  await receipt.create({ messageReference: "message-1", refundReference: "refund-ref-1" });
  const verifier = createVerifier({ clock, receipt, ledger });
  const workflow = createSupportWorkflow({ trustedReferences: receipt, verifier });
  const server = createSupportWorkflowServer(workflow);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const submitted = await fetch(`http://127.0.0.1:${server.address().port}/trusted-promises`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messageReference: "message-1", finalStatement: "Your refund is complete." }),
  });
  assert.equal((await submitted.json()).verdict, "PENDING");

  currentTime = new Date("2026-07-24T10:05:00.000Z");
  const scheduler = createVerificationScheduler({ clock, receipt, ledger });
  assert.equal(await scheduler.runDueWork(), 1, "the durable deadline job can run after a service restart");
  assert.equal(await scheduler.runDueWork(), 0, "duplicate deadline execution cannot record another verdict transition");

  const proofCard = await fetch(`http://127.0.0.1:${server.address().port}/proof-cards?messageReference=message-1`);
  assert.equal(proofCard.status, 200);
  assert.deepEqual(await proofCard.json(), {
    claimType: "refund_completed",
    verdict: "FALSE_SUCCESS",
    reason: "The Payment Ledger did not record the refund as completed by the Completion Deadline.",
    customerGuidance: "Do not retry. Contact support.",
    completionDeadlineAt: "2026-07-24T10:05:00.000Z",
    lastCheckedAt: "2026-07-24T10:05:00.000Z",
  });
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["PENDING", "FALSE_SUCCESS"]);
  assert.deepEqual(
    { verdict: receipt.claims[0].firstConclusiveVerdict, at: receipt.claims[0].firstConclusiveAt },
    { verdict: "FALSE_SUCCESS", at: "2026-07-24T10:05:00.000Z" },
  );
  assert.equal(ledger.reads, 2, "the deadline job uses a fresh authoritative read rather than a missing signal");
});

test("the public support workflow makes a failed Payment Ledger read inconclusive and recovers it after a restart", async (t) => {
  let currentTime = new Date("2026-07-24T10:00:00.000Z");
  const clock = () => currentTime;
  const receipt = new InMemoryReceiptStore();
  const ledger = new FailingLedgerReader({});
  await receipt.create({ messageReference: "message-1", refundReference: "refund-ref-1" });
  const verifier = createVerifier({ clock, receipt, ledger });
  const workflow = createSupportWorkflow({ trustedReferences: receipt, verifier });
  const server = createSupportWorkflowServer(workflow);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  await fetch(`http://127.0.0.1:${server.address().port}/trusted-promises`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messageReference: "message-1", finalStatement: "Your refund is complete." }),
  });

  currentTime = new Date("2026-07-24T10:05:00.000Z");
  ledger.failNextRead();
  await createVerificationScheduler({ clock, receipt, ledger }).runDueWork();

  const inconclusive = await fetch(`http://127.0.0.1:${server.address().port}/proof-cards?messageReference=message-1`);
  assert.deepEqual(await inconclusive.json(), {
    claimType: "refund_completed",
    verdict: "INCONCLUSIVE",
    reason: "Receipt could not reliably read the Payment Ledger.",
    customerGuidance: "Do not retry. Contact support.",
    completionDeadlineAt: "2026-07-24T10:05:00.000Z",
    lastCheckedAt: "2026-07-24T10:05:00.000Z",
  });
  assert.deepEqual(receipt.authoritativeChecks.map(({ refundState }) => refundState), ["MISSING", "READ_FAILED"]);
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["PENDING", "INCONCLUSIVE"]);

  currentTime = new Date("2026-07-24T10:05:01.000Z");
  await createVerificationScheduler({ clock, receipt, ledger }).runDueWork();

  const recovered = await fetch(`http://127.0.0.1:${server.address().port}/proof-cards?messageReference=message-1`);
  assert.equal((await recovered.json()).verdict, "FALSE_SUCCESS");
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["PENDING", "INCONCLUSIVE", "FALSE_SUCCESS"]);

  currentTime = new Date("2026-07-24T10:05:02.000Z");
  ledger.failNextRead();
  await verifier.verifyRefundStateChange({ refundReference: "refund-ref-1" });
  currentTime = new Date("2026-07-24T10:05:03.000Z");
  await createVerificationScheduler({ clock, receipt, ledger }).runDueWork();

  const restored = await fetch(`http://127.0.0.1:${server.address().port}/proof-cards?messageReference=message-1`);
  assert.equal((await restored.json()).verdict, "FALSE_SUCCESS");
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["PENDING", "INCONCLUSIVE", "FALSE_SUCCESS", "INCONCLUSIVE", "FALSE_SUCCESS"]);
});

test("a failed Monitoring Window read recovers as REVERSED without extending the original window", async (t) => {
  let currentTime = new Date("2026-07-24T10:00:00.000Z");
  const clock = () => currentTime;
  const receipt = new InMemoryReceiptStore();
  const ledger = new FailingLedgerReader({ "refund-ref-1": "SUCCEEDED" });
  await receipt.create({ messageReference: "message-1", refundReference: "refund-ref-1" });
  const workflow = createSupportWorkflow({ trustedReferences: receipt, verifier: createVerifier({ clock, receipt, ledger }) });
  const server = createSupportWorkflowServer(workflow);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  await fetch(`http://127.0.0.1:${server.address().port}/trusted-promises`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messageReference: "message-1", finalStatement: "Your refund is complete." }),
  });
  const originalMonitoringEndsAt = receipt.claims[0].monitoringEndsAt;

  currentTime = new Date("2026-07-24T10:05:00.000Z");
  await createVerificationScheduler({ clock, receipt, ledger }).runDueWork();

  currentTime = new Date(originalMonitoringEndsAt);
  ledger.refunds["refund-ref-1"] = "REJECTED";
  ledger.failNextRead();
  await createVerificationScheduler({ clock, receipt, ledger }).runDueWork();

  currentTime = new Date(currentTime.getTime() + 1_000);
  await createVerificationScheduler({ clock, receipt, ledger }).runDueWork();

  const proofCard = await fetch(`http://127.0.0.1:${server.address().port}/proof-cards?messageReference=message-1`);
  assert.equal((await proofCard.json()).verdict, "REVERSED");
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["PROVEN", "INCONCLUSIVE", "REVERSED"]);
  assert.equal(receipt.claims[0].monitoringEndsAt, originalMonitoringEndsAt);
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

  const untrusted = await fetch(`http://127.0.0.1:${refundServer.address().port}/refunds/complete`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refundReference: "refund-ref-not-trusted" }),
  });
  assert.equal(untrusted.status, 400);
  assert.equal(ledger.transitions, 0, "an untrusted reference cannot create a ledger refund");

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
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["PENDING", "PROVEN"]);
  assert.deepEqual(
    { verdict: receipt.claims[0].firstConclusiveVerdict, at: receipt.claims[0].firstConclusiveAt },
    { verdict: "PROVEN", at: "2026-07-24T10:00:00.000Z" },
  );
  assert.equal(receipt.schedules.filter(({ kind }) => kind === "MONITORING_FINAL").length, 1);
  assert.equal(ledger.reads, 3, "the trigger does not carry a verdict; the Verifier reads the ledger again for each state change");

  const duplicate = await fetch(`http://127.0.0.1:${refundServer.address().port}/refunds/complete`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refundReference: "refund-ref-1" }),
  });
  assert.equal(duplicate.status, 202);
  assert.deepEqual(receipt.verdictHistory.map(({ verdict }) => verdict), ["PENDING", "PROVEN"], "duplicate refund requests do not duplicate verdict transitions");
});

function makeWorkflow(receipt, ledger) {
  return createSupportWorkflow({ trustedReferences: receipt, verifier: createVerifier({ clock: now, receipt, ledger }) });
}
class LedgerReader { constructor(refunds) { this.refunds = refunds; this.reads = 0; } async readRefundState(ref) { this.reads += 1; return this.refunds[ref] ?? "MISSING"; } }
class FailingLedgerReader extends LedgerReader {
  failedRead = false;
  failNextRead() { this.failedRead = true; }
  async readRefundState(refundReference) {
    if (this.failedRead) {
      this.failedRead = false;
      throw new Error("Payment Ledger unavailable");
    }
    return super.readRefundState(refundReference);
  }
}
class WritableLedger extends LedgerReader {
  transitions = 0;
  async transitionRefund(refundReference, nextState) {
    this.transitions += 1;
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
  async storeClaimWithInitialCheckAndSchedule(record) {
    this.contractVersions.push(record.contractVersion);
    this.claims.push(record.claim);
    this.authoritativeChecks.push(record.authoritativeCheck);
    this.verdictHistory.push({ claimId: record.claim.id, verdict: record.claim.verdict, recordedAt: record.claim.lastCheckedAt, trigger: "INITIAL" });
    this.schedules.push(...record.schedule);
  }
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
  async findDueSchedule(now) {
    return this.schedules
      .filter((schedule) => schedule.completedAt === undefined && schedule.claimedAt === undefined && new Date(schedule.dueAt) <= now)
      .map((schedule) => ({
        ...schedule,
        scheduleId: this.schedules.indexOf(schedule) + 1,
        refundReference: this.claims.find((claim) => claim.id === schedule.claimId).refundReference,
        completionDeadlineAt: this.claims.find((claim) => claim.id === schedule.claimId).completionDeadlineAt,
        currentVerdict: this.claims.find((claim) => claim.id === schedule.claimId).verdict,
        firstConclusiveVerdict: this.claims.find((claim) => claim.id === schedule.claimId).firstConclusiveVerdict,
      }));
  }
  async claimDueSchedule(scheduleId, claimedAt) {
    const schedule = this.schedules[scheduleId - 1];
    if (schedule.claimedAt !== undefined || schedule.completedAt !== undefined) return false;
    schedule.claimedAt = claimedAt;
    return true;
  }
  async recordVerificationOutcome({ scheduleId, claimId, checkedAt, refundState, kind, currentVerdict, verdict }) {
    const claim = this.claims.find((candidate) => candidate.id === claimId);
    this.authoritativeChecks.push({ claimId, checkedAt, refundState, trigger: kind });
    claim.verdict = verdict;
    claim.lastCheckedAt = checkedAt;
    claim.retryCount = 0;
    if (verdict === "FALSE_SUCCESS") {
      claim.firstConclusiveVerdict ??= "FALSE_SUCCESS";
      claim.firstConclusiveAt ??= checkedAt;
    }
    if (verdict !== currentVerdict) this.verdictHistory.push({ claimId, verdict, recordedAt: checkedAt, trigger: kind });
    this.schedules[scheduleId - 1].completedAt = checkedAt;
  }
  async recordInconclusive({ scheduleId, claimId, checkedAt, kind }) {
    const claim = this.claims.find((candidate) => candidate.id === claimId);
    this.authoritativeChecks.push({ claimId, checkedAt, refundState: "READ_FAILED", trigger: kind });
    const changed = claim.verdict !== "INCONCLUSIVE";
    claim.verdict = "INCONCLUSIVE";
    claim.lastCheckedAt = checkedAt;
    if (changed) this.verdictHistory.push({ claimId, verdict: "INCONCLUSIVE", recordedAt: checkedAt, trigger: kind });
    claim.retryCount = (claim.retryCount ?? 0) + 1;
    if (scheduleId !== null && scheduleId !== undefined) this.schedules[scheduleId - 1].completedAt = checkedAt;
    this.schedules.push({ claimId, kind: "RETRY", dueAt: new Date(new Date(checkedAt).getTime() + Math.min(2 ** (claim.retryCount - 1), 5) * 1000).toISOString() });
  }
}
