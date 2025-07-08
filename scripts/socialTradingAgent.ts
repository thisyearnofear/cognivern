#!/usr/bin/env node

/**
 * Social Trading Agent with Vincent Framework
 *
 * This agent executes trades based on sentiment analysis with community-defined guardrails.
 * Built for the Vincent AI Agent Hackathon Bounty.
 *
 * Features:
 * - User consent flow with Vincent's permission system
 * - Policy implementation (spending limits, time restrictions)
 * - Sentiment analysis from social media and news
 * - Secure execution with Lit Actions
 * - Community governance integration
 */

import dotenv from "dotenv";
import { ethers } from "ethers";

// Load environment variables
dotenv.config();

// Vincent Framework Configuration
const VINCENT_APP_ID = process.env.VINCENT_APP_ID || "827";
const VINCENT_RECALL_API_KEY = process.env.VINCENT_RECALL_API_KEY;
const LIT_PROTOCOL_API_KEY = process.env.LIT_PROTOCOL_API_KEY;

// Validate required API keys
if (!VINCENT_RECALL_API_KEY) {
  console.error("❌ VINCENT_RECALL_API_KEY environment variable is required");
  process.exit(1);
}
const CHRONICLE_YELLOWSTONE_RPC = "https://yellowstone-rpc.litprotocol.com/";

// Social Media APIs for Sentiment Analysis
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

// Trading Configuration
const SUPPORTED_CHAINS = ["ethereum", "polygon", "arbitrum", "base", "solana"];
const SENTIMENT_THRESHOLD = 0.7; // Minimum sentiment score to trigger trades
const MAX_DAILY_TRADES = 10;

interface SentimentData {
  symbol: string;
  sentiment: number; // -1 to 1 scale
  volume: number;
  sources: string[];
  confidence: number;
}

interface TradeSignal {
  action: "buy" | "sell" | "hold";
  token: string;
  amount: string;
  confidence: number;
  reasoning: string;
  sentiment: SentimentData;
}

interface VincentPolicy {
  maxDailySpendingLimitInUsdCents: number;
  allowedTokens: string[];
  maxTradeSize: number;
  timeRestrictions: {
    startHour: number;
    endHour: number;
  };
}

class SocialTradingAgent {
  private provider: ethers.JsonRpcProvider;
  private policies: Map<string, VincentPolicy> = new Map();
  private tradesExecutedToday: number = 0;
  private lastTradeTime: number = 0;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(CHRONICLE_YELLOWSTONE_RPC);
    console.log("🤖 Social Trading Agent initialized");
    console.log("📊 Supported chains:", SUPPORTED_CHAINS.join(", "));
  }

  /**
   * Vincent Framework Integration
   */
  async requestUserConsent(userAddress: string): Promise<boolean> {
    console.log(`🔐 Requesting user consent for ${userAddress}`);

    // Generate Vincent consent URL
    const consentUrl = `https://dashboard.heyvincent.ai/appId/${VINCENT_APP_ID}/consent`;
    console.log(`📋 Consent URL: ${consentUrl}`);

    // In a real implementation, this would redirect user to Vincent consent page
    // For demo purposes, we'll simulate consent
    console.log("✅ User consent granted (simulated)");
    return true;
  }

  async setPolicyForUser(
    userAddress: string,
    policy: VincentPolicy
  ): Promise<void> {
    this.policies.set(userAddress, policy);
    console.log(`📋 Policy set for user ${userAddress}:`, {
      dailyLimit: `$${policy.maxDailySpendingLimitInUsdCents / 100}`,
      allowedTokens: policy.allowedTokens.length,
      maxTradeSize: `$${policy.maxTradeSize}`,
      tradingHours: `${policy.timeRestrictions.startHour}:00-${policy.timeRestrictions.endHour}:00`,
    });
  }

  /**
   * Sentiment Analysis Engine
   */
  async analyzeSentiment(symbol: string): Promise<SentimentData> {
    console.log(`📈 Analyzing sentiment for ${symbol}...`);

    const sentimentSources = await Promise.allSettled([
      this.getTwitterSentiment(symbol),
      this.getRedditSentiment(symbol),
      this.getNewsSentiment(symbol),
    ]);

    let totalSentiment = 0;
    let totalVolume = 0;
    let sources: string[] = [];
    let validSources = 0;

    sentimentSources.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        totalSentiment += result.value.sentiment;
        totalVolume += result.value.volume;
        sources.push(result.value.source);
        validSources++;
      }
    });

    const avgSentiment = validSources > 0 ? totalSentiment / validSources : 0;
    const confidence = validSources / sentimentSources.length;

    return {
      symbol,
      sentiment: avgSentiment,
      volume: totalVolume,
      sources,
      confidence,
    };
  }

  private async getTwitterSentiment(
    symbol: string
  ): Promise<{ sentiment: number; volume: number; source: string }> {
    // Simulate Twitter sentiment analysis
    // In real implementation, use Twitter API v2 with bearer token
    const mockSentiment = Math.random() * 2 - 1; // -1 to 1
    const mockVolume = Math.floor(Math.random() * 1000);

    console.log(
      `🐦 Twitter sentiment for ${symbol}: ${mockSentiment.toFixed(2)}`
    );
    return {
      sentiment: mockSentiment,
      volume: mockVolume,
      source: "twitter",
    };
  }

  private async getRedditSentiment(
    symbol: string
  ): Promise<{ sentiment: number; volume: number; source: string }> {
    // Simulate Reddit sentiment analysis
    // In real implementation, use Reddit API
    const mockSentiment = Math.random() * 2 - 1;
    const mockVolume = Math.floor(Math.random() * 500);

    console.log(
      `📱 Reddit sentiment for ${symbol}: ${mockSentiment.toFixed(2)}`
    );
    return {
      sentiment: mockSentiment,
      volume: mockVolume,
      source: "reddit",
    };
  }

  private async getNewsSentiment(
    symbol: string
  ): Promise<{ sentiment: number; volume: number; source: string }> {
    // Simulate news sentiment analysis
    // In real implementation, use news APIs like NewsAPI, Alpha Vantage, etc.
    const mockSentiment = Math.random() * 2 - 1;
    const mockVolume = Math.floor(Math.random() * 200);

    console.log(`📰 News sentiment for ${symbol}: ${mockSentiment.toFixed(2)}`);
    return {
      sentiment: mockSentiment,
      volume: mockVolume,
      source: "news",
    };
  }

  /**
   * Trading Signal Generation
   */
  async generateTradeSignal(symbol: string): Promise<TradeSignal> {
    const sentiment = await this.analyzeSentiment(symbol);

    let action: "buy" | "sell" | "hold" = "hold";
    let reasoning = "Neutral sentiment, holding position";

    if (sentiment.sentiment > SENTIMENT_THRESHOLD) {
      action = "buy";
      reasoning = `Strong positive sentiment (${sentiment.sentiment.toFixed(2)}) from ${sentiment.sources.join(", ")}`;
    } else if (sentiment.sentiment < -SENTIMENT_THRESHOLD) {
      action = "sell";
      reasoning = `Strong negative sentiment (${sentiment.sentiment.toFixed(2)}) from ${sentiment.sources.join(", ")}`;
    }

    const amount = this.calculateTradeAmount(sentiment);

    return {
      action,
      token: symbol,
      amount,
      confidence: sentiment.confidence,
      reasoning,
      sentiment,
    };
  }

  private calculateTradeAmount(sentiment: SentimentData): string {
    // Calculate trade amount based on sentiment strength and volume
    const baseAmount = 100; // $100 base
    const sentimentMultiplier = Math.abs(sentiment.sentiment);
    const volumeMultiplier = Math.min(sentiment.volume / 1000, 2); // Cap at 2x

    const amount = baseAmount * sentimentMultiplier * volumeMultiplier;
    return Math.min(amount, 1000).toFixed(2); // Cap at $1000
  }

  /**
   * Policy Enforcement
   */
  async validateTrade(
    userAddress: string,
    signal: TradeSignal
  ): Promise<boolean> {
    const policy = this.policies.get(userAddress);
    if (!policy) {
      console.log("❌ No policy found for user");
      return false;
    }

    // Check daily spending limit
    const tradeAmountCents = parseFloat(signal.amount) * 100;
    if (tradeAmountCents > policy.maxDailySpendingLimitInUsdCents) {
      console.log(
        `❌ Trade amount $${signal.amount} exceeds daily limit $${policy.maxDailySpendingLimitInUsdCents / 100}`
      );
      return false;
    }

    // Check allowed tokens
    if (!policy.allowedTokens.includes(signal.token)) {
      console.log(`❌ Token ${signal.token} not in allowed list`);
      return false;
    }

    // Check max trade size
    if (parseFloat(signal.amount) > policy.maxTradeSize) {
      console.log(
        `❌ Trade size $${signal.amount} exceeds max $${policy.maxTradeSize}`
      );
      return false;
    }

    // Check time restrictions
    const currentHour = new Date().getHours();
    if (
      currentHour < policy.timeRestrictions.startHour ||
      currentHour > policy.timeRestrictions.endHour
    ) {
      console.log(
        `❌ Trading outside allowed hours ${policy.timeRestrictions.startHour}-${policy.timeRestrictions.endHour}`
      );
      return false;
    }

    // Check daily trade limit
    if (this.tradesExecutedToday >= MAX_DAILY_TRADES) {
      console.log(`❌ Daily trade limit reached (${MAX_DAILY_TRADES})`);
      return false;
    }

    console.log("✅ Trade validation passed");
    return true;
  }

  /**
   * Trade Execution with Vincent Tools
   */
  async executeTrade(
    userAddress: string,
    signal: TradeSignal
  ): Promise<boolean> {
    console.log(`⚡ Executing ${signal.action} trade for ${signal.token}`);
    console.log(`💰 Amount: $${signal.amount}`);
    console.log(`🎯 Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    console.log(`📝 Reasoning: ${signal.reasoning}`);

    try {
      // Validate trade against policies
      const isValid = await this.validateTrade(userAddress, signal);
      if (!isValid) {
        return false;
      }

      // Execute trade using Vincent Tools (Uniswap Swap Tool)
      // In real implementation, this would use Vincent's Lit Actions
      const result = await this.executeVincentTrade(userAddress, signal);

      if (result) {
        this.tradesExecutedToday++;
        this.lastTradeTime = Date.now();

        // Log to governance system
        await this.logToGovernance(userAddress, signal, result);

        console.log("✅ Trade executed successfully!");
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Trade execution failed:", error);
      return false;
    }
  }

  private async executeVincentTrade(
    userAddress: string,
    signal: TradeSignal
  ): Promise<any> {
    // Simulate Vincent Tool execution
    // In real implementation, this would call Vincent's Uniswap Swap Tool
    console.log("🔧 Executing Vincent Uniswap Swap Tool...");

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      amount: signal.amount,
      token: signal.token,
      action: signal.action,
      timestamp: new Date().toISOString(),
    };
  }

  private async logToGovernance(
    userAddress: string,
    signal: TradeSignal,
    result: any
  ): Promise<void> {
    console.log("📝 Logging to governance system...");

    const governanceLog = {
      userAddress,
      signal,
      result,
      timestamp: new Date().toISOString(),
      agentType: "social-trading",
      policyCompliant: true,
    };

    // In real implementation, this would log to the governance contract
    console.log("📊 Governance log:", JSON.stringify(governanceLog, null, 2));
  }

  /**
   * Main execution loop
   */
  async start(): Promise<void> {
    console.log("🚀 Starting Social Trading Agent...");

    // Demo user setup
    const demoUser = "0x742d35Cc6634C0532925a3b8D0C9C0E3C5C7C5C5";
    const demoPolicy: VincentPolicy = {
      maxDailySpendingLimitInUsdCents: 50000, // $500
      allowedTokens: ["ETH", "USDC", "WBTC", "UNI", "LINK"],
      maxTradeSize: 200, // $200
      timeRestrictions: {
        startHour: 9, // 9 AM
        endHour: 17, // 5 PM
      },
    };

    // Request consent and set policy
    await this.requestUserConsent(demoUser);
    await this.setPolicyForUser(demoUser, demoPolicy);

    // Main trading loop
    const tradingTokens = ["ETH", "USDC", "WBTC"];

    while (true) {
      try {
        for (const token of tradingTokens) {
          console.log(`\n🔍 Analyzing ${token}...`);

          const signal = await this.generateTradeSignal(token);

          if (signal.action !== "hold" && signal.confidence > 0.6) {
            await this.executeTrade(demoUser, signal);
          } else {
            console.log(
              `⏸️ ${signal.action.toUpperCase()} signal for ${token} - confidence too low or holding`
            );
          }

          // Wait between token analysis
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        console.log(
          `\n⏰ Cycle complete. Waiting 60 seconds before next analysis...`
        );
        console.log(
          `📊 Trades executed today: ${this.tradesExecutedToday}/${MAX_DAILY_TRADES}`
        );

        // Wait before next cycle
        await new Promise((resolve) => setTimeout(resolve, 60000));
      } catch (error) {
        console.error("❌ Error in trading loop:", error);
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    }
  }
}

// Start the agent if run directly
if (require.main === module) {
  const agent = new SocialTradingAgent();
  agent.start().catch(console.error);
}

export default SocialTradingAgent;
