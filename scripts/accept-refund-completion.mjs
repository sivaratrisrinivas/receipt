import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const required = ["VERIFIER_DATABASE_URL", "LEDGER_DATABASE_URL"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required in ignored local environment configuration.`);
}

const ports = { support: 3100, refund: 3101, verifier: 3102 };
const processHandle = spawn(process.execPath, ["src/main.mjs"], {
  env: { ...process.env, PORT: String(ports.support), REFUND_SERVICE_PORT: String(ports.refund), VERIFIER_PORT: String(ports.verifier) },
  stdio: ["ignore", "ignore", "pipe"],
});
let startupError = "";
processHandle.stderr.on("data", (chunk) => { startupError += chunk; });

try {
  await waitForHealth(`http://127.0.0.1:${ports.support}/health`);
  await waitForHealth(`http://127.0.0.1:${ports.refund}/health`);
  await waitForHealth(`http://127.0.0.1:${ports.verifier}/health`);

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
  if (startupError) error.message = `${error.message} ${startupError}`;
  throw error;
} finally {
  processHandle.kill();
}

async function post(url, body) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function waitForHealth(url) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).status === 204) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Service did not become healthy: ${url}`);
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
