#!/usr/bin/env tsx

/**
 * Sapience Forecasting Agent Entry Point
 * 
 * Runs the automated forecasting service to generate and submit predictions
 * to the Sapience protocol on Arbitrum.
 */

import dotenv from 'dotenv';
import { SapienceService } from '../src/services/SapienceService.js';
import { AutomatedForecastingService } from '../src/services/AutomatedForecastingService.js';
import logger from '../src/utils/logger.js';

// Load environment variables
dotenv.config();

async function main() {
  logger.info('🚀 Starting Sapience Forecasting Agent...');

  // Initialize Sapience Service
  const sapienceService = new SapienceService({
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    privateKey: process.env.SAPIENCE_PRIVATE_KEY,
  });

  // Initialize Forecasting Service
  const forecastingService = new AutomatedForecastingService({
    sapienceService,
    llmApiKey: process.env.OPENROUTER_API_KEY,
    llmModel: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
    minConfidence: 0.65, // Slightly higher threshold for competition
  });

  logger.info(`Agent Address: ${sapienceService.getAddress()}`);
  
  // Start the forecasting loop
  // Interval: 30 minutes (to ensure we catch new markets relatively quickly but don't spam)
  const intervalMinutes = 30;
  
  // Also run one cycle immediately
  logger.info('Executing initial forecasting cycle...');
  const initialResult = await forecastingService.runForecastingCycle();
  
  if (initialResult.success) {
    logger.info(`✅ Initial forecast submitted! Tx: ${initialResult.txHash}`);
  } else {
    logger.warn(`⚠️ Initial forecast skipped/failed: ${initialResult.error}`);
  }

  // Start continuous loop
  forecastingService.startContinuousForecasting(intervalMinutes);
  
  // Keep process alive
  process.on('SIGINT', () => {
    logger.info('🛑 Stopping forecasting agent...');
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
