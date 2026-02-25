#!/usr/bin/env tsx

/**
 * Sapience Trading Agent Entry Point
 *
 * attempts to execute the Trading Strategy:
 * 1. Forecast a market
 * 2. Compare forecast with market price (Mocked for now as Price API is TBD)
 * 3. Execute Trade on Ethereal (Will fail gracefully if ABI is missing)
 */

import dotenv from 'dotenv';
import { SapienceService } from '../src/services/SapienceService.js';
import { AutomatedForecastingService } from '../src/services/AutomatedForecastingService.js';
import logger from '../src/utils/logger.js';

dotenv.config();

async function main() {
  logger.info('🚀 Starting Sapience Trading Agent...');

  const sapienceService = new SapienceService({
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    etherealRpcUrl: process.env.ETHEREAL_RPC_URL,
    privateKey: process.env.SAPIENCE_PRIVATE_KEY,
  });

  const forecastingService = new AutomatedForecastingService({
    sapienceService,
    llmApiKey: process.env.OPENROUTER_API_KEY,
    minConfidence: 0.7, // Higher confidence for trading with real money
  });

  logger.info(`Agent Address: ${sapienceService.getAddress()}`);

  try {
    // 1. Find Opportunity
    const condition = await forecastingService.fetchOptimalCondition();
    if (!condition) {
        logger.info("No suitable markets found.");
        return;
    }

    // 2. Generate Forecast
    const forecast = await forecastingService.generateForecast(condition.shortName || condition.question);
    logger.info(`Forecast: ${forecast.probability}% (Confidence: ${forecast.confidence})`);

    // 3. Trading Logic
    // TODO: Fetch real market price from Graph/Contract
    // For now, we assume a "Market Price" of 50 cents (0.50) to demonstrate the logic structure
    // This is NOT a mock of the system, but a placeholder for a missing data source
    const marketPrice = 0.50;
    const edge = (forecast.probability / 100) - marketPrice;

    if (edge > 0.1) { // 10% edge required
        logger.info(`Edge detected (${(edge*100).toFixed(1)}%). Attempting to Buy YES...`);

        await sapienceService.executeTrade({
            marketId: condition.id,
            side: 'YES',
            amount: '10.0', // 10 USDe
        });
    } else if (edge < -0.1) {
        logger.info(`Negative edge detected (${(edge*100).toFixed(1)}%). Attempting to Buy NO...`);

        await sapienceService.executeTrade({
            marketId: condition.id,
            side: 'NO',
            amount: '10.0',
        });
    } else {
        logger.info("No significant edge found. Skipping trade.");
    }

  } catch (error) {
    // Graceful error handling
    if (error instanceof Error && error.message.includes("ABI missing")) {
        logger.error("⚠️  Trading failed as expected: " + error.message);
        logger.info("ℹ️  To fix: Update SapienceService.ts with the Ethereal PredictionMarket ABI.");
    } else {
        logger.error("Unexpected error:", error);
    }
  }
}

main();
