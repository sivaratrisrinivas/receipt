import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { post, requireDatabaseUrls, startReceipt, waitForReceiptHealth } from "./acceptance-harness.mjs";

requireDatabaseUrls();

const ports = { support: 3100, refund: 3101, verifier: 3102 };
const receipt = startReceipt(ports);

try {
  await waitForReceiptHealth(ports);

  const messageReference = `acceptance-${crypto.randomUUID()}`;
  const referenceResponse = await post(`http://127.0.0.1:${ports.support}/trusted-refund-references`, { messageReference });
  assert.equal(referenceResponse.status, 201);
  const { refundReference } = await referenceResponse.json();

  const pendingResponse = await post(`http://127.0.0.1:${ports.support}/trusted-promises`, {
    messageReference,
    finalStatement: "Your refund is complete.",
  });
  assert.equal(pendingResponse.status, 201);
  assert.equal((await pendingResponse.json()).verdict, "PENDING");

  const completionStartedAt = performance.now();
  const completionResponse = await post(`http://127.0.0.1:${ports.refund}/refunds/complete`, { refundReference });
  assert.equal(completionResponse.status, 202);
  const proofCard = await waitForProof(`http://127.0.0.1:${ports.support}/proof-cards?messageReference=${encodeURIComponent(messageReference)}`);
  const proofCardUpdateLatencyMs = performance.now() - completionStartedAt;

  assert.equal(proofCard.verdict, "PROVEN");
  assert.equal(proofCard.customerGuidance, "No action is needed.");
  assert.ok(proofCard.firstProvenAt);
  assert.ok(proofCard.monitoringEndsAt);

  const duplicateResponse = await post(`http://127.0.0.1:${ports.refund}/refunds/complete`, { refundReference });
  assert.equal(duplicateResponse.status, 202);

  console.log(JSON.stringify({
    scenario: "refund_completed_pending_to_proven",
    proofCardUpdateLatencyMs: Math.round(proofCardUpdateLatencyMs),
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

async function waitForProof(url) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const response = await fetch(url);
    if (response.ok) {
      const proofCard = await response.json();
      if (proofCard.verdict === "PROVEN") return proofCard;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Proof Card did not become PROVEN within two seconds.");
}
