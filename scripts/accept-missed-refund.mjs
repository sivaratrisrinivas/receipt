import assert from "node:assert/strict";
import { post, requireDatabaseUrls, startReceipt, waitForReceiptHealth } from "./acceptance-harness.mjs";

requireDatabaseUrls();

const ports = { support: 3200, refund: 3201, verifier: 3202 };
const deadlineGraceMs = 2_000;
const receipt = startReceipt(ports);

try {
  await waitForReceiptHealth(ports);

  const messageReference = `acceptance-missed-${crypto.randomUUID()}`;
  const referenceResponse = await post(`http://127.0.0.1:${ports.support}/trusted-refund-references`, { messageReference });
  assert.equal(referenceResponse.status, 201);

  const pendingResponse = await post(`http://127.0.0.1:${ports.support}/trusted-promises`, {
    messageReference,
    finalStatement: "Your refund is complete.",
  });
  assert.equal(pendingResponse.status, 201);
  const pendingProofCard = await pendingResponse.json();
  assert.equal(pendingProofCard.verdict, "PENDING");

  const proofCard = await waitForFalseSuccess(
    `http://127.0.0.1:${ports.support}/proof-cards?messageReference=${encodeURIComponent(messageReference)}`,
    Date.parse(pendingProofCard.completionDeadlineAt) + deadlineGraceMs,
  );
  const verdictLatencyAfterDeadlineMs = Date.now() - Date.parse(pendingProofCard.completionDeadlineAt);

  assert.equal(proofCard.verdict, "FALSE_SUCCESS");
  assert.equal(proofCard.customerGuidance, "Do not retry. Contact support.");
  assert.ok(verdictLatencyAfterDeadlineMs <= deadlineGraceMs, "FALSE_SUCCESS must arrive within the deadline grace bound");

  console.log(JSON.stringify({
    scenario: "refund_completed_pending_to_false_success",
    verdictLatencyAfterDeadlineMs,
    telemetryVisibilityLatencyMs: null,
    telemetryVisibilityNote: "Telemetry is not part of this issue and is measured separately when the evidence path is enabled.",
    verdict: proofCard.verdict,
  }));
} catch (error) {
  if (receipt.startupError()) error.message = `${error.message} ${receipt.startupError()}`;
  throw error;
} finally {
  receipt.stop();
}

async function waitForFalseSuccess(url, deadline) {
  while (Date.now() <= deadline) {
    const response = await fetch(url);
    if (response.ok) {
      const proofCard = await response.json();
      if (proofCard.verdict === "FALSE_SUCCESS") return proofCard;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Proof Card did not become FALSE_SUCCESS within two seconds after the Completion Deadline.");
}
