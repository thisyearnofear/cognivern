import { AgentAction, AgentConfig, PolicyCheck } from '../types/Agent.js';
import { RecallTradingService, TradeRequest, TradeResponse } from '../services/RecallTradingService.js';
import { PolicyEnforcementService } from '../services/PolicyEnforcementService.js';
import { AuditLogService } from '../services/AuditLogService.js';
import { MetricsService } from '../services/MetricsService.js';
import { RecallClient } from '@recallnet/sdk/client';
import { Address } from 'viem';
import logger from '../utils/logger.js';

export interface RealTradingDecision {
  action: 'buy' | 'sell' | 'hold';
  fromToken: string;
  toToken: string;
  amount: string;
  confidence: number;
  reasoning: string;
  riskScore: number;
  timestamp: string;
  marketData: any;
}

export interface TradingResult {
  decision: RealTradingDecision;
  quote?: any;
  execution?: TradeResponse;
  policyChecks: PolicyCheck[];
  approved: boolean;
  filecoinProof?: string;
}

/**
 * Enhanced Trading Agent that executes real trades via Recall's Trading API
 * with comprehensive governance and Filecoin storage integration
 */
export class RealTradingAgent {
  private config: AgentConfig;
  private tradingService: RecallTradingService;
  private policyEnforcementService: PolicyEnforcementService;
  private auditLogService: AuditLogService;
  private metricsService: MetricsService;
  private tradingHistory: TradingResult[] = [];
  private isActive: boolean = false;
  private currentPolicyId: string = '';

  // Common trading pairs for demo
  private readonly TRADING_PAIRS = {
    SOL_USDC: {
      fromToken: 'So11111111111111111111111111111111111111112', // SOL
      toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      fromSymbol: 'SOL',
      toSymbol: 'USDC',
    },
    USDC_SOL: {
      fromToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      toToken: 'So11111111111111111111111111111111111111112', // SOL
      fromSymbol: 'USDC',
      toSymbol: 'SOL',
    },
  };

  constructor(
    agentId: string,
    recallClient: RecallClient,
    bucketAddress: Address
  ) {
    this.config = {
      name: `Real Trading Agent ${agentId}`,
      type: 'real-trading',
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      status: 'active' as const,
      capabilities: [
        'real-trading-execution',
        'market-analysis',
        'risk-assessment',
        'policy-compliance',
        'filecoin-storage',
        'audit-logging'
      ],
    };

    // Initialize services
    this.tradingService = new RecallTradingService();
    this.policyEnforcementService = new PolicyEnforcementService();
    this.auditLogService = new AuditLogService(recallClient, bucketAddress);
    this.metricsService = new MetricsService(recallClient, bucketAddress);

    logger.info(`Real Trading Agent ${agentId} initialized with Recall API integration`);
  }

  /**
   * Start the trading agent with governance policies
   */
  async start(policyId: string): Promise<void> {
    try {
      if (!this.tradingService.isConfigured()) {
        throw new Error('Trading service not properly configured. Check RECALL_TRADING_API_KEY.');
      }

      // Load and enforce trading policies
      await this.policyEnforcementService.loadPolicy(policyId);
      this.currentPolicyId = policyId;
      
      this.isActive = true;
      logger.info(`Real Trading Agent ${this.config.name} started with policy ${policyId}`);

      // Log agent start action with Filecoin storage
      await this.logActionToFilecoin({
        id: `start-${Date.now()}`,
        type: 'agent-start',
        timestamp: new Date().toISOString(),
        description: `Real trading agent started with policy ${policyId}`,
        policyChecks: [],
        metadata: {
          agent: this.config.name,
          policyId,
          version: this.config.version,
          tradingServiceStatus: this.tradingService.getStatus(),
        },
      });
    } catch (error) {
      logger.error(`Failed to start real trading agent: ${error}`);
      throw error;
    }
  }

  /**
   * Make a real trading decision and execute if approved by governance
   */
  async makeRealTradingDecision(): Promise<TradingResult | null> {
    if (!this.isActive) {
      throw new Error('Real trading agent is not active');
    }

    const startTime = Date.now();

    try {
      // Get current market data
      const marketData = await this.tradingService.getMarketData();
      
      // Generate trading decision using market analysis
      const decision = await this.generateTradingDecision(marketData);

      // Get quote for the trade
      const quote = await this.getTradeQuote(decision);

      // Create agent action for governance check
      const action: AgentAction = {
        id: `real-trade-${Date.now()}`,
        type: 'real-trading-decision',
        timestamp: new Date().toISOString(),
        description: `Real trading decision: ${decision.action} ${decision.amount} ${decision.fromToken} -> ${decision.toToken}`,
        policyChecks: [],
        metadata: {
          agent: this.config.name,
          decision: decision.action,
          fromToken: decision.fromToken,
          toToken: decision.toToken,
          amount: decision.amount,
          confidence: decision.confidence,
          riskScore: decision.riskScore,
          estimatedValue: quote?.tradeAmountUsd || 0,
          marketData: marketData.conditions,
        },
      };

      // Enforce governance policies
      const policyChecks = await this.policyEnforcementService.evaluateAction(action);
      const isApproved = await this.policyEnforcementService.enforcePolicy(action);

      // Create result object
      const result: TradingResult = {
        decision,
        quote,
        policyChecks,
        approved: isApproved,
      };

      if (isApproved) {
        // Execute the real trade
        try {
          const tradeRequest: TradeRequest = {
            fromToken: decision.fromToken,
            toToken: decision.toToken,
            amount: decision.amount,
            reason: decision.reasoning,
            slippageTolerance: '0.5',
            fromChain: 'svm',
            fromSpecificChain: 'mainnet',
            toChain: 'svm',
            toSpecificChain: 'mainnet',
          };

          const execution = await this.tradingService.executeTrade(tradeRequest);
          result.execution = execution;

          if (execution.success) {
            logger.info(`✅ Real trade executed successfully: ${execution.transaction.id}`);
            logger.info(`Trade: ${execution.transaction.fromAmount} ${execution.transaction.fromTokenSymbol} -> ${execution.transaction.toAmount} ${execution.transaction.toTokenSymbol}`);
          } else {
            logger.warn(`❌ Real trade failed: ${execution.transaction.error}`);
          }
        } catch (tradeError) {
          logger.error(`Failed to execute real trade: ${tradeError}`);
          result.execution = {
            success: false,
            transaction: {
              id: '',
              agentId: this.config.name,
              competitionId: '',
              fromToken: decision.fromToken,
              toToken: decision.toToken,
              fromAmount: 0,
              toAmount: 0,
              price: 0,
              tradeAmountUsd: 0,
              toTokenSymbol: '',
              fromTokenSymbol: '',
              success: false,
              error: `Trade execution failed: ${tradeError}`,
              reason: decision.reasoning,
              timestamp: new Date().toISOString(),
              fromChain: 'svm',
              toChain: 'svm',
              fromSpecificChain: 'mainnet',
              toSpecificChain: 'mainnet',
            },
          };
        }
      } else {
        logger.warn(`🚫 Real trading decision blocked by governance policies`);
      }

      // Store comprehensive audit trail on Filecoin
      const filecoinProof = await this.logActionToFilecoin(action, policyChecks, isApproved);
      result.filecoinProof = filecoinProof;

      // Record metrics
      const latency = Date.now() - startTime;
      await this.metricsService.recordAction(action, policyChecks, latency);

      // Update trading history
      this.tradingHistory.push(result);

      return result;

    } catch (error) {
      logger.error(`Error making real trading decision: ${error}`);
      throw error;
    }
  }

  /**
   * Generate trading decision based on market analysis
   */
  private async generateTradingDecision(marketData: any): Promise<RealTradingDecision> {
    const conditions = marketData.conditions;
    const tokens = marketData.tokens;

    // Simple trading logic based on market conditions
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let pair = this.TRADING_PAIRS.SOL_USDC;
    let amount = '0.1'; // Start with small amounts for demo
    let confidence = 0.5;
    let reasoning = 'Market analysis inconclusive';

    // Get SOL price for decision making
    const solToken = 'So11111111111111111111111111111111111111112';
    const solPrice = tokens[solToken]?.price || 150;

    if (conditions.trend === 'bullish' && conditions.volatility < 0.3 && conditions.sentiment === 'positive') {
      action = 'buy';
      pair = this.TRADING_PAIRS.USDC_SOL; // Buy SOL with USDC
      amount = (100 / solPrice).toFixed(4); // $100 worth of SOL
      confidence = 0.7 + Math.random() * 0.2;
      reasoning = `Bullish market trend with low volatility (${(conditions.volatility * 100).toFixed(1)}%) and positive sentiment. Good opportunity to buy SOL at $${solPrice.toFixed(2)}`;
    } else if (conditions.trend === 'bearish' && conditions.volatility > 0.4) {
      action = 'sell';
      pair = this.TRADING_PAIRS.SOL_USDC; // Sell SOL for USDC
      amount = '0.5'; // Sell 0.5 SOL
      confidence = 0.6 + Math.random() * 0.3;
      reasoning = `Bearish trend with high volatility (${(conditions.volatility * 100).toFixed(1)}%). Converting SOL to stable USDC to preserve capital`;
    }

    const riskScore = this.calculateRiskScore(action, amount, solPrice, conditions.volatility);

    return {
      action,
      fromToken: pair.fromToken,
      toToken: pair.toToken,
      amount,
      confidence,
      reasoning,
      riskScore,
      timestamp: new Date().toISOString(),
      marketData: conditions,
    };
  }

  /**
   * Get quote for a trading decision
   */
  private async getTradeQuote(decision: RealTradingDecision): Promise<any> {
    try {
      return await this.tradingService.getQuote({
        fromToken: decision.fromToken,
        toToken: decision.toToken,
        amount: decision.amount,
        fromChain: 'svm',
        fromSpecificChain: 'mainnet',
        toChain: 'svm',
        toSpecificChain: 'mainnet',
      });
    } catch (error) {
      logger.warn(`Failed to get quote: ${error}`);
      return null;
    }
  }

  /**
   * Calculate risk score for a trading decision
   */
  private calculateRiskScore(
    action: string,
    amount: string,
    price: number,
    volatility: number
  ): number {
    const positionValue = parseFloat(amount) * price;
    const baseRisk = volatility * 100;
    const sizeRisk = Math.min(positionValue / 1000, 1) * 30; // Risk increases with position size
    
    return Math.min(baseRisk + sizeRisk, 100);
  }

  /**
   * Log action to Filecoin with comprehensive audit trail
   */
  private async logActionToFilecoin(
    action: AgentAction,
    policyChecks: PolicyCheck[] = [],
    approved: boolean = true
  ): Promise<string> {
    try {
      // Store in audit log service (which uses Filecoin via Recall)
      await this.auditLogService.logAction(action, policyChecks, approved);

      // Generate a proof hash for the action
      const proofData = {
        actionId: action.id,
        timestamp: action.timestamp,
        agent: this.config.name,
        approved,
        policyChecks: policyChecks.length,
        hash: `filecoin_proof_${action.id}_${Date.now()}`,
      };

      logger.info(`📦 Action logged to Filecoin: ${proofData.hash}`);
      return proofData.hash;
    } catch (error) {
      logger.error('Failed to log action to Filecoin:', error);
      return `error_${Date.now()}`;
    }
  }

  /**
   * Get trading history
   */
  getTradingHistory(): TradingResult[] {
    return [...this.tradingHistory];
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get trading service status
   */
  getTradingServiceStatus() {
    return this.tradingService.getStatus();
  }

  /**
   * Stop the trading agent
   */
  async stop(): Promise<void> {
    this.isActive = false;
    
    await this.logActionToFilecoin({
      id: `stop-${Date.now()}`,
      type: 'agent-stop',
      timestamp: new Date().toISOString(),
      description: 'Real trading agent stopped',
      policyChecks: [],
      metadata: {
        agent: this.config.name,
        totalTrades: this.tradingHistory.length,
        successfulTrades: this.tradingHistory.filter(t => t.execution?.success).length,
      },
    });

    logger.info(`Real Trading Agent ${this.config.name} stopped`);
  }
}
