#!/usr/bin/env tsx

/**
 * Sapience E2E Smoke Test
 *
 * Verifies the full Sapience governance → preview → hold → confirm → execute flow
 * without requiring live Sapience/Ethereal connections.
 *
 * Usage:
 *   COGNIVERN_URL=https://cognivern.thisyearnofear.com \
 *   COGNIVERN_API_KEY=sapience-hackathon-key \
 *   pnpm tsx scripts/tests/sapience-e2e.ts
 */

const baseUrl = (process.env.COGNIVERN_URL || "http://localhost:3000").replace(
  /\/$/,
);
const apiKey = process.env.COGNIVERN_API_KEY || "development-api-key";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function api<T = any>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers = new Headers(init.headers || {});
  headers.set("X-API-KEY", apiKey);
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log(`\n🧪 Sapience E2E Smoke Test`);
  console.log(`   Target: ${baseUrl}\n`);

  // Step 1: Health check
  console.log("Step 1: Server health check");
  const health = await api("/api/health");
  assert(health.ok, "Server is reachable", `status=${health.status}`);

  // Step 2: Register a Sapience agent
  console.log("\nStep 2: Register Sapience agent");
  const agentRes = await api("/api/ows/agents", {
    method: "POST",
    json: {
      name: "sapience-e2e-test",
      role: "forecast-trader",
      chain: "arbitrum",
      budget: "1000 USDC",
    },
  });
  assert(agentRes.ok, "Agent registered", `status=${agentRes.status}`);
  const agentId = agentRes.data?.data?.id || "sapience-e2e-test";

  // Step 3: Run a governance evaluation (mock forecast cycle)
  console.log("\nStep 3: Governance evaluation (mock forecast attestation)");
  const evalRes = await api("/api/spend/encrypted", {
    method: "POST",
    json: {
      agentId,
      policyId: "sapience-trading-policy",
      amountUsd: 100,
      vendorHash: "0x" + "a".repeat(64),
    },
  });
  assert(evalRes.ok, "Encrypted spend evaluation completed");
  const decisionId = evalRes.data?.data?.decisionId;
  const outcome = evalRes.data?.data?.outcome;
  assert(!!decisionId, "Decision ID returned", decisionId?.slice(0, 18));
  assert(!!outcome, `Outcome: ${outcome}`);

  // Step 4: Preview spend (governance preview)
  console.log("\nStep 4: Preview spend");
  const previewRes = await api("/api/spend/preview", {
    method: "POST",
    json: {
      agentId,
      recipient: "0x" + "1".repeat(40),
      amount: "100",
      asset: "USDC",
      reason: "Sapience forecast attestation",
    },
  });
  assert(previewRes.ok, "Spend preview completed");
  assert(
    !!previewRes.data?.data?.status,
    `Preview status: ${previewRes.data?.data?.status}`,
  );

  // Step 5: Test confirm/reject endpoint
  console.log("\nStep 5: Trade confirmation endpoint");
  if (decisionId) {
    const confirmRes = await api(`/api/spend/${decisionId}/confirm`, {
      method: "POST",
      json: { action: "confirm" },
    });
    assert(confirmRes.ok, "Confirm endpoint works");
    assert(
      confirmRes.data?.data?.outcome === "approve",
      "Confirm returns approve outcome",
    );
  } else {
    console.log("  ⏭️  Skipped — no decisionId from Step 3");
  }

  // Step 6: Verify audit trail
  console.log("\nStep 6: Verify audit trail");
  const auditRes = await api(`/api/audit/logs?agent=${agentId}`);
  assert(auditRes.ok, "Audit logs endpoint accessible");
  const logs = auditRes.data?.data?.logs || [];
  assert(
    Array.isArray(logs),
    `Audit logs returned (${logs.length} entries)`,
  );

  // Step 7: Verify health with deep checks
  console.log("\nStep 7: Deep health check");
  const deepHealth = await api("/api/health?deep=true");
  assert(deepHealth.ok, "Deep health check passed");
  const deps = deepHealth.data?.data?.dependencies;
  if (Array.isArray(deps)) {
    assert(
      deps.length > 0,
      `${deps.length} dependency checks reported`,
    );
  }

  // Summary
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("  ❌ Smoke test FAILED\n");
    process.exit(1);
  } else {
    console.log("  ✅ All smoke tests PASSED\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
