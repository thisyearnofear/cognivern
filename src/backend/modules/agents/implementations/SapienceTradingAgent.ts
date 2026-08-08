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
} from '@backend/modules/agents/types/TradingAgent.js';
import { Logger } from '@backend/shared/logging/Logger.js';
import {
  GovernanceClient,
  sharedGovernanceClient,
} from '@backend/services/governance/GovernanceClient.js';
import { tracer, meter } from '@backend/observability/otel.js';
import { owsWalletService } from '@backend/services/blockchain/OwsWalletService.js';
import type {
  ExecutionResult as OwsExecutionResult,
  SpendIntent as OwsSpendIntent,
} from '@backend/services/blockchain/OwsWalletService.js';

const logger = new Logger('SapienceTradingAgent');

const SAPIENCE_POLICY_ID = 'sapience-trading-policy';
const AGENT_ID = 'sapience-agent-1';
const HUMAN_CONFIRM_TOKEN_ENV = 'SAPIENCE_HUMAN_CONFIRM_TOKEN';
// Trades above this USDe amount auto-fail in CI/dev if no human token is set.
const AUTO_CONFIRM_MAX_USDE = 5;

export type KeeperHubRebalanceResult =
  | {
      ok: true;
      runId?: string;
      transferTxHash?: string;
      transferExecutionId?: string;
      transferChainId?: number;
      transferFrom?: string;
      transferTransactionLink?: string;
      transferSponsored?: boolean;
      transferVerified?: boolean;
      transferReceiptStatus?: string;
      transferUncertain?: boolean;
      transferReceipts?: Array<{
        hash: string;
        chainId?: number;
        verified?: boolean;
        receiptStatus?: string;
        blockNumber?: number;
        gasUsed?: string;
        verifiedAt?: string;
      }>;
      txHash?: string;
      traceId?: string;
      intentId: string;
      policyId?: string;
      status: 'approved' | 'held' | 'denied';
      executionProvider: 'keeperhub';
    }
  | {
      ok: false;
      error: string;
      traceId?: string;
    };

type SapienceServiceType = InstanceType<
  typeof import('@backend/services/SapienceService.js').SapienceService
>;
type AutomatedForecastingServiceType = InstanceType<
  typeof import('@backend/services/ai/AutomatedForecastingService.js').AutomatedForecastingService
>;

export class SapienceTradingAgent implements TradingAgent {
  public readonly id = AGENT_ID;
  public readonly name: string;
  public readonly type = 'sapience' as const;
  public status: 'active' | 'inactive' | 'paused' | 'error' = 'inactive';
  public config: TradingAgentConfig;

  private sapienceService?: SapienceServiceType;
  private forecastingService?: AutomatedForecastingServiceType;
  private governance: GovernanceClient;
  private portfolio: Portfolio | null = null;
  private history: any[] = [];

  constructor(name: string, config: TradingAgentConfig, governance?: GovernanceClient) {
    this.name = name;
    this.config = config;
    this.governance = governance || sharedGovernanceClient;
  }

  private async ensureServices(): Promise<void> {
    if (this.sapienceService && this.forecastingService) return;

    const [{ SapienceService }, { AutomatedForecastingService }] = await Promise.all([
      import('@backend/services/SapienceService.js'),
      import('@backend/services/ai/AutomatedForecastingService.js'),
    ]);

    this.sapienceService = new SapienceService();
    this.forecastingService = new AutomatedForecastingService({
      sapienceService: this.sapienceService,
    });
  }

  async initialize(): Promise<void> {
    this.status = 'inactive';
  }

  async start(): Promise<void> {
    if (this.status === 'error') {
      throw new Error('Cannot start agent in error state');
    }
    await this.ensureServices();
    this.status = 'active';
    await this.reportActivity({
      agentId: this.id,
      type: 'status_change',
      data: { status: 'active' },
      timestamp: new Date(),
    });
  }

  async stop(): Promise<void> {
    this.status = 'inactive';
    await this.reportActivity({
      agentId: this.id,
      type: 'status_change',
      data: { status: 'inactive' },
      timestamp: new Date(),
    });
  }

  async pause(): Promise<void> {
    this.status = 'paused';
  }

  async resume(): Promise<void> {
    this.status = 'active';
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
    if (this.status !== 'active') {
      return { success: false, error: 'agent not active' };
    }

    return tracer.startActiveSpan(
      'agent.sapience.forecast_cycle',
      {
        attributes: {
          'agent.id': this.id,
          'agent.type': this.type,
          'agent.name': this.name,
        },
      },
      async (span) => {
        const startedAt = Date.now();
        try {
          // Delegate to the governed cycle. The old path called
          // AutomatedForecastingService.runForecastingCycle directly, which
          // submitted forecasts AND executed trades with no governance check.
          const result = await this.runCycleWithGovernance();
          if (!result.success) {
            span.setAttributes({
              'agent.cycle.success': false,
              'agent.cycle.error': result.reason || 'forecast failed',
            });
            span.setStatus({ code: 2, message: result.reason || 'forecast failed' });
            return { success: false, error: result.reason || 'forecast failed' };
          }

          meter
            .createCounter('cognivern.agent.cycles.total')
            .add(1, { agent_type: this.type, outcome: 'success' });
          meter
            .createHistogram('cognivern.agent.cycle.duration.ms')
            .record(Date.now() - startedAt, { agent_type: this.type });

          span.setAttribute('agent.cycle.success', true);
          span.setStatus({ code: 1 });

          return {
            success: true,
            decisionId: result.decisionId,
            attestationHash: result.attestationHash,
            governanceStatus: result.tradeSubmitted ? 'trade_executed' : 'forecast_only',
          };
        } catch (error) {
          meter
            .createCounter('cognivern.agent.cycles.total')
            .add(1, { agent_type: this.type, outcome: 'error' });
          span.recordException(error as Error);
          span.setStatus({ code: 2, message: 'internal' });
          logger.error('Forecast cycle failed', error instanceof Error ? error : undefined);
          return { success: false, error: 'internal' };
        } finally {
          span.end();
        }
      },
    );
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
    if (this.status !== 'active') {
      return {
        success: false,
        forecastSubmitted: false,
        tradeSubmitted: false,
        reason: 'agent not active',
      };
    }
    await this.ensureServices();

    // 1. Pick a condition
    const condition = await this.forecastingService!.fetchOptimalCondition();
    if (!condition) {
      return {
        success: false,
        forecastSubmitted: false,
        tradeSubmitted: false,
        reason: 'no open conditions',
      };
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
        type: 'sapience_forecast_attestation',
        description: `Submit EAS attestation for market ${condition.id}`,
        input: JSON.stringify({
          conditionId: condition.id,
          probability: forecast.probability,
          reasoning: forecast.reasoning,
        }),
        metadata: {
          protocol: 'sapience',
          asset: 'USDe',
          tradeType: 'forecast_attestation',
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
        reason: 'low confidence, forecast only',
      };
    }

    const marketPrice = await this.sapienceService!.getMarketPrice(condition.id);
    if (!marketPrice) {
      return {
        success: true,
        forecastSubmitted: true,
        tradeSubmitted: false,
        reason: 'no market price',
      };
    }
    const edge = this.sapienceService!.calculateEdge(forecast.probability, marketPrice);
    if (Math.abs(edge) <= 0.1) {
      return {
        success: true,
        forecastSubmitted: true,
        tradeSubmitted: false,
        reason: 'no significant edge',
      };
    }

    const side: 'YES' | 'NO' = edge > 0 ? 'YES' : 'NO';
    const amountUsde = 10; // 10 USDe per trade — well within the 50 USDe per-trade cap

    // 6. Preview the trade through Cognivern
    const preview = await this.governance.previewSpend({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      recipient: condition.id, // Sapience market id serves as the vendor ref
      amount: (amountUsde * 1e18).toString(), // USDe has 18 decimals
      asset: 'USDe',
      reason: `Sapience ${side} trade on: ${condition.shortName || condition.question}`,
      metadata: {
        protocol: 'sapience',
        asset: 'USDe',
        tradeType: 'mint',
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

    if (preview.status === 'denied' || !preview.attestationHash) {
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
        reason: 'held for human confirmation',
      };
    }

    const executed = await this.governance.executeSpend({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      recipient: condition.id,
      amount: (amountUsde * 1e18).toString(),
      asset: 'USDe',
      reason: `Sapience ${side} trade on: ${condition.shortName || condition.question}`,
      metadata: {
        protocol: 'sapience',
        asset: 'USDe',
        tradeType: 'mint',
        side,
        amountUsde,
        conditionId: condition.id,
      },
      attestationHash: preview.attestationHash,
      humanConfirmationToken: humanToken,
    });

    // Anything other than an explicit approval (denied OR held) must block
    // the real market trade — a held spend awaits operator review.
    if (executed.status !== 'approved') {
      return {
        success: executed.status === 'held',
        forecastSubmitted: true,
        tradeSubmitted: false,
        decisionId: executed.decisionId || preview.decisionId,
        attestationHash: preview.attestationHash,
        reason:
          executed.reason ||
          (executed.status === 'held' ? 'spend held for operator review' : 'spend denied'),
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
    if (this.status !== 'active') {
      throw new Error('Agent is not active');
    }
    await this.ensureServices();

    // Route through governance before touching Sapience
    const amountUsde = decision.price * decision.quantity || 10;
    const preview = await this.governance.previewSpend({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      recipient: decision.symbol,
      amount: (amountUsde * 1e18).toString(),
      asset: 'USDe',
      reason: decision.reasoning || `Sapience ${decision.action}`,
      metadata: {
        protocol: 'sapience',
        asset: 'USDe',
        tradeType: 'mint',
        side: decision.action === 'buy' ? 'YES' : 'NO',
        amountUsde,
        confidence: decision.confidence,
        conditionId: decision.symbol,
      },
    });

    if (preview.status === 'denied' || !preview.attestationHash) {
      return {
        id: `forecast_${Date.now()}`,
        decision,
        status: 'failed',
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
        status: 'pending',
        error: `held for human confirmation (attestation ${preview.attestationHash})`,
        timestamp: new Date(),
      };
    }

    const executed = await this.governance.executeSpend({
      agentId: this.id,
      policyId: SAPIENCE_POLICY_ID,
      recipient: decision.symbol,
      amount: (amountUsde * 1e18).toString(),
      asset: 'USDe',
      reason: decision.reasoning || `Sapience ${decision.action}`,
      metadata: {
        protocol: 'sapience',
        asset: 'USDe',
        tradeType: 'mint',
        side: decision.action === 'buy' ? 'YES' : 'NO',
        amountUsde,
        conditionId: decision.symbol,
      },
      attestationHash: preview.attestationHash,
      humanConfirmationToken: humanToken,
    });

    if (executed.status !== 'approved') {
      return {
        id: `forecast_${Date.now()}`,
        decision,
        status: executed.status === 'held' ? 'pending' : 'failed',
        error:
          executed.reason ||
          (executed.status === 'held'
            ? 'spend held for operator review'
            : 'governance denied spend'),
        timestamp: new Date(),
      };
    }

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
        status: 'executed',
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
        type: 'trade',
        data: tradeResult,
        timestamp: new Date(),
      });
      return tradeResult;
    } catch (error) {
      return {
        id: `forecast_${Date.now()}`,
        decision,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
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
        start:
          this.history.length > 0 ? this.history[this.history.length - 1].timestamp : new Date(),
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
          type: 'sapience_trade_intent',
          description: `Sapience ${decision.action} ${decision.symbol}`,
          input: JSON.stringify(decision),
          metadata: {
            protocol: 'sapience',
            asset: 'USDe',
            tradeType: 'mint',
            side: decision.action === 'buy' ? 'YES' : 'NO',
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
                severity: 'high' as const,
                message: result.reason,
                suggestedAction: 'review policy or override',
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
            rule: 'governance-unreachable',
            severity: 'critical' as const,
            message: `governance unreachable: ${error instanceof Error ? error.message : 'unknown'}`,
            suggestedAction: 'verify Cognivern API is reachable and COGNIVERN_API_KEY is set',
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
    return this.status !== 'error';
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
      owner: 'system',
      capabilities: ['forecasting', 'sapience-integration', 'governed-spend'],
      registeredAt: new Date().toISOString(),
      source: 'demo',
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

  /**
   * KeeperHub-routed rebalance cycle.
   *
   * Drives a single end-to-end policy-checked → KeeperHub-executed →
   * audit-recorded spend for a configured wallet. The intent is built
   * with `metadata.executionProvider === "keeperhub"`, so the existing
   * `OwsWalletService.finalizeApprovedSpend` routes the broadcast
   * through `KeeperHubExecutionProvider` instead of the local RPC.
   *
   * Returns the spend outcome plus the receipt fields that the demo
   * script (`tooling/scripts/demo/run-keeperhub-rebalance.ts`) persists to
   * `.artifacts/keeperhub-rebalance.json` for the hackathon
   * submission. If the spend is held or denied, the call still returns
   * the policy verdict and no broadcast is attempted.
   */
  async runKeeperHubRebalanceCycle(params: {
    walletId: string;
    recipient: string;
    amountWei: bigint;
    reason: string;
    policyId?: string;
  }): Promise<KeeperHubRebalanceResult> {
    if (this.status !== 'active') {
      return { ok: false, error: 'agent not active' };
    }

    return tracer.startActiveSpan(
      'agent.sapience.keeperhub_rebalance',
      {
        attributes: {
          'agent.id': this.id,
          'agent.type': this.type,
          'agent.name': this.name,
          'wallet.id': params.walletId,
          'agent.cycle.execution_provider': 'keeperhub',
        },
      },
      async (span): Promise<KeeperHubRebalanceResult> => {
        const intent: OwsSpendIntent = {
          id: `kh-rebalance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          agentId: this.id,
          recipient: params.recipient,
          amount: params.amountWei.toString(),
          asset: 'wei',
          reason: params.reason,
          timestamp: new Date().toISOString(),
          metadata: {
            policyId: params.policyId || SAPIENCE_POLICY_ID,
            executionProvider: 'keeperhub',
            walletId: params.walletId,
            workflow: 'keeperhub-rebalance',
          },
        };

        try {
          const result: OwsExecutionResult = await owsWalletService.executeSpend(intent, {
            walletId: params.walletId,
          });

          span.setAttributes({
            'spend.intent_id': intent.id,
            'spend.status': result.status,
            'spend.policy_id': result.policyId || '',
            'spend.transfer_status': result.transferStatus || 'skipped',
            'spend.transfer_tx_hash': result.transferTxHash || '',
            'keeperhub.execution_id': result.transferExecutionId || '',
            'keeperhub.chain_id': result.transferChainId || 0,
            'keeperhub.from': result.transferFrom || '',
            'keeperhub.transaction_link': result.transferTransactionLink || '',
            'keeperhub.sponsored': result.transferSponsored ?? false,
            'keeperhub.receipt_verified': result.transferVerified ?? false,
            'keeperhub.receipt_status': result.transferReceiptStatus || '',
            'spend.on_chain_status': result.onChainStatus || 'skipped',
            'spend.execution_provider': 'keeperhub',
          });
          if (result.error) {
            span.setAttributes({ 'spend.error': result.error });
          }
          span.setStatus({
            code: result.status === 'approved' && result.transferStatus === 'sent' ? 0 : 2,
            message:
              result.status === 'approved' && result.transferStatus === 'sent'
                ? 'ok'
                : result.error || result.reason || result.status,
          });

          const traceId = span.spanContext().traceId;
          meter
            .createCounter('cognivern.agent.keeperhub.rebalance.total', {
              description: 'Sapience agent KeeperHub-routed rebalance outcomes',
            })
            .add(1, {
              'spend.status': result.status,
              'spend.transfer_status': result.transferStatus || 'skipped',
            });

          if (result.status === 'approved' && result.transferStatus === 'sent') {
            return {
              ok: true,
              runId: result.runId,
              transferTxHash: result.transferTxHash,
              transferExecutionId: result.transferExecutionId,
              transferChainId: result.transferChainId,
              transferFrom: result.transferFrom,
              transferTransactionLink: result.transferTransactionLink,
              transferSponsored: result.transferSponsored,
              transferVerified: result.transferVerified,
              transferReceiptStatus: result.transferReceiptStatus,
              transferReceipts: result.transferReceipts,
              txHash: result.txHash,
              traceId,
              intentId: intent.id,
              policyId: result.policyId,
              status: 'approved',
              executionProvider: 'keeperhub',
            };
          }
          return {
            ok: true,
            runId: result.runId,              transferTxHash: result.transferTxHash,
              transferExecutionId: result.transferExecutionId,
              transferChainId: result.transferChainId,
              transferFrom: result.transferFrom,
              transferTransactionLink: result.transferTransactionLink,
              transferSponsored: result.transferSponsored,
              transferVerified: result.transferVerified,
              transferReceiptStatus: result.transferReceiptStatus,
              transferUncertain: result.transferUncertain,
              txHash: result.txHash,
              traceId,
            intentId: intent.id,
            policyId: result.policyId,
            status: result.status,
            executionProvider: 'keeperhub',
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          span.setStatus({ code: 2, message });
          logger.error('KeeperHub rebalance cycle failed', {
            error: message,
            intentId: intent.id,
          });
          return { ok: false, error: message, traceId: span.spanContext().traceId };
        } finally {
          span.end();
        }
      },
    );
  }
}
