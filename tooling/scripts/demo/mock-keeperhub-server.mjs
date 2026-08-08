#!/usr/bin/env node
/**
 * Local KeeperHub mock for end-to-end dry-runs of the Sapience
 * rebalance cycle.
 *
 * Spins up a tiny HTTP server on $PORT (default 9998) that pretends to
 * be the KeeperHub Direct Execution API. It:
 *   - Accepts POST /api/execute/transfer, prints the body, and returns
 *     a fake executionId.
 *   - Accepts GET /api/execute/:id/status, and on the second poll
 *     returns { status: "completed", txHash: "0xMOCK..." } so the
 *     provider exits its poll loop with a synthetic receipt.
 *
 * Run alongside tooling/scripts/demo/run-keeperhub-rebalance.ts with:
 *   KEEPERHUB_BASE_URL=http://localhost:9998 \
 *   KEEPERHUB_API_KEY=test-key \
 *   pnpm tsx tooling/scripts/demo/run-keeperhub-rebalance.ts --dry-run ...
 *
 * The --dry-run flag on the rebalance script skips the KEEPERHUB_API_KEY
 * check, but we still need to point the provider at the mock, so the
 * env override above is what makes the round-trip observable.
 */

import http from "node:http";

const PORT = Number(process.env.PORT || 9998);
const executions = new Map();
let txCounter = 0;

const server = http.createServer((req, res) => {
  const { method, url } = req;
  console.log(`[mock-keeperhub] ${method} ${url}`);

  if (method === "POST" && url === "/api/execute/transfer") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      executions.set(id, {
        status: "pending",
        pollCount: 0,
        chainId: parsed.chainId,
        recipientAddress: parsed.recipientAddress,
        amount: parsed.amount,
      });
      console.log(`[mock-keeperhub] queued execution ${id}:`, parsed);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ executionId: id, status: "queued" }));
    });
    return;
  }

  const match = url && url.match(/^\/api\/execute\/([^/]+)\/status$/);
  if (method === "GET" && match) {
    const id = match[1];
    const exec = executions.get(id);
    if (!exec) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unknown executionId" }));
      return;
    }
    exec.pollCount += 1;
    if (exec.pollCount >= 2) {
      exec.status = "completed";
      exec.txHash = `0xMOCK${String(++txCounter).padStart(8, "0")}${"a".repeat(56)}`;
      console.log(`[mock-keeperhub] ${id} completed with txHash ${exec.txHash}`);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(exec));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: `unknown ${method} ${url}` }));
});

server.listen(PORT, () => {
  console.log(`[mock-keeperhub] listening on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  console.log("[mock-keeperhub] shutting down");
  server.close(() => process.exit(0));
});
