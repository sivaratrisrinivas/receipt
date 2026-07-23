import { createServer } from "node:http";
import { readJson } from "./http-json.mjs";

export function createRefundServiceServer(refundService) {
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(204).end();
      return;
    }
    if (request.method !== "POST" || request.url !== "/refunds/complete") {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readJson(request);
      await refundService.completeRefund(body);
      response.writeHead(202).end();
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
}
