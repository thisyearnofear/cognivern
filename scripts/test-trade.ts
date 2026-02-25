#!/usr/bin/env tsx

/**
 * Test Trade Script
 *
 * Executes a small test trade to verify the trading functionality works
 * before the automated agent tries it.
 */

import dotenv from 'dotenv';
import { SapienceService } from '../src/services/SapienceService.js';
import logger from '../src/utils/logger.js';

dotenv.config();

async function main() {
  logger.info('🧪 Starting test trade...');

  const sapienceService = new SapienceService({
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    etherealRpcUrl: process.env.ETHEREAL_RPC_URL,
    privateKey: process.env.SAPIENCE_PRIVATE_KEY,
  });

  const address = sapienceService.getAddress();
  logger.info(`Agent Address: ${address}`);

  try {
    // Check USDe balance first
    logger.info('Checking USDe balance...');
    const balance = await sapienceService.getUSDeBalance();
    logger.info(`USDe Balance: ${balance}`);

    if (parseFloat(balance) < 1) {
      logger.error('❌ Insufficient USDe balance. Need at least 1 USDe for test trade.');
      process.exit(1);
    }

    // Get a market to trade on
    logger.info('Fetching available markets...');
    const graphqlEndpoint = 'https://api.sapience.xyz/graphql';
    const query = `
      query GetConditions($nowSec: Int, $limit: Int) {
        conditions(
          where: {
            public: { equals: true }
            endTime: { gt: $nowSec }
          }
          take: $limit
          orderBy: { endTime: asc }
        ) {
          id
          question
          shortName
          endTime
        }
      }
    `;

    const nowSec = Math.floor(Date.now() / 1000);
    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { nowSec, limit: 5 } })
    });

    const result = await response.json();
    const conditions = result.data?.conditions;

    if (!conditions || conditions.length === 0) {
      logger.error('❌ No markets available for trading');
      process.exit(1);
    }

    // Use the first available market
    const testMarket = conditions[0];
    logger.info(`Selected test market: ${testMarket.question || testMarket.shortName}`);
    logger.info(`Market ID: ${testMarket.id}`);

    // Execute a small test trade (1 USDe)
    const tradeAmount = '1.0';
    logger.info(`🚀 Executing test trade: BUY YES for ${tradeAmount} USDe`);

    const txHash = await sapienceService.executeTrade({
      marketId: testMarket.id,
      conditionId: testMarket.id,
      amount: tradeAmount,
      side: 'YES',
    });

    logger.info('✅ Test trade executed successfully!');
    logger.info(`Transaction Hash: ${txHash}`);
    logger.info(`View on Ethereal Explorer: https://explorer.ethereal.trade/tx/${txHash}`);

  } catch (error) {
    logger.error('❌ Test trade failed:', error);
    process.exit(1);
  }
}

main();
