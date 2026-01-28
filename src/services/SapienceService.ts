import { ethers } from 'ethers';
import {
  submitForecast,
  contracts,
  CHAIN_ID_ARBITRUM,
  prepareForTrade,
  CHAIN_ID_ETHEREAL
} from '@sapience/sdk';
import logger from '../utils/logger.js';

// Minimal Prediction Market ABI for trading
const PREDICTION_MARKET_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      {
        name: "mintPredictionRequestData",
        type: "tuple",
        components: [
          { name: "encodedPredictedOutcomes", type: "bytes" },
          { name: "resolver", type: "address" },
          { name: "makerCollateral", type: "uint256" },
          { name: "takerCollateral", type: "uint256" },
          { name: "maker", type: "address" },
          { name: "taker", type: "address" },
          { name: "makerNonce", type: "uint256" },
          { name: "takerSignature", type: "bytes" },
          { name: "takerDeadline", type: "uint256" },
          { name: "refCode", type: "bytes32" }
        ]
      }
    ],
    outputs: [
      { name: "makerNftTokenId", type: "uint256" },
      { name: "takerNftTokenId", type: "uint256" }
    ],
    stateMutability: "nonpayable"
  }
];

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
  conditionId: string; // The condition bytes
  resolver?: string; // The resolver address
}

export interface MarketPrice {
  yesPrice: number; // 0-1
  noPrice: number; // 0-1
  liquidity: string;
}

export class SapienceService {
  private config: SapienceConfig;
  private etherealProvider: ethers.JsonRpcProvider;
  private arbitrumProvider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(config: Partial<SapienceConfig> = {}) {
    this.config = {
      arbitrumRpcUrl: config.arbitrumRpcUrl || process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      etherealRpcUrl: config.etherealRpcUrl || process.env.ETHEREAL_RPC_URL || 'https://rpc.ethereal.trade',
      privateKey: config.privateKey || process.env.SAPIENCE_PRIVATE_KEY || '',
    };

    if (!this.config.privateKey) {
      logger.warn('SapienceService initialized without private key. Operations will fail.');
    }

    // Ethereal Provider for trading
    this.etherealProvider = new ethers.JsonRpcProvider(this.config.etherealRpcUrl);
    // Arbitrum Provider for forecasting
    this.arbitrumProvider = new ethers.JsonRpcProvider(this.config.arbitrumRpcUrl);
    
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
   * Get current market price from Sapience GraphQL
   * This is used to calculate edge for trading
   */
  async getMarketPrice(conditionId: string): Promise<MarketPrice | null> {
    try {
      const graphqlEndpoint = 'https://api.sapience.xyz/graphql';
      const query = `
        query GetMarketPrice($conditionId: String!) {
          condition(id: $conditionId) {
            id
            question
            currentPrice
            liquidity
            volume
            outcomes {
              id
              name
              price
            }
          }
        }
      `;

      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { conditionId } })
      });

      const result = await response.json();
      const condition = result.data?.condition;
      
      if (!condition) {
        logger.warn(`No market data found for condition ${conditionId}`);
        return null;
      }

      // Parse outcomes to get YES/NO prices
      const yesOutcome = condition.outcomes?.find((o: any) => 
        o.name?.toLowerCase().includes('yes') || o.name === '1'
      );
      const noOutcome = condition.outcomes?.find((o: any) => 
        o.name?.toLowerCase().includes('no') || o.name === '0'
      );

      return {
        yesPrice: yesOutcome ? parseFloat(yesOutcome.price) : 0.5,
        noPrice: noOutcome ? parseFloat(noOutcome.price) : 0.5,
        liquidity: condition.liquidity || '0'
      };
    } catch (error) {
      logger.error('Failed to fetch market price:', error);
      return null;
    }
  }

  /**
   * Execute a trade on the prediction market using the Sapience SDK
   * This uses the Ethereal chain for trading with USDe collateral
   */
  async executeTrade(trade: TradeRequest): Promise<string> {
    try {
      logger.info(`Executing trade on market ${trade.marketId}: ${trade.side} ${trade.amount}`);
      
      if (!this.config.privateKey) {
        throw new Error("Private key required for trading");
      }

      // Get the prediction market contract address on Ethereal
      const marketAddress = contracts.predictionMarket[CHAIN_ID_ETHEREAL]?.address;
      if (!marketAddress) {
        throw new Error("Prediction market contract address not found for Ethereal chain");
      }

      // Get the resolver address
      const resolverAddress = (trade.resolver || contracts.umaResolver[CHAIN_ID_ETHEREAL]?.address) as `0x${string}`;
      if (!resolverAddress) {
        throw new Error("Resolver address not found for Ethereal chain");
      }

      // Parse amount to bigint (USDe has 18 decimals)
      const amount = ethers.parseUnits(trade.amount, 18);

      // Step 1: Prepare for trade - wrap USDe and approve
      logger.info(`Preparing collateral for trade: ${trade.amount} USDe`);
      const preparation = await prepareForTrade({
        privateKey: this.config.privateKey as `0x${string}`,
        collateralAmount: amount,
        spender: marketAddress as `0x${string}`,
        rpcUrl: this.config.etherealRpcUrl
      });

      if (!preparation.ready) {
        throw new Error("Failed to prepare collateral for trading");
      }

      logger.info(`Collateral ready. WUSDe balance: ${preparation.wusdBalance.toString()}`);

      // Step 2: Create the prediction outcome encoding
      // For binary markets: YES = 1, NO = 0
      const outcome = trade.side === 'YES' ? 1 : 0;
      const encodedOutcomes = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256[]'],
        [[outcome]]
      );

      // Step 3: Build the mint prediction request
      // This is a simplified version - full implementation would use the auction/relayer system
      const mintRequest = {
        encodedPredictedOutcomes: encodedOutcomes as `0x${string}`,
        resolver: resolverAddress,
        makerCollateral: amount,
        takerCollateral: BigInt(0), // We're taking the full position
        maker: this.wallet.address as `0x${string}`,
        taker: ethers.ZeroAddress as `0x${string}`, // No specific taker
        makerNonce: BigInt(Date.now()),
        takerSignature: '0x' as `0x${string}`, // Empty for market orders
        takerDeadline: BigInt(0),
        refCode: ethers.encodeBytes32String('') as `0x${string}`
      };

      // Step 4: Create contract instance and execute mint
      const marketContract = new ethers.Contract(
        marketAddress,
        PREDICTION_MARKET_ABI,
        this.wallet
      );

      logger.info(`Minting prediction position...`);
      const tx = await marketContract.mint(mintRequest);
      
      logger.info(`Trade submitted! Tx Hash: ${tx.hash}`);
      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        logger.info(`Trade executed successfully!`);
        return tx.hash;
      } else {
        throw new Error("Transaction failed");
      }

    } catch (error) {
      logger.error('Failed to execute trade:', error);
      throw error;
    }
  }

  /**
   * Calculate trading edge based on forecast vs market price
   * Returns positive edge for YES, negative for NO
   */
  calculateEdge(forecastProbability: number, marketPrice: MarketPrice): number {
    const forecastDecimal = forecastProbability / 100;
    
    // Edge for YES position
    const yesEdge = forecastDecimal - marketPrice.yesPrice;
    // Edge for NO position  
    const noEdge = (1 - forecastDecimal) - marketPrice.noPrice;

    // Return the better edge
    return yesEdge > noEdge ? yesEdge : -noEdge;
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get real ETH balance from the network
   */
  async getEthBalance(): Promise<string> {
    try {
        const provider = new ethers.JsonRpcProvider(this.config.arbitrumRpcUrl);
        const balance = await provider.getBalance(this.wallet.address);
        return ethers.formatEther(balance);
    } catch (error) {
        logger.error('Failed to fetch ETH balance:', error);
        return "0";
    }
  }

  /**
   * Get USDe balance on Ethereal chain
   */
  async getUSDeBalance(): Promise<string> {
    try {
        // USDe token contract on Ethereal
        const usdeAddress = contracts.collateralToken[CHAIN_ID_ETHEREAL]?.address;
        if (!usdeAddress) {
          return "0";
        }

        const tokenContract = new ethers.Contract(
          usdeAddress,
          ['function balanceOf(address) view returns (uint256)'],
          this.etherealProvider
        );

        const balance = await tokenContract.balanceOf(this.wallet.address);
        return ethers.formatUnits(balance, 18);
    } catch (error) {
        logger.error('Failed to fetch USDe balance:', error);
        return "0";
    }
  }
}
