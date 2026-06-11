#!/usr/bin/env tsx

/**
 * Sapience Trading Agent — Standalone Entry Point
 *
 * Runs a single governed cycle against the live Sapience protocol.
 * Every external action (forecast attestation, market trade) is routed
 * through Cognivern's own governance pipeline via GovernanceClient.
 *
 * Prerequisites:
 *   MONGODB_URI       optional (audit log persistence)
 *   COGNIVERN_API_KEY required
 *   COGNIVERN_SELF_BASE_URL  default http://localhost:3000
 *   SAPIENCE_PRIVATE_KEY     required
 *   ARBITRUM_RPC_URL  default https://arb1.arbitrum.io/rpc
 *   ETHEREAL_RPC_URL  default https://rpc.ethereal.trade
 *
 * Run:
 *   pnpm tsx scripts/agents/start-trading.ts
 */

import dotenv from "dotenv";
import { SapienceTradingAgent } from "../src/backend/modules/agents/implementations/SapienceTradingAgent.js";
import { Logger } from "../src/backend/shared/logging/Logger.js";

dotenv.config();

const logger = new Logger("start-trading");

async function main() {
  logger.info("🚀 Starting Sapience Trading Agent (standalone, governed)...");

  const agent = new SapienceTradingAgent(
    "Sapience Standalone Agent",
    {
      maxTradeSize: 1000,
      riskTolerance: 0.1,
      tradingPairs: [],
      strategies: ["forecasting"],
      governanceRules: [],
    },
  );

  try {
    await agent.initialize();
    await agent.start();

    const result = await agent.runCycleWithGovernance();

    logger.info("Cycle complete", {
      success: result.success,
      forecastSubmitted: result.forecastSubmitted,
      tradeSubmitted: result.tradeSubmitted,
      decisionId: result.decisionId,
      attestationHash: result.attestationHash,
      auditLogId: result.auditLogId,
      reason: result.reason,
    });

    await agent.stop();
  } catch (error) {
    logger.error(
      "Cycle failed",
      error instanceof Error ? error : new Error(String(error)),
    );
    process.exit(1);
  }
}

main();
