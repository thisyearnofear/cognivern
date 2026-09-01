#!/usr/bin/env tsx
/**
 * Telegraph Protocol Demo
 *
 * Demonstrates Telegraph verified intelligence consumption through
 * Cognivern's governance pipeline.
 *
 * Flow:
 *   1. Discover miners from the live Telegraph node
 *   2. Engine-routed governed call (x402-paid via @x402/fetch)
 *   3. Confidence threshold check → approved / held for review
 *   4. Record as telegraph.signal CRE artifact
 *   5. Show how intelligence → on-chain action would route through governance
 *   6. Node + daemon status
 *
 * Usage:
 *   TELEGRAPH_ENABLED=true \
 *   TELEGRAPH_EVM_PRIVATE_KEY=0x... \
 *   tsx tooling/scripts/demo/demo-telegraph.ts
 */

import { telegraphService } from "../../../src/backend/services/telegraph/index.js";
import { telegraphGovernanceHelper } from "../../../src/backend/services/telegraph/TelegraphGovernanceHelper.js";

async function main() {
  console.log("=".repeat(80));
  console.log("Telegraph Protocol × Cognivern Demo");
  console.log("Verified Intelligence → Governed Action");
  console.log("=".repeat(80));
  console.log();

  // Check if Telegraph is enabled AND a payment signer is ready (x402).
  if (!telegraphService.getEnabled()) {
    console.error("❌ Telegraph is not enabled");
    console.error();
    console.error("Set TELEGRAPH_ENABLED=true in the environment.");
    process.exit(1);
  }

  const paymentReady = await telegraphService.isReady();
  if (!paymentReady) {
    console.error("❌ Telegraph enabled but no x402 payment signer");
    console.error();
    console.error("Set TELEGRAPH_EVM_PRIVATE_KEY=0x... (burner wallet on Base Sepolia)");
    console.error("or TELEGRAPH_SOLANA_PRIVATE_KEY=... and fund it with testnet USDC.");
    console.error();
    console.error(`Detail: ${telegraphService.getPaymentInitError() ?? "unknown"}`);
    process.exit(1);
  }

  console.log("✅ Telegraph service initialized (x402 payment ready)");
  console.log();

  // Step 1: Discover available miners
  console.log("Step 1: Discovering available miners...");
  console.log("-".repeat(80));

  try {
    const miners = await telegraphService.getMiners();
    console.log(`Found ${miners.length} active miners`);
    console.log();

    // Show a few example miners
    const weatherMiners = miners.filter((m) =>
      m.name.toLowerCase().includes("weather") ||
      m.description.toLowerCase().includes("weather") ||
      m.supported_intents?.some((i) => i.includes("WEATHER"))
    );
    const llmMiners = miners.filter((m) =>
      m.name.toLowerCase().includes("chat") ||
      m.name.toLowerCase().includes("llm") ||
      m.description.toLowerCase().includes("chat")
    );
    const detectionMiners = miners.filter((m) =>
      m.name.toLowerCase().includes("detect") ||
      m.description.toLowerCase().includes("ai")
    );

    console.log(`  Weather miners: ${weatherMiners.length}`);
    if (weatherMiners.length > 0) {
      const example = weatherMiners[0];
      console.log(`    Example: ${example.name} ($${(example.min_price_usdc ?? 10000) / 1_000_000}/call)`);
    }

    console.log(`  LLM/Chat miners: ${llmMiners.length}`);
    if (llmMiners.length > 0) {
      console.log(`    Example: ${llmMiners[0].name}`);
    }

    console.log(`  AI Detection miners: ${detectionMiners.length}`);
    if (detectionMiners.length > 0) {
      console.log(`    Example: ${detectionMiners[0].name}`);
    }

    console.log();
  } catch (error) {
    console.error("❌ Failed to discover miners:", error);
    process.exit(1);
  }

  // Step 2: Make a governed engine call (auto-routed)
  console.log("Step 2: Making a governed Telegraph engine call (x402 paid)...");
  console.log("-".repeat(80));
  console.log();

  const testAgentId = "demo-agent-001";
  const testMandateId = "demo-mandate-001";

  console.log(`Agent ID: ${testAgentId}`);
  console.log(`Mandate ID: ${testMandateId}`);
  console.log(`Query: "What is the weather forecast for San Francisco?"`);
  console.log();

  try {
    const result = await telegraphGovernanceHelper.governedEngineAsk({
      agentId: testAgentId,
      mandateId: testMandateId,
      engineRequest: {
        query: "What is the weather forecast for San Francisco?",
        confidenceThreshold: 0.7, // 70% confidence required
      },
      description: "Weather check for agent decision-making",
    });

    console.log(`Status: ${result.status.toUpperCase()}`);
    console.log();

    if (result.success && result.response) {
      const data = result.response.data;
      console.log("Response:");
      console.log(`  Answer: ${data.answer}`);
      console.log(`  Miner: ${data.minerName} (${data.minerId})`);
      console.log(`  Confidence: ${data.confidence !== null ? (data.confidence * 100).toFixed(1) + "%" : "unknown"}`);
      console.log(`  Cost: $${data.costUsd}`);
      console.log(`  Latency: ${data.latencyMs}ms`);
      console.log();
    }

    if (result.decision) {
      console.log("Governance Decision:");
      console.log(`  Approved: ${result.decision.approved ? "✅" : "❌"}`);
      console.log(`  Reason: ${result.decision.reason}`);
      console.log(`  Confidence Known: ${result.decision.confidenceKnown ? "✅" : "❌"}`);
      console.log(`  Confidence Met: ${result.decision.confidenceMet ? "✅" : "❌"}`);
      console.log(`  Threshold: ${(result.decision.threshold * 100).toFixed(1)}%`);
      console.log(
        `  Actual: ${result.decision.actualConfidence !== null ? (result.decision.actualConfidence * 100).toFixed(1) + "%" : "unknown"}`,
      );
      console.log();
    }

    if (result.artifact) {
      console.log("CRE Artifact Created:");
      console.log(`  ID: ${result.artifact.id}`);
      console.log(`  Type: ${result.artifact.type}`);
      console.log(`  Created: ${result.artifact.createdAt}`);
      console.log();

      const artifactData = result.artifact.data as any;
      if (artifactData.miner) {
        console.log("  Miner Details:");
        console.log(`    Name: ${artifactData.miner.name}`);
        console.log(`    Auto-routed: ${artifactData.miner.autoRouted ? "Yes" : "No"}`);
      }

      if (artifactData.signal) {
        console.log("  Signal Quality:");
        console.log(`    Confidence: ${artifactData.signal.confidence !== null ? (artifactData.signal.confidence * 100).toFixed(1) + "%" : "unknown"}`);
        console.log(`    Threshold: ${(artifactData.signal.confidenceThreshold * 100).toFixed(1)}%`);
        console.log(`    Met Threshold: ${artifactData.signal.confidenceMet ? "✅" : "❌"}`);
      }

      if (artifactData.cost) {
        console.log("  Payment (x402):");
        console.log(`    Method: ${artifactData.cost.paymentMethod}`);
        console.log(`    Amount: $${artifactData.cost.usd}`);
        console.log(`    Paid: ${artifactData.cost.paid ? "✅" : "❌"}`);
      }

      console.log();
    }

    // Step 3: Show how this would route to an on-chain action
    console.log("Step 3: Intelligence → On-chain Action Pipeline");
    console.log("-".repeat(80));
    console.log();

    if (result.status === "approved" && result.artifact) {
      console.log("✅ High confidence signal - can proceed to on-chain action");
      console.log();
      console.log("Example: If this weather signal indicated a storm risk,");
      console.log("the agent could:");
      console.log("  1. Create spend intent (e.g., hedge with weather derivative)");
      console.log("  2. Route through GovernanceClient.previewSpend");
      console.log("  3. Execute via OwsWalletService if approved");
      console.log("  4. Record full audit trail with Telegraph artifact");
      console.log();

      // Show what the spend intent would look like
      const exampleSpendIntent = telegraphGovernanceHelper.createSpendIntentFromSignal(
        result.artifact,
        {
          recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          amount: "1000000", // 1 USDC in atomic units
          asset: "USDC",
          reason: "Weather-triggered hedge based on verified Telegraph signal",
        },
      );

      console.log("Example Spend Intent:");
      console.log(JSON.stringify(exampleSpendIntent, null, 2));
      console.log();
    } else if (result.status === "held") {
      console.log("⏸️  Low confidence signal - held for operator review");
      console.log();
      console.log("The intelligence was below the confidence threshold (or confidence was unknown).");
      console.log("An operator would:");
      console.log("  1. Review the Telegraph artifact");
      console.log("  2. Check the miner response quality");
      console.log("  3. Decide: approve, reject, or request better intelligence");
      console.log("  4. If approved, continue to spend governance");
      console.log();
    } else {
      console.log("❌ Call failed or denied");
      console.log();
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
    }
  } catch (error) {
    console.error("❌ Demo failed:", error);
    process.exit(1);
  }

  // Step 4: Show node + daemon status
  console.log("Step 4: Telegraph Node + Daemon Status");
  console.log("-".repeat(80));
  console.log();

  try {
    const status = await telegraphService.getNodeStatus();
    console.log(`Node Health: ${status.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
    console.log(`Node URL: ${status.nodeUrl}`);
    console.log(`Miners Available: ${status.minersAvailable}`);
    console.log(`Last Refresh: ${status.lastRefresh}`);
    console.log();
  } catch (error) {
    console.error("❌ Failed to get node status:", error);
  }

  try {
    const daemon = await telegraphService.getDaemonHealth();
    console.log(`Daemon Health: ${daemon.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
    if (daemon.time) console.log(`Daemon Time: ${daemon.time}`);
    console.log();
  } catch (error) {
    console.error("❌ Failed to get daemon status:", error);
  }

  console.log("=".repeat(80));
  console.log("Demo Complete!");
  console.log();
  console.log("Key Takeaways:");
  console.log("  • Telegraph provides verified AI intelligence");
  console.log("  • Cognivern enforces confidence thresholds (real, per-miner signals)");
  console.log("  • Low/unknown confidence → held for review");
  console.log("  • High confidence → can trigger governed actions");
  console.log("  • Full audit trail with telegraph.signal artifacts");
  console.log("  • x402 micropayments settled transparently per call");
  console.log("=".repeat(80));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
