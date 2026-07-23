import { spawn } from "node:child_process";

export function requireDatabaseUrls() {
  for (const name of ["VERIFIER_DATABASE_URL", "LEDGER_DATABASE_URL"]) {
    if (!process.env[name]) throw new Error(`${name} is required in ignored local environment configuration.`);
  }
}

export function startReceipt(ports) {
  const processHandle = spawn(process.execPath, ["src/main.mjs"], {
    env: { ...process.env, PORT: String(ports.support), REFUND_SERVICE_PORT: String(ports.refund), VERIFIER_PORT: String(ports.verifier) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let startupError = "";
  processHandle.stderr.on("data", (chunk) => { startupError += chunk; });
  return { stop: () => processHandle.kill(), startupError: () => startupError };
}

export async function waitForReceiptHealth(ports) {
  await Promise.all(Object.values(ports).map((port) => waitForHealth(`http://127.0.0.1:${port}/health`)));
}

export function post(url, body) {
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
