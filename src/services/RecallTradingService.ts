import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger.js';

export interface TradeRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  reason: string;
  slippageTolerance?: string;
  fromChain?: string;
  fromSpecificChain?: string;
  toChain?: string;
  toSpecificChain?: string;
}

export interface TradeResponse {
  success: boolean;
  transaction: {
    id: string;
    agentId: string;
    competitionId: string;
    fromToken: string;
    toToken: string;
    fromAmount: number;
    toAmount: number;
    price: number;
    tradeAmountUsd: number;
    toTokenSymbol: string;
    fromTokenSymbol: string;
    success: boolean;
    error: string | null;
    reason: string;
    timestamp: string;
    fromChain: string;
    toChain: string;
    fromSpecificChain: string;
    toSpecificChain: string;
  };
}

export interface QuoteRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  fromChain?: string;
  fromSpecificChain?: string;
  toChain?: string;
  toSpecificChain?: string;
}

export interface QuoteResponse {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  slippage: number;
  tradeAmountUsd: number;
  prices: {
    fromToken: number;
    toToken: number;
  };
  symbols: {
    fromTokenSymbol: string;
    toTokenSymbol: string;
  };
  chains: {
    fromChain: string;
    toChain: string;
  };
}

export interface TokenPrice {
  success: boolean;
  price: number;
  token: string;
  chain: string;
  specificChain: string;
  symbol: string;
  timestamp: string;
}

export interface AgentInfo {
  id: string;
  ownerId: string;
  walletAddress: string;
  isVerified: boolean;
  name: string;
  description: string;
  email: string;
  imageUrl: string;
  metadata: any;
  status: string;
  stats: {
    completedCompetitions: number;
    totalTrades: number;
    totalVotes: number;
    bestPlacement: {
      competitionId: string;
      rank: number;
      score: number;
      totalAgents: number;
    };
    rank: number;
    score: number;
  };
  trophies: string[];
  skills: string[];
  hasUnclaimedRewards: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service for interacting with Recall's Trading Simulator API
 * Provides real trading capabilities for AI agents in competitions
 */
export class RecallTradingService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.RECALL_TRADING_API_KEY || '';
    this.baseUrl = process.env.RECALL_TRADING_BASE_URL || 'https://api.sandbox.competitions.recall.network';

    if (!this.apiKey) {
      logger.warn('RECALL_TRADING_API_KEY not provided. Trading functionality will be limited.');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Trading API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Trading API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Trading API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Trading API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );

    logger.info('RecallTradingService initialized');
  }

  /**
   * Execute a trade between two tokens
   */
  async executeTrade(tradeRequest: TradeRequest): Promise<TradeResponse> {
    try {
      logger.info(`Executing trade: ${tradeRequest.amount} ${tradeRequest.fromToken} -> ${tradeRequest.toToken}`);

      const response = await this.client.post<TradeResponse>('/api/trade/execute', tradeRequest);

      if (response.data.success) {
        logger.info(`Trade executed successfully: ${response.data.transaction.id}`);
        logger.info(`Trade details: ${response.data.transaction.fromAmount} ${response.data.transaction.fromTokenSymbol} -> ${response.data.transaction.toAmount} ${response.data.transaction.toTokenSymbol}`);
      } else {
        logger.warn(`Trade failed: ${response.data.transaction.error}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Failed to execute trade:', error.response?.data || error.message);
      throw new Error(`Trade execution failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get a quote for a potential trade
   */
  async getQuote(quoteRequest: QuoteRequest): Promise<QuoteResponse> {
    try {
      logger.debug(`Getting quote: ${quoteRequest.amount} ${quoteRequest.fromToken} -> ${quoteRequest.toToken}`);

      const response = await this.client.get<QuoteResponse>('/api/trade/quote', {
        params: quoteRequest,
      });

      logger.debug(`Quote received: ${response.data.fromAmount} -> ${response.data.toAmount} (rate: ${response.data.exchangeRate})`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get quote:', error.response?.data || error.message);
      throw new Error(`Quote request failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get current price for a token
   */
  async getTokenPrice(token: string, chain: string = 'svm', specificChain?: string): Promise<TokenPrice> {
    try {
      const params: any = { token, chain };
      if (specificChain) {
        params.specificChain = specificChain;
      }

      const response = await this.client.get<TokenPrice>('/api/price', { params });

      logger.debug(`Token price: ${response.data.symbol} = $${response.data.price}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get token price:', error.response?.data || error.message);
      throw new Error(`Price request failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get detailed token information
   */
  async getTokenInfo(token: string, chain: string = 'svm', specificChain?: string): Promise<TokenPrice> {
    try {
      const params: any = { token, chain };
      if (specificChain) {
        params.specificChain = specificChain;
      }

      const response = await this.client.get<TokenPrice>('/api/price/token-info', { params });

      logger.debug(`Token info: ${response.data.symbol} (${response.data.token}) = $${response.data.price}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get token info:', error.response?.data || error.message);
      throw new Error(`Token info request failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get market data for trading decisions
   */
  async getMarketData(tokens: string[] = []): Promise<any> {
    try {
      // Default tokens for demo (SOL and USDC)
      const defaultTokens = [
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      ];

      const tokensToFetch = tokens.length > 0 ? tokens : defaultTokens;
      const marketData: any = {
        timestamp: new Date().toISOString(),
        tokens: {},
      };

      // Fetch prices for all tokens
      for (const token of tokensToFetch) {
        try {
          const tokenInfo = await this.getTokenInfo(token);
          marketData.tokens[token] = {
            price: tokenInfo.price,
            symbol: tokenInfo.symbol,
            chain: tokenInfo.chain,
            timestamp: tokenInfo.timestamp,
          };
        } catch (error) {
          logger.warn(`Failed to fetch data for token ${token}:`, error);
        }
      }

      // Add market conditions (simulated for demo)
      marketData.conditions = {
        volatility: 0.15 + Math.random() * 0.25, // 15-40% volatility
        trend: Math.random() > 0.5 ? 'bullish' : 'bearish',
        volume: Math.floor(Math.random() * 1000000) + 100000,
        sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
      };

      return marketData;
    } catch (error: any) {
      logger.error('Failed to get market data:', error);
      throw new Error(`Market data request failed: ${error.message}`);
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get service status
   */
  getStatus(): { configured: boolean; baseUrl: string; hasApiKey: boolean } {
    return {
      configured: this.isConfigured(),
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
    };
  }
}
