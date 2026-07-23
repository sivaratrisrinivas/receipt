import { createServer } from "node:http";

export function createSupportWorkflowServer(workflow) {
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/trusted-promises") {
      response.writeHead(404).end();
      return;
    }

    try {
      const promise = await readJson(request);
      const proofCard = await workflow.submitTrustedPromise(promise);
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
