import { createServer } from "node:http";
import { readJson } from "./http-json.mjs";

export function createVerifierServer(verifier) {
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/verification-triggers") {
      response.writeHead(404).end();
      return;
    }
    try {
      await verifier.verifyRefundStateChange(await readJson(request));
      response.writeHead(202).end();
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
}

export function createVerificationTriggerClient({ baseUrl, fetchImpl = fetch }) {
  return async ({ refundReference }) => {
    const response = await fetchImpl(`${baseUrl}/verification-triggers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refundReference }),
    });
    if (!response.ok) throw new Error("The Verifier did not accept the Verification Trigger.");
  };
}
