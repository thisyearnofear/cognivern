#!/usr/bin/env tsx
/**
 * SigNoz telemetry seed script.
 *
 * Runs a scripted sequence of governance evaluations against the Cognivern
 * backend to generate correlated OpenTelemetry traces + metrics. Run this
 * after starting the backend with OTEL_EXPORTER_OTLP_ENDPOINT set so the
 * SigNoz dashboards have real data.
 *
 * Usage:
 *   pnpm signoz:seed
 *   pnpm signoz:seed -- --base-url http://localhost:3001 --api-key $COGNIVERN_API_KEY
 *
 * Generates:
 *   - 6 governance.evaluate_decision spans (3 approved, 2 denied, 1 held)
 *   - 6 nested audit.log_action spans with traceIds
 *   - LLM provider calls (if any provider keys are configured)
 *   - cognivern.governance.decisions.total metrics (by outcome)
 *   - cognivern.governance.policy.violations.total metrics
 *   - cognivern.http.requests.total metrics (from the HTTP calls)
 *   - cognivern.http.request.duration.ms metrics
 */

import { parseArgs } from "node:util";

interface SeedAction {
  type: string;
  description: string;
  amount: number;
  currency: string;
  vendor: string;
  chain: string;
  agentId: string;
  expectedOutcome: "approved" | "denied" | "held";
}

const SEED_ACTIONS: SeedAction[] = [
  {
    type: "swap",
    description: "Swap 50 USDC for WETH on Uniswap V3",
    amount: 50,
    currency: "USDC",
    vendor: "uniswap-v3",
    chain: "arbitrum",
    agentId: "sapience-agent-1",
    expectedOutcome: "approved",
  },
  {
    type: "payment",
    description: "Pay 25 USDC to vendor 0x1234 for API services",
    amount: 25,
    currency: "USDC",
    vendor: "vendor-0x1234",
    chain: "base",
    agentId: "sapience-agent-1",
    expectedOutcome: "approved",
  },
  {
    type: "swap",
    description: "Swap 500 USDC for WETH on Uniswap V3 (large)",
    amount: 500,
    currency: "USDC",
    vendor: "uniswap-v3",
    chain: "arbitrum",
    agentId: "sapience-agent-1",
    expectedOutcome: "denied",
  },
  {
    type: "payment",
    description: "Pay 200 USDC to unverified vendor 0x5678",
    amount: 200,
    currency: "USDC",
    vendor: "vendor-0x5678",
    chain: "unknown-chain",
    agentId: "sapience-agent-1",
    expectedOutcome: "denied",
  },
  {
    type: "swap",
    description: "Swap 75 USDC for ARB on Camelot DEX",
    amount: 75,
    currency: "USDC",
    vendor: "camelot",
    chain: "arbitrum",
    agentId: "sapience-agent-1",
    expectedOutcome: "approved",
  },
  {
    type: "payment",
    description: "Pay 300 USDC to new vendor (suspicious pattern)",
    amount: 300,
    currency: "USDC",
    vendor: "vendor-0x9999",
    chain: "arbitrum",
    agentId: "sapience-agent-1",
    expectedOutcome: "held",
  },
];

async function main() {
  const { values } = parseArgs({
    options: {
      "base-url": { type: "string", default: process.env.COGNIVERN_SELF_BASE_URL || "http://localhost:3001" },
      "api-key": { type: "string", default: process.env.COGNIVERN_API_KEY || "" },
      delay: { type: "string", default: "500" },
    },
  });

  const baseUrl = values["base-url"]!;
  const apiKey = values["api-key"]!;
  const delayMs = parseInt(values.delay!, 10);

  if (!apiKey) {
    console.error("ERROR: --api-key or COGNIVERN_API_KEY is required");
    process.exit(1);
  }

  console.log(`SigNoz telemetry seed`);
  console.log(`  Backend: ${baseUrl}`);
  console.log(`  Actions: ${SEED_ACTIONS.length}`);
  console.log(`  Delay:   ${delayMs}ms between calls`);
  console.log("");

  // Verify backend is up
  try {
    const health = await fetch(`${baseUrl}/health`);
    if (!health.ok) throw new Error(`health check returned ${health.status}`);
    console.log("  Backend health: OK");
  } catch (err) {
    console.error(`ERROR: Cannot reach backend at ${baseUrl}: ${(err as Error).message}`);
    process.exit(1);
  }

  // Check if OTel is enabled
  try {
    const statusRes = await fetch(`${baseUrl}/api/observability/status`);
    const statusJson = await statusRes.json();
    const enabled = statusJson.data?.enabled;
    const reachable = statusJson.data?.reachable;
    console.log(`  OTel enabled: ${enabled}  endpoint reachable: ${reachable}`);
    if (!enabled) {
      console.error("\nWARNING: OTel is disabled on the backend. Set OTEL_EXPORTER_OTLP_ENDPOINT");
      console.error("         before running this script, or the dashboards will stay empty.\n");
    }
  } catch {
    console.log("  (could not check observability status - continuing anyway)");
  }

  console.log("");
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < SEED_ACTIONS.length; i++) {
    const action = SEED_ACTIONS[i];
    const label = `[${i + 1}/${SEED_ACTIONS.length}] ${action.type} $${action.amount} ${action.currency} -> ${action.vendor}`;

    try {
      const res = await fetch(`${baseUrl}/api/governance/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          action: {
            type: action.type,
            description: action.description,
            amount: action.amount,
            currency: action.currency,
          },
          metadata: {
            agentId: action.agentId,
            vendor: action.vendor,
            chain: action.chain,
            amount: action.amount,
          },
        }),
      });

      const json = await res.json();
      const decision = json.data?.decision || (json.data?.allowed ? "approved" : "denied");
      const traceId = json.data?.traceId;
      const auditLogId = json.data?.auditLogId;

      const match = decision === action.expectedOutcome;
      const icon = match ? "OK" : "!!";
      console.log(`  ${icon} ${label} -> ${decision} (expected ${action.expectedOutcome})`);
      if (traceId) {
        console.log(`     traceId: ${traceId}`);
      }
      if (auditLogId) {
        console.log(`     auditLogId: ${auditLogId}`);
      }

      succeeded++;
    } catch (err) {
      console.error(`  XX ${label} -> ERROR: ${(err as Error).message}`);
      failed++;
    }

    if (i < SEED_ACTIONS.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log("");
  console.log(`Done. ${succeeded} sent, ${failed} failed.`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Open SigNoz Cloud -> Services -> cognivern-backend");
  console.log("  2. Check Traces for governance.evaluate_decision spans");
  console.log("  3. Import docs/signoz-dashboards.json into Dashboards");
  console.log("  4. Verify the dashboards now show data points");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
