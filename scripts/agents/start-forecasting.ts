#!/usr/bin/env tsx

/**
 * Sapience Forecasting Agent — Standalone Entry Point
 *
 * Runs a continuous forecast loop against the Sapience protocol.
 * Every forecast attestation is gated by Cognivern's governance pipeline
 * via GovernanceClient. Trades ≥ 10 USDe are held for human confirmation.
 *
 * Prerequisites:
 *   COGNIVERN_API_KEY          required
 *   COGNIVERN_SELF_BASE_URL   default http://localhost:3000
 *   SAPIENCE_PRIVATE_KEY      required
 *   ARBITRUM_RPC_URL          default https://arb1.arbitrum.io/rpc
 *   SAPIENCE_HUMAN_CONFIRM_TOKEN  optional (set to enable >= 10 USDe trades)
 *
 * Run:
 *   pnpm tsx scripts/agents/start-forecasting.ts
 */

import dotenv from "dotenv";
import { SapienceTradingAgent } from "../src/backend/modules/agents/implementations/SapienceTradingAgent.js";
import { Logger } from "../src/backend/shared/logging/Logger.js";

dotenv.config();

const logger = new Logger("start-forecasting");

const INTERVAL_MINUTES = parseInt(process.env.FORECAST_INTERVAL_MINUTES || "30");

async function main() {
  logger.info(
    `🚀 Starting Sapience Forecasting Agent (governed, every ${INTERVAL_MINUTES} min)...`,
  );

  const agent = new SapienceTradingAgent(
    "Sapience Standalone Forecasting Agent",
    {
      maxTradeSize: 1000,
      riskTolerance: 0.1,
      tradingPairs: [],
      strategies: ["forecasting"],
      governanceRules: [],
    },
  );

  await agent.initialize();
  await agent.start();

  const tick = async () => {
    try {
      const result = await agent.runCycleWithGovernance();
      logger.info("Cycle complete", {
        success: result.success,
        forecastSubmitted: result.forecastSubmitted,
        tradeSubmitted: result.tradeSubmitted,
        decisionId: result.decisionId,
        attestationHash: result.attestationHash,
        reason: result.reason,
      });
    } catch (error) {
      logger.error(
        "Cycle failed",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  // Run once immediately, then on an interval.
  await tick();
  setInterval(tick, INTERVAL_MINUTES * 60_000);

  process.on("SIGINT", async () => {
    logger.info("🛑 Stopping forecasting agent...");
    await agent.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(
    "Fatal error",
    error instanceof Error ? error : new Error(String(error)),
  );
  process.exit(1);
});
