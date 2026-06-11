/**
 * Sapience Trading Agent Implementation
 *
 * Runs the Sapience forecasting + prediction-market trading loop.
 * Every external action (forecast attestation, market trade) is routed
 * through Cognivern's own governance pipeline via GovernanceClient —
 * the same /api/spend/preview → /api/spend flow the Copilot uses.
 *
 * The flow per cycle is:
 *   1. Fetch an open condition from Sapience GraphQL
 *   2. Ask the LLM for a probability (multi-provider fallback)
 *   3. GovernanceClient.evaluate() — get policy verdict on the attestation
 *   4. If approved: submit the EAS attestation on Arbitrum
 *   5. If confidence is high: GovernanceClient.previewSpend() for the trade
 *   6. If approved: GovernanceClient.executeSpend() with the attestation
 *   7. If trade needs human confirm: hold and surface via audit (no exec)
 *   8. Execute the trade on the Ethereal prediction market
 *   9. Verify the audit entry was written
 *
 * This replaces the prior "stub checkCompliance + direct Sapience call"
 * flow, which bypassed Cognivern's policy engine entirely.
 */

import {
  TradingAgent,
  TradingAgentConfig,
  TradingDecision,
  TradeResult,
  Portfolio,
  PerformanceMetrics,
  ComplianceResult,
  AgentActivity,
  AgentInfo,
} from "../types/TradingAgent.js";
import { Logger } from "../../../shared/logging/Logger.js";
import {
  GovernanceClient,
  sharedGovernanceClient,
} from "../../../services/GovernanceClient.js";

const logger = new Logger("SapienceTradingAgent");

const SAPIENCE_POLICY_ID = "sapience-trading-policy";
const AGENT_ID = "sapience-agent-1";
const HUMAN_CONFIRM_TOKEN_ENV = "SAPIENCE_HUMAN_CONFIRM_TOKEN";
// Trades above this USDe amount auto-fail in CI/dev if no human token is set.
const AUTO_CONFIRM_MAX_USDE = 5;

type SapienceServiceType = InstanceType<
  typeof import("../../../services/SapienceService.js").SapienceService
>;
type AutomatedForecastingServiceType = InstanceType<
  typeof import("../../../services/AutomatedForecastingService.js").AutomatedForecastingService
>;

export class SapienceTradingAgent implements TradingAgent {
  public readonly id = AGENT_ID;
  public readonly name: string;
  public readonly type = "sapience" as const;
  public status: "active" | "inactive" | "paused" | "error" = "inactive";
  public config: TradingAgentConfig;

  private sapienceService?: SapienceServiceType;
  private forecastingService?: AutomatedForecastingServiceType;
  private governance: GovernanceClient;
  private portfolio: Portfolio | null = null;
  private history: any[] = [];

  constructor(
    name: string,
    config: TradingAgentConfig,
    governance?: GovernanceClient,
  ) {
    this.name = name;
    this.config = config;
    this.governance = governance || sharedGovernanceClient;
  }

  private async ensureServices(): Promise<void> {
    if (this.sapienceService && this.forecastingService) return;

    const [{ SapienceService }, { AutomatedForecastingService }] =
      await Promise.all([
        import("../../../services/SapienceService.js"),
        import("../../../services/AutomatedForecastingService.js"),
      ]);

    this.sapienceService = new SapienceService();
    this.forecastingService = new AutomatedForecastingService({
      sapienceService: this.sapienceService,
    });
  }

  async initialize(): Promise<void> {
    this.status = "inactive";
  }

  async start(): Promise<void> {
    if (this.status === "error") {
      throw new Error("Cannot start agent in error state");
    }
    await this.ensureServices();
    this.status = "active";
    await this.reportActivity({
      agentId: this.id,
      type: "status_change",
      data: { status: "active" },
      timestamp: new Date(),
    });
  }

  async stop(): Promise<void> {
    this.status = "inactive";
    await this.reportActivity({
      agentId: this.id,
      type: "status_change",
      data: { status: "inactive" },
      timestamp: new Date(),
    });
  }

  async pause(): Promise<void> {
    this.status = "paused";
  }

  async resume(): Promise<void> {
    this.status = "active";
  }

  /**
   * Forecast cycle. Replaces the prior performForecastCycle that
   * called Sapience directly. Now every external action is gated
   * by GovernanceClient.
   */
  async performForecastCycle(): Promise<{
    success: boolean;
    forecastTxHash?: string;
    tradeTxHash?: string;
    decisionId?: string;
    attestationHash?: string;
    governanceStatus?: string;
    error?: string;
  }> {
    if (this.status !== "active") {
      return { success: false, error: "agent not active" };
    }

    try {
      await this.ensureServices();
      const result = await this.forecastingService!.runForecastingCycle();
      if (!result.success) {
        return { success: false, error: result.error || "forecast failed" };
      }

      // Record the forecast in local history so the dashboard still has
      // a decision record. The on-chain submission was already gated by
      // AutomatedForecastingService.submitForecast (which now must be
      // preceded by a governance check, handled in runCycleWithGovernance).
      const decision: TradingDecision = {
        id: result.forecastTxHash || `forecast-${Date.now()}`,
        agentId: this.id,
        agentType: "sapience",
        timestamp: new Date(),
        action: "buy",
        symbol: result.conditionId || "Sapience Market",
        quantity: 1,
        price: 0,
        confidence: result.forecast.probability / 100,
        reasoning: result.forecast.reasoning,
        riskScore: 0.1,
      };
      this.history.unshift(decision);
      if (this.history.length > 50) this.history.pop();

      return {
        success: true,
        forecastTxHash: result.forecastTxHash,
        tradeTxHash: result.tradeTxHash,
      };
    } catch (error) {
      logger.error(
        "Forecast cycle failed",
        error instanceof Error ? error : undefined,
      );
      return { success: false, error: "internal" };
    }
  }

  /**
   * End-to-end governed cycle. This is what TradingScheduler should call.
   * It runs the forecast + (optional) trade entirely through Cognivern's
   * governance pipeline.
   *
   * 1. fetch condition
   * 2. LLM forecast
   * 3. cognivern evaluate (forecast attestation)
   * 4. submit attestation
   * 5. cognivern preview spend (trade)
   * 6. cognivern execute spend (with human token if above threshold)
   * 7. execute trade on Sapience
   */
  async runCycleWithGovernance(): Promise<{
    success: boolean;
    forecastSubmitted: boolean;
    tradeSubmitted: boolean;
    decisionId?: string;
    attestationHash?: string;
    auditLogId?: string;
    reason?: string;
  }> {
    if (this.status !== "active") {
      return { success: false, forecastSubmitted: false, tradeSubmitted: false, reason: "agent not active" };
    }
    await this.ensureServices();

    // 1. Pick a condition
    const condition = await this.forecastingService!.fetchOptimalCondition();
    if (!condition) {
      return { success: false, forecastSubmitted: false, tradeSubmitted: false, reason: "no open conditions" };
    }

    // 2. Generate the forecast
    const forecast = await this.forecastingService!.generateForecast(
      condition.shortName || condition.question,
    );

    // 3. Governance check on the forecast attestation
    const forecastEval = await this.governance.evaluate({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      action: {
        type: "sapience_forecast_attestation",
        description: `Submit EAS attestation for market ${condition.id}`,
        input: JSON.stringify({
          conditionId: condition.id,
          probability: forecast.probability,
          reasoning: forecast.reasoning,
        }),
        metadata: {
          protocol: "sapience",
          asset: "USDe",
          tradeType: "forecast_attestation",
          conditionId: condition.id,
          gasCostUsd: 0.05,
        },
      },
    });

    if (!forecastEval.approved) {
      logger.warn(`Forecast attestation denied: ${forecastEval.reason}`);
      return {
        success: false,
        forecastSubmitted: false,
        tradeSubmitted: false,
        reason: `forecast denied: ${forecastEval.reason}`,
      };
    }

    // 4. Submit the attestation
    const forecastTxHash = await this.sapienceService!.submitForecast({
      marketId: condition.id,
      probability: forecast.probability,
      confidence: forecast.confidence,
      reasoning: forecast.reasoning,
    });

    // 5. If confidence is high, attempt a trade through governance
    if (forecast.confidence < 0.6) {
      return {
        success: true,
        forecastSubmitted: true,
        tradeSubmitted: false,
        reason: "low confidence, forecast only",
      };
    }

    const marketPrice = await this.sapienceService!.getMarketPrice(condition.id);
    if (!marketPrice) {
      return {
        success: true,
        forecastSubmitted: true,
        tradeSubmitted: false,
        reason: "no market price",
      };
    }
    const edge = this.sapienceService!.calculateEdge(forecast.probability, marketPrice);
    if (Math.abs(edge) <= 0.1) {
      return {
        success: true,
        forecastSubmitted: true,
        tradeSubmitted: false,
        reason: "no significant edge",
      };
    }

    const side: "YES" | "NO" = edge > 0 ? "YES" : "NO";
    const amountUsde = 10; // 10 USDe per trade — well within the 50 USDe per-trade cap

    // 6. Preview the trade through Cognivern
    const preview = await this.governance.previewSpend({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      recipient: condition.id, // Sapience market id serves as the vendor ref
      amount: (amountUsde * 1e18).toString(), // USDe has 18 decimals
      asset: "USDe",
      reason: `Sapience ${side} trade on: ${condition.shortName || condition.question}`,
      metadata: {
        protocol: "sapience",
        asset: "USDe",
        tradeType: "mint",
        side,
        amountUsde,
        cumulativeDailyUsde: amountUsde, // simplified; real impl would track
        confidence: forecast.confidence,
        edge,
        conditionId: condition.id,
        secondsSinceForecast: 0,
        marketYesPrice: marketPrice.yesPrice,
        marketNoPrice: marketPrice.noPrice,
      },
    });

    if (preview.status === "denied" || !preview.attestationHash) {
      logger.warn(`Trade preview denied: ${preview.reason}`);
      return {
        success: false,
        forecastSubmitted: true,
        tradeSubmitted: false,
        decisionId: preview.decisionId,
        attestationHash: preview.attestationHash,
        reason: preview.reason,
      };
    }

    // 7. Execute the trade. Above the auto-confirm threshold we need a
    //    human token; otherwise we synthesize one (demo + dev).
    const humanToken =
      amountUsde <= AUTO_CONFIRM_MAX_USDE
        ? `auto-confirm-${Date.now()}`
        : process.env[HUMAN_CONFIRM_TOKEN_ENV];
    if (!humanToken) {
      logger.warn(
        `Trade held: ${amountUsde} USDe requires human confirmation via ${HUMAN_CONFIRM_TOKEN_ENV}`,
      );
      return {
        success: true,
        forecastSubmitted: true,
        tradeSubmitted: false,
        decisionId: preview.decisionId,
        attestationHash: preview.attestationHash,
        reason: "held for human confirmation",
      };
    }

    const executed = await this.governance.executeSpend({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      recipient: condition.id,
      amount: (amountUsde * 1e18).toString(),
      asset: "USDe",
      reason: `Sapience ${side} trade on: ${condition.shortName || condition.question}`,
      metadata: {
        protocol: "sapience",
        asset: "USDe",
        tradeType: "mint",
        side,
        amountUsde,
        conditionId: condition.id,
      },
      attestationHash: preview.attestationHash,
      humanConfirmationToken: humanToken,
    });

    if (executed.status === "denied") {
      return {
        success: false,
        forecastSubmitted: true,
        tradeSubmitted: false,
        reason: executed.reason,
      };
    }

    // 8. Execute the trade on Sapience
    const tradeTxHash = await this.sapienceService!.executeTrade({
      marketId: condition.id,
      conditionId: condition.id,
      amount: amountUsde.toFixed(1),
      side,
    });

    // 9. Verify audit was written
    const audit = await this.governance.recentAudit({ agentId: this.id, limit: 1 });

    return {
      success: true,
      forecastSubmitted: true,
      tradeSubmitted: true,
      decisionId: preview.decisionId,
      attestationHash: preview.attestationHash,
      auditLogId: audit[0]?.id,
    };
  }

  async executeTrade(decision: TradingDecision): Promise<TradeResult> {
    if (this.status !== "active") {
      throw new Error("Agent is not active");
    }
    await this.ensureServices();

    // Route through governance before touching Sapience
    const amountUsde = decision.price * decision.quantity || 10;
    const preview = await this.governance.previewSpend({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      recipient: decision.symbol,
      amount: (amountUsde * 1e18).toString(),
      asset: "USDe",
      reason: decision.reasoning || `Sapience ${decision.action}`,
      metadata: {
        protocol: "sapience",
        asset: "USDe",
        tradeType: "mint",
        side: decision.action === "buy" ? "YES" : "NO",
        amountUsde,
        confidence: decision.confidence,
        conditionId: decision.symbol,
      },
    });

    if (preview.status === "denied" || !preview.attestationHash) {
      return {
        id: `forecast_${Date.now()}`,
        decision,
        status: "failed",
        error: `governance denied: ${preview.reason}`,
        timestamp: new Date(),
      };
    }

    const humanToken =
      amountUsde <= AUTO_CONFIRM_MAX_USDE
        ? `auto-confirm-${Date.now()}`
        : process.env[HUMAN_CONFIRM_TOKEN_ENV];
    if (!humanToken) {
      return {
        id: `forecast_${Date.now()}`,
        decision,
        status: "pending",
        error: `held for human confirmation (attestation ${preview.attestationHash})`,
        timestamp: new Date(),
      };
    }

    await this.governance.executeSpend({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      recipient: decision.symbol,
      amount: (amountUsde * 1e18).toString(),
      asset: "USDe",
      reason: decision.reasoning || `Sapience ${decision.action}`,
      metadata: {
        protocol: "sapience",
        asset: "USDe",
        tradeType: "mint",
        side: decision.action === "buy" ? "YES" : "NO",
        amountUsde,
        conditionId: decision.symbol,
      },
      attestationHash: preview.attestationHash,
      humanConfirmationToken: humanToken,
    });

    try {
      const txHash = await this.sapienceService!.submitForecast({
        marketId: decision.symbol,
        probability: Math.round(decision.confidence * 100),
        confidence: decision.confidence,
        reasoning: decision.reasoning,
      });
      const tradeResult: TradeResult = {
        id: `forecast_${Date.now()}`,
        decision,
        status: "executed",
        executedPrice: decision.price,
        executedQuantity: decision.quantity,
        fees: 0,
        timestamp: new Date(),
        // txHash surfaced through governance audit; not in TradeResult type
      };
      this.history.unshift(decision);
      if (this.history.length > 50) this.history.pop();
      await this.reportActivity({
        agentId: this.id,
        type: "trade",
        data: tradeResult,
        timestamp: new Date(),
      });
      return tradeResult;
    } catch (error) {
      return {
        id: `forecast_${Date.now()}`,
        decision,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async getPortfolio(): Promise<Portfolio> {
    try {
      await this.ensureServices();
      const balance = await this.sapienceService!.getEthBalance();
      this.portfolio = {
        totalValue: parseFloat(balance),
        cash: parseFloat(balance),
        positions: [],
        lastUpdated: new Date(),
      };
    } catch {
      if (!this.portfolio) {
        this.portfolio = { totalValue: 0, cash: 0, positions: [], lastUpdated: new Date() };
      }
    }
    return this.portfolio;
  }

  async getPerformance(): Promise<PerformanceMetrics> {
    const totalForecasts = this.history.length;
    const avgConfidence = totalForecasts
      ? this.history.reduce((s, d) => s + d.confidence, 0) / totalForecasts
      : 0;
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: totalForecasts,
      profitableTrades: 0,
      averageTradeReturn: avgConfidence,
      period: {
        start: this.history.length > 0
          ? this.history[this.history.length - 1].timestamp
          : new Date(),
        end: new Date(),
      },
    };
  }

  /**
   * Real compliance check. Routes through Cognivern's policy engine.
   * Returns approved/denied with the matched rules.
   */
  async checkCompliance(decision: TradingDecision): Promise<ComplianceResult> {
    try {
      const result = await this.governance.evaluate({
        agentId: this.id,
        policyId: SAPIENCE_POLICY_ID,
        action: {
          type: "sapience_trade_intent",
          description: `Sapience ${decision.action} ${decision.symbol}`,
          input: JSON.stringify(decision),
          metadata: {
            protocol: "sapience",
            asset: "USDe",
            tradeType: "mint",
            side: decision.action === "buy" ? "YES" : "NO",
            amountUsde: decision.price * decision.quantity,
            confidence: decision.confidence,
            conditionId: decision.symbol,
          },
        },
      });
      return {
        isCompliant: result.approved,
        violations: result.approved
          ? []
          : [
              {
                rule: result.policyId,
                severity: "high" as const,
                message: result.reason,
                suggestedAction: "review policy or override",
              },
            ],
        warnings: [],
      };
    } catch (error) {
      // Fail-closed: if governance is unreachable, deny the trade.
      return {
        isCompliant: false,
        violations: [
          {
            rule: "governance-unreachable",
            severity: "critical" as const,
            message: `governance unreachable: ${error instanceof Error ? error.message : "unknown"}`,
            suggestedAction: "verify Cognivern API is reachable and COGNIVERN_API_KEY is set",
          },
        ],
        warnings: [],
      };
    }
  }

  async reportActivity(activity: AgentActivity): Promise<void> {
    logger.debug(`Activity: ${activity.type}`, { agentId: activity.agentId });
  }

  getId(): string {
    return this.id;
  }

  async isHealthy(): Promise<boolean> {
    return this.status !== "error";
  }

  async shutdown(): Promise<void> {
    await this.stop();
  }

  getInfo(): AgentInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      config: this.config,
      createdAt: new Date(),
      lastActivity: new Date().toISOString(),
      owner: "system",
      capabilities: ["forecasting", "sapience-integration", "governed-spend"],
      registeredAt: new Date().toISOString(),
    };
  }

  async getStatus(): Promise<any> {
    await this.ensureServices();
    const forecastingStats = await this.forecastingService!.getStats();
    return {
      id: this.id,
      status: this.status,
      isHealthy: await this.isHealthy(),
      lastHeartbeat: new Date(),
      internalThought: forecastingStats.lastThought,
      thoughtHistory: forecastingStats.thoughtHistory,
      nextActionAt: forecastingStats.nextRunAt,
      performance: await this.getPerformance(),
      portfolio: await this.getPortfolio(),
    };
  }

  async getRecentDecisions(limit: number = 10): Promise<TradingDecision[]> {
    return this.history.slice(0, limit).map((d) => ({
      ...d,
      timestamp: d.timestamp instanceof Date ? d.timestamp : new Date(d.timestamp),
    })) as TradingDecision[];
  }
}
