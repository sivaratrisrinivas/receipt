import { createServer } from "node:http";
import { readJson } from "./http-json.mjs";

export function createSupportWorkflowServer(workflow) {
  return createServer(async (request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(204).end();
        return;
      }
      if (request.method === "GET" && request.url?.startsWith("/proof-cards?")) {
        const messageReference = new URL(request.url, "http://localhost").searchParams.get("messageReference");
        const proofCard = await workflow.getProofCard({ messageReference });
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(proofCard));
        return;
      }
      if (request.method === "GET" && request.url?.startsWith("/trusted-refund-references/")) {
        const refundReference = decodeURIComponent(request.url.slice("/trusted-refund-references/".length));
        const trusted = await workflow.hasTrustedRefundReference({ refundReference });
        response.writeHead(trusted ? 200 : 404).end();
        return;
      }
      if (request.method !== "POST") {
      response.writeHead(404).end();
      return;
    }

    try {
      const body = await readJson(request);
      if (request.url === "/trusted-refund-references") {
        const refundReference = await workflow.createRefundReference(body);
        response.writeHead(201, { "content-type": "application/json" });
        response.end(JSON.stringify({ refundReference }));
        return;
      }
      if (request.url !== "/trusted-promises") {
        response.writeHead(404).end();
        return;
      }
      const proofCard = await workflow.submitRecognizedClaim(body);
      response.writeHead(201, { "content-type": "application/json" });
      response.end(JSON.stringify(proofCard));
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
}
