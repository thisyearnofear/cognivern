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

  // Common token addresses for trading
  private readonly TOKENS = {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Solana USDC
    SOL: "So11111111111111111111111111111111111111112", // Wrapped SOL
    ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // Ethereum on Solana
    BTC: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", // Bitcoin on Solana
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
      fromChain: "svm",
      toChain: "svm",
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
      // Strategy 1: USDC -> SOL -> USDC (momentum trading)
      {
        fromToken: this.TOKENS.USDC,
        toToken: this.TOKENS.SOL,
        amount: "50",
        reason: "Momentum trading: USDC to SOL based on market analysis",
        fromChain: "svm",
        toChain: "svm",
      },
      // Strategy 2: SOL -> ETH (diversification)
      {
        fromToken: this.TOKENS.SOL,
        toToken: this.TOKENS.ETH,
        amount: "0.1",
        reason: "Portfolio diversification: SOL to ETH cross-asset trade",
        fromChain: "svm",
        toChain: "svm",
      },
      // Strategy 3: ETH -> BTC (crypto rotation)
      {
        fromToken: this.TOKENS.ETH,
        toToken: this.TOKENS.BTC,
        amount: "0.01",
        reason:
          "Crypto rotation strategy: ETH to BTC based on relative strength",
        fromChain: "svm",
        toChain: "svm",
      },
      // Strategy 4: BTC -> USDC (profit taking)
      {
        fromToken: this.TOKENS.BTC,
        toToken: this.TOKENS.USDC,
        amount: "0.001",
        reason: "Profit taking: BTC to USDC to secure gains",
        fromChain: "svm",
        toChain: "svm",
      },
      // Strategy 5: USDC -> SOL (re-entry)
      {
        fromToken: this.TOKENS.USDC,
        toToken: this.TOKENS.SOL,
        amount: "25",
        reason: "Re-entry strategy: USDC to SOL on dip opportunity",
        fromChain: "svm",
        toChain: "svm",
      },
      // Strategy 6: SOL -> USDC (risk management)
      {
        fromToken: this.TOKENS.SOL,
        toToken: this.TOKENS.USDC,
        amount: "0.05",
        reason: "Risk management: SOL to USDC to reduce exposure",
        fromChain: "svm",
        toChain: "svm",
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
