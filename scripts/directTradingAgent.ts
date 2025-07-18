#!/usr/bin/env node

/**
 * Direct Trading Agent for Recall Competition
 *
 * This agent executes trades directly via the Recall API without MCP.
 * Designed for the 7 Day Trading Challenge (July 8-15, $10,000 prize pool).
 *
 * Requirements:
 * - 3+ trades per day
 * - Uses Recall's trading simulator API
 * - Rate limits: 60 read/20 write/10 account ops per minute
 */

import dotenv from "dotenv";

// Use built-in fetch (Node.js 18+)
declare const fetch: typeof globalThis.fetch;

// Load environment variables
dotenv.config();

const API_KEY = process.env.RECALL_TRADING_API_KEY;
const BASE_URL =
  process.env.RECALL_TRADING_BASE_URL ||
  "https://api.sandbox.competitions.recall.network";

if (!API_KEY) {
  console.error("❌ RECALL_TRADING_API_KEY not found in environment");
  process.exit(1);
}

interface TradeRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  reason: string;
  fromChain?: string;
  toChain?: string;
  fromSpecificChain?: string;
  toSpecificChain?: string;
  slippageTolerance?: number;
}

interface TradeResponse {
  success: boolean;
  transaction?: {
    id: string;
    fromToken: string;
    toToken: string;
    amount: number;
    timestamp: string;
  };
  error?: string;
}

interface QuoteResponse {
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
}

class DirectTradingAgent {
  private headers: Record<string, string>;
  private tradesExecutedToday = 0;
  private readonly MIN_TRADE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours between trades
  private readonly DAILY_TRADE_TARGET = 6; // 6 trades per day (every 4 hours)

  // Common token addresses for trading (Ethereum mainnet - sandbox is mainnet fork)
  private readonly TOKENS = {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Wrapped ETH
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // Wrapped BTC
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI Stablecoin
  };

  constructor() {
    this.headers = {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };
  }

  private async makeRequest(
    endpoint: string,
    method = "GET",
    body?: any
  ): Promise<any> {
    const url = `${BASE_URL}${endpoint}`;

    try {
      // Add timeout for slow API responses
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.error(`⏰ Request timeout for ${endpoint} (30s)`);
        throw new Error(`Request timeout for ${endpoint}`);
      }
      console.error(`❌ Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  private async getQuote(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<QuoteResponse> {
    const params = new URLSearchParams({
      fromToken,
      toToken,
      amount,
    });

    return await this.makeRequest(`/api/trade/quote?${params}`);
  }

  private async executeTrade(
    tradeRequest: TradeRequest
  ): Promise<TradeResponse> {
    return await this.makeRequest("/api/trade/execute", "POST", tradeRequest);
  }

  private async getBalance(): Promise<any> {
    return await this.makeRequest("/api/agent/balances");
  }

  private generateTradingStrategy(): TradeRequest[] {
    const strategies = [
      // Strategy 1: USDC -> WETH (momentum trading)
      {
        fromToken: this.TOKENS.USDC,
        toToken: this.TOKENS.WETH,
        amount: "100",
        reason: "Momentum trading: USDC to WETH based on market analysis",
      },
      // Strategy 2: WETH -> WBTC (diversification)
      {
        fromToken: this.TOKENS.WETH,
        toToken: this.TOKENS.WBTC,
        amount: "0.05",
        reason: "Portfolio diversification: WETH to WBTC cross-asset trade",
      },
      // Strategy 3: WBTC -> DAI (crypto rotation)
      {
        fromToken: this.TOKENS.WBTC,
        toToken: this.TOKENS.DAI,
        amount: "0.001",
        reason:
          "Crypto rotation strategy: WBTC to DAI based on relative strength",
      },
      // Strategy 4: DAI -> USDC (stablecoin arbitrage)
      {
        fromToken: this.TOKENS.DAI,
        toToken: this.TOKENS.USDC,
        amount: "50",
        reason: "Stablecoin arbitrage: DAI to USDC for yield optimization",
      },
      // Strategy 5: USDC -> WETH (re-entry)
      {
        fromToken: this.TOKENS.USDC,
        toToken: this.TOKENS.WETH,
        amount: "75",
        reason: "Re-entry strategy: USDC to WETH on dip opportunity",
      },
      // Strategy 6: WETH -> USDC (risk management)
      {
        fromToken: this.TOKENS.WETH,
        toToken: this.TOKENS.USDC,
        amount: "0.03",
        reason: "Risk management: WETH to USDC to reduce exposure",
      },
    ];

    return strategies;
  }

  private async executeNextTrade(): Promise<void> {
    const now = Date.now();

    // Check if we've hit daily target
    if (this.tradesExecutedToday >= this.DAILY_TRADE_TARGET) {
      console.log(
        `✅ Daily target reached: ${this.tradesExecutedToday}/${this.DAILY_TRADE_TARGET} trades`
      );
      return;
    }

    console.log(`⏰ Current time: ${new Date().toISOString()}`);
    console.log(
      `📊 Trades today: ${this.tradesExecutedToday}/${this.DAILY_TRADE_TARGET}`
    );

    try {
      // Get current balance
      console.log("📊 Checking current balance...");
      const balance = await this.getBalance();
      console.log("💰 Current balance:", JSON.stringify(balance, null, 2));

      // Generate trading strategies
      const strategies = this.generateTradingStrategy();
      const currentStrategy =
        strategies[this.tradesExecutedToday % strategies.length];

      console.log(
        `🎯 Executing trade ${this.tradesExecutedToday + 1}/${this.DAILY_TRADE_TARGET}`
      );
      console.log(`📈 Strategy: ${currentStrategy.reason}`);

      // Get quote first
      console.log("💱 Getting quote...");
      const quote = await this.getQuote(
        currentStrategy.fromToken,
        currentStrategy.toToken,
        currentStrategy.amount
      );

      console.log(
        `📊 Quote: ${quote.fromAmount} ${quote.symbols.fromTokenSymbol} → ${quote.toAmount} ${quote.symbols.toTokenSymbol}`
      );
      console.log(`💵 Trade value: $${quote.tradeAmountUsd.toFixed(2)}`);

      // Execute the trade
      console.log("⚡ Executing trade...");
      const result = await this.executeTrade(currentStrategy);

      if (result.success) {
        this.tradesExecutedToday++;

        console.log("✅ Trade executed successfully!");
        console.log(`📝 Transaction ID: ${result.transaction?.id}`);
        console.log(
          `📊 Progress: ${this.tradesExecutedToday}/${this.DAILY_TRADE_TARGET} trades today`
        );
      } else {
        console.error("❌ Trade failed:", result.error);
      }
    } catch (error) {
      console.error("❌ Trade execution error:", error);
    }
  }

  public async start(): Promise<void> {
    console.log("🚀 Starting Direct Trading Agent for Recall Competition");
    console.log(
      `🎯 Target: ${this.DAILY_TRADE_TARGET} trades per day (every ${this.MIN_TRADE_INTERVAL / (60 * 60 * 1000)} hours)`
    );
    console.log(
      `🏆 Competition: 7 Day Trading Challenge (July 8-15, $10,000 prize pool)`
    );

    // Reset daily counter at midnight
    const resetDaily = () => {
      this.tradesExecutedToday = 0;
      console.log("🌅 New day started - resetting trade counter");
    };

    // Calculate time until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set up daily reset
    setTimeout(() => {
      resetDaily();
      setInterval(resetDaily, 24 * 60 * 60 * 1000); // Every 24 hours
    }, msUntilMidnight);

    // Execute initial trade
    await this.executeNextTrade();

    // Set up trading interval (every 4 hours)
    setInterval(async () => {
      await this.executeNextTrade();
    }, this.MIN_TRADE_INTERVAL);

    console.log("✅ Trading agent is running...");
  }
}

// Start the agent
const agent = new DirectTradingAgent();
agent.start().catch(console.error);
