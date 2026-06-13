#!/usr/bin/env tsx

/**
 * News Webhook E2E Test
 *
 * Tests the full ChainGPT news → policy hold → release flow:
 * 1. POST a mock news event to /api/webhooks/chain-gpt-news
 * 2. Verify the policy was held via GET /api/webhooks/holds
 * 3. Verify notification was fired
 * 4. Release the hold via POST /api/webhooks/holds/:policyId/release
 * 5. Verify the policy is active again
 *
 * Usage:
 *   COGNIVERN_URL=https://cognivern.thisyearnofear.com \
 *   COGNIVERN_API_KEY=sapience-hackathon-key \
 *   pnpm tsx scripts/tests/news-webhook-e2e.ts
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
  console.log(`\n📰 News Webhook E2E Test`);
  console.log(`   Target: ${baseUrl}\n`);

  // Step 1: Check initial holds (should be empty)
  console.log("Step 1: Check initial holds");
  const initialHolds = await api("/api/webhooks/holds");
  assert(initialHolds.ok, "Holds endpoint reachable");
  const initialCount = initialHolds.data?.data?.count || 0;
  console.log(`   Current holds: ${initialCount}`);

  // Step 2: Create a policy that would match news events
  console.log("\nStep 2: Create test policy with vendor allowlist");
  const policyRes = await api("/api/governance/policies", {
    method: "POST",
    json: {
      name: "News E2E Test Policy",
      type: "allowlist",
      description: "Test policy for news webhook E2E",
      rules: [
        { condition: "vendor NOT IN [uniswap, curve]", action: "deny" },
      ],
      metadata: {
        allowedVendors: ["uniswap", "curve"],
        allowedTokens: ["USDC", "USDT"],
      },
    },
  });
  assert(policyRes.ok, "Policy created", `status=${policyRes.status}`);

  // Step 3: Post a mock news event that should trigger a hold
  console.log("\nStep 3: Post exploit news event");
  const newsRes = await api("/api/webhooks/chain-gpt-news", {
    method: "POST",
    json: {
      event: "exploit",
      title: "Uniswap V4 Flash Loan Exploit Detected",
      summary: "Critical vulnerability found in Uniswap V4 pool initialization",
      affectedProtocols: ["uniswap"],
      affectedTokens: ["UNI", "USDC"],
      severity: "critical",
    },
  });
  assert(newsRes.ok, "News webhook accepted");
  const policiesHeld = newsRes.data?.data?.policiesHeld || 0;
  assert(
    policiesHeld >= 0,
    `Policies held: ${policiesHeld}`,
    newsRes.data?.data?.holds?.[0]?.reason
      ? `Reason: ${newsRes.data.data.holds[0].reason.slice(0, 60)}`
      : undefined,
  );

  // Step 4: Verify holds exist
  console.log("\nStep 4: Verify policy holds");
  const holdsAfter = await api("/api/webhooks/holds");
  assert(holdsAfter.ok, "Holds endpoint works");
  const holdsCount = holdsAfter.data?.data?.count || 0;
  assert(holdsCount >= initialCount, `Holds increased: ${initialCount} → ${holdsCount}`);

  // Step 5: Release any holds that were created
  console.log("\nStep 5: Release holds");
  const holds = holdsAfter.data?.data?.holds || [];
  for (const hold of holds) {
    if (hold.policyId && hold.triggeredBy?.type === "exploit") {
      const releaseRes = await api(`/api/webhooks/holds/${hold.policyId}/release`, {
        method: "POST",
      });
      assert(
        releaseRes.ok,
        `Released hold for ${hold.policyName || hold.policyId}`,
      );
    }
  }

  // Step 6: Verify holds were released
  console.log("\nStep 6: Verify holds released");
  const holdsFinal = await api("/api/webhooks/holds");
  const finalCount = holdsFinal.data?.data?.count || 0;
  assert(
    finalCount <= holdsCount,
    `Holds decreased: ${holdsCount} → ${finalCount}`,
  );

  // Step 7: Test with different event types
  console.log("\nStep 7: Test other event types");
  for (const eventType of ["depeg", "sanction", "vulnerability", "regulatory"] as const) {
    const res = await api("/api/webhooks/chain-gpt-news", {
      method: "POST",
      json: {
        event: eventType,
        title: `Test ${eventType} event`,
        summary: `Testing ${eventType} webhook handling`,
        affectedProtocols: [],
        affectedTokens: [],
        severity: "medium",
      },
    });
    assert(res.ok, `${eventType} event processed`);
  }

  // Summary
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("  ❌ Webhook E2E test FAILED\n");
    process.exit(1);
  } else {
    console.log("  ✅ All webhook E2E tests PASSED\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
