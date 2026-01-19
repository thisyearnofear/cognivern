import { ethers } from 'ethers';
import { submitForecast, contracts, CHAIN_ID_ARBITRUM } from '@sapience/sdk';
import logger from '../utils/logger.js';

export interface SapienceConfig {
  arbitrumRpcUrl: string;
  etherealRpcUrl: string;
  privateKey: string;
}

export interface ForecastRequest {
  marketId: string; // The Condition ID (hex string)
  probability: number; // 0-100
  confidence: number;
  reasoning: string;
  resolver?: string; // Optional specific resolver
}

export interface TradeRequest {
  marketId: string;
  amount: string;
  side: 'YES' | 'NO';
  slippage?: number;
}

export class SapienceService {
  private config: SapienceConfig;
  private etherealProvider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(config: Partial<SapienceConfig> = {}) {
    this.config = {
      arbitrumRpcUrl: config.arbitrumRpcUrl || process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      etherealRpcUrl: config.etherealRpcUrl || process.env.ETHEREAL_RPC_URL || 'https://mainnet.ethereal.xyz/rpc', // Default guessed
      privateKey: config.privateKey || process.env.SAPIENCE_PRIVATE_KEY || '',
    };

    if (!this.config.privateKey) {
      logger.warn('SapienceService initialized without private key. Operations will fail.');
    }

    // Ethereal Provider for trading (SDK might not cover trading logic fully yet)
    this.etherealProvider = new ethers.JsonRpcProvider(this.config.etherealRpcUrl);
    if (this.config.privateKey) {
        this.wallet = new ethers.Wallet(this.config.privateKey, this.etherealProvider);
    } else {
        this.wallet = ethers.Wallet.createRandom(this.etherealProvider) as unknown as ethers.Wallet;
    }

    logger.info('SapienceService initialized');
  }

  /**
   * Submit a forecast to the Sapience protocol via EAS using the SDK
   */
  async submitForecast(forecast: ForecastRequest): Promise<string> {
    try {
      logger.info(`Submitting forecast for market ${forecast.marketId}: ${forecast.probability}%`);
      
      if (!this.config.privateKey) {
        throw new Error("Private key required for forecasting");
      }

      // Default to UMA resolver on Arbitrum if not specified
      // Use explicit address casting to satisfy SDK types
      const resolverAddress = (forecast.resolver || contracts.umaResolver[CHAIN_ID_ARBITRUM].address) as `0x${string}`;

      // The SDK's submitForecast handles the EAS attestation details
      const result = await submitForecast({
        resolver: resolverAddress,
        condition: forecast.marketId as `0x${string}`,
        probability: forecast.probability,
        comment: forecast.reasoning,
        privateKey: this.config.privateKey as `0x${string}`
      });

      logger.info(`Forecast submitted! Tx Hash: ${result.hash}`);
      return result.hash;
    } catch (error) {
      logger.error('Failed to submit forecast:', error);
      throw error;
    }
  }

  /**
   * Execute a trade on the prediction market
   * Note: This currently requires interacting with the Ethereal contract directly
   * as the high-level trading SDK might be separate.
   */
  async executeTrade(trade: TradeRequest): Promise<string> {
    try {
      logger.info(`Executing trade on market ${trade.marketId}: ${trade.side} ${trade.amount}`);
      
      // TODO: Use @sapience/sdk/abis to interact with the PredictionMarket contract
      // For now, we stub this until we have the full ABI interaction built out
      
      return `trade-${Date.now()}`;
    } catch (error) {
      logger.error('Failed to execute trade:', error);
      throw error;
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }
}