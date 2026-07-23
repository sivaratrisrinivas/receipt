import { createServer } from "node:http";

export function createSupportWorkflowServer(workflow) {
  return createServer(async (request, response) => {
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

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }
  return JSON.parse(body);
}
