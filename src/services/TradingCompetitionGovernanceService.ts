import { TradingAgent, TradingDecision } from "../agents/TradingAgent.js";
import { RealTradingAgent } from "../agents/RealTradingAgent.js";
import {
  RecallCompetitionService,
  Competition,
  TradingMetrics,
} from "./RecallCompetitionService.js";
import { RecallTradingService } from "./RecallTradingService.js";
import { FilecoinGovernanceService } from "./FilecoinGovernanceService.js";
import { PolicyService } from "./PolicyService.js";
import { AuditLogService } from "./AuditLogService.js";
import { MetricsService } from "./MetricsService.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";
import logger from "../utils/logger.js";

export interface CompetitionAgent {
  agent: TradingAgent;
  competitionId: string;
  rank: number;
  score: number;
  metrics: TradingMetrics;
  complianceScore: number;
  violations: number;
  status: "active" | "suspended" | "disqualified";
}

export interface GovernanceEvent {
  id: string;
  type:
    | "policy_violation"
    | "risk_breach"
    | "performance_alert"
    | "compliance_check";
  agentId: string;
  competitionId: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: string;
  resolved: boolean;
  action_taken?: string;
}

export interface CompetitionGovernanceConfig {
  maxAgents: number;
  tradingPolicyId: string;
  riskLimits: {
    maxDailyLoss: number;
    maxPositionSize: number;
    maxRiskScore: number;
  };
  complianceThresholds: {
    minComplianceScore: number;
    maxViolations: number;
  };
  monitoringInterval: number; // milliseconds
}

export class TradingCompetitionGovernanceService {
  private recallClient: RecallClient;
  private bucketAddress: Address;
  private recallCompetitionService: RecallCompetitionService;
  private recallTradingService: RecallTradingService;
  private filecoinGovernanceService: FilecoinGovernanceService;
  private policyService: PolicyService;
  private auditLogService: AuditLogService;
  private metricsService: MetricsService;

  public activeCompetitions: Map<string, CompetitionAgent[]> = new Map();
  private governanceEvents: GovernanceEvent[] = [];
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(recallClient: RecallClient, bucketAddress: Address) {
    this.recallClient = recallClient;
    this.bucketAddress = bucketAddress;

    this.recallCompetitionService = new RecallCompetitionService();
    this.recallTradingService = new RecallTradingService();
    this.filecoinGovernanceService = new FilecoinGovernanceService();
    this.policyService = new PolicyService(recallClient, bucketAddress);
    this.auditLogService = new AuditLogService(recallClient, bucketAddress);
    this.metricsService = new MetricsService(recallClient, bucketAddress);

    logger.info(
      "Trading Competition Governance Service initialized with Filecoin integration"
    );
  }

  /**
   * Start a governed trading competition
   */
  async startGovernedCompetition(
    competitionId: string,
    config: CompetitionGovernanceConfig
  ): Promise<void> {
    try {
      logger.info(`Starting governed trading competition: ${competitionId}`);

      // Initialize competition tracking
      this.activeCompetitions.set(competitionId, []);

      // Start governance monitoring
      await this.startGovernanceMonitoring(competitionId, config);

      // Log competition start
      await this.logGovernanceEvent({
        id: `comp-start-${Date.now()}`,
        type: "compliance_check",
        agentId: "system",
        competitionId,
        severity: "low",
        message: `Governed trading competition started with policy ${config.tradingPolicyId}`,
        timestamp: new Date().toISOString(),
        resolved: true,
      });

      logger.info(`Governed competition ${competitionId} started successfully`);
    } catch (error) {
      logger.error(`Failed to start governed competition: ${error}`);
      throw error;
    }
  }

  /**
   * Register a trading agent for a governed competition
   */
  async registerAgent(
    competitionId: string,
    agentId: string,
    config: CompetitionGovernanceConfig
  ): Promise<CompetitionAgent> {
    try {
      // Create trading agent
      const tradingAgent = new TradingAgent(
        agentId,
        this.recallClient,
        this.bucketAddress
      );

      // Start agent with trading policy
      await tradingAgent.start(config.tradingPolicyId);

      // Create competition agent record
      const competitionAgent: CompetitionAgent = {
        agent: tradingAgent,
        competitionId,
        rank: 0,
        score: 0,
        metrics: tradingAgent.getTradingMetrics(),
        complianceScore: 100,
        violations: 0,
        status: "active",
      };

      // Add to competition
      const agents = this.activeCompetitions.get(competitionId) || [];
      agents.push(competitionAgent);
      this.activeCompetitions.set(competitionId, agents);

      // Log agent registration
      await this.logGovernanceEvent({
        id: `agent-reg-${Date.now()}`,
        type: "compliance_check",
        agentId,
        competitionId,
        severity: "low",
        message: `Trading agent registered for governed competition`,
        timestamp: new Date().toISOString(),
        resolved: true,
      });

      logger.info(
        `Agent ${agentId} registered for competition ${competitionId}`
      );
      return competitionAgent;
    } catch (error) {
      logger.error(`Failed to register agent: ${error}`);
      throw error;
    }
  }

  /**
   * Execute a trading round with governance oversight
   */
  async executeTradingRound(
    competitionId: string,
    marketData: any
  ): Promise<{
    decisions: TradingDecision[];
    violations: GovernanceEvent[];
    rankings: CompetitionAgent[];
  }> {
    const agents = this.activeCompetitions.get(competitionId) || [];
    const decisions: TradingDecision[] = [];
    const violations: GovernanceEvent[] = [];

    logger.info(
      `Executing trading round for competition ${competitionId} with ${agents.length} agents`
    );

    for (const competitionAgent of agents) {
      if (competitionAgent.status !== "active") {
        continue;
      }

      try {
        // Generate portfolio data (simplified)
        const portfolioData = {
          position: Math.floor(Math.random() * 1000),
          cash: 10000 + Math.random() * 50000,
        };

        // Make trading decision
        const decision = await competitionAgent.agent.makeTradingDecision(
          "AAPL", // Example symbol
          marketData,
          portfolioData
        );

        if (decision) {
          decisions.push(decision);

          // Check for governance violations
          const violation = await this.checkForViolations(
            competitionAgent,
            decision
          );
          if (violation) {
            violations.push(violation);
            await this.handleViolation(competitionAgent, violation);
          }

          // Update agent metrics and compliance score
          await this.updateAgentCompliance(competitionAgent);
        }
      } catch (error) {
        logger.error(
          `Error executing trade for agent ${competitionAgent.agent.getConfig().name}: ${error}`
        );

        // Log error as governance event
        await this.logGovernanceEvent({
          id: `error-${Date.now()}`,
          type: "performance_alert",
          agentId: competitionAgent.agent.getConfig().name,
          competitionId,
          severity: "medium",
          message: `Trading error: ${error}`,
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      }
    }

    // Update rankings
    const rankings = await this.updateRankings(competitionId);

    return { decisions, violations, rankings };
  }

  /**
   * Check for governance violations
   */
  private async checkForViolations(
    competitionAgent: CompetitionAgent,
    decision: TradingDecision
  ): Promise<GovernanceEvent | null> {
    // Check risk score violation
    if (decision.riskScore > 80) {
      return {
        id: `risk-violation-${Date.now()}`,
        type: "risk_breach",
        agentId: competitionAgent.agent.getConfig().name,
        competitionId: competitionAgent.competitionId,
        severity: "high",
        message: `High risk trade detected: Risk score ${decision.riskScore}`,
        timestamp: new Date().toISOString(),
        resolved: false,
      };
    }

    // Check position size violation
    const positionValue = decision.quantity * decision.price;
    if (positionValue > 50000) {
      return {
        id: `position-violation-${Date.now()}`,
        type: "policy_violation",
        agentId: competitionAgent.agent.getConfig().name,
        competitionId: competitionAgent.competitionId,
        severity: "medium",
        message: `Large position size: $${positionValue.toFixed(2)}`,
        timestamp: new Date().toISOString(),
        resolved: false,
      };
    }

    return null;
  }

  /**
   * Handle governance violations
   */
  private async handleViolation(
    competitionAgent: CompetitionAgent,
    violation: GovernanceEvent
  ): Promise<void> {
    competitionAgent.violations += 1;
    competitionAgent.complianceScore = Math.max(
      0,
      competitionAgent.complianceScore - 10
    );

    // Suspend agent if too many violations
    if (competitionAgent.violations >= 3) {
      competitionAgent.status = "suspended";
      violation.action_taken = "Agent suspended due to repeated violations";

      logger.warn(`Agent ${violation.agentId} suspended due to violations`);
    } else if (violation.severity === "critical") {
      competitionAgent.status = "disqualified";
      violation.action_taken = "Agent disqualified due to critical violation";

      logger.warn(
        `Agent ${violation.agentId} disqualified due to critical violation`
      );
    }

    await this.logGovernanceEvent(violation);
  }

  /**
   * Update agent compliance score
   */
  private async updateAgentCompliance(
    competitionAgent: CompetitionAgent
  ): Promise<void> {
    // Update metrics
    competitionAgent.metrics = competitionAgent.agent.getTradingMetrics();

    // Improve compliance score for good behavior
    if (competitionAgent.complianceScore < 100) {
      competitionAgent.complianceScore = Math.min(
        100,
        competitionAgent.complianceScore + 1
      );
    }
  }

  /**
   * Update competition rankings
   */
  private async updateRankings(
    competitionId: string
  ): Promise<CompetitionAgent[]> {
    const agents = this.activeCompetitions.get(competitionId) || [];

    // Sort by performance score (combination of returns and compliance)
    agents.sort((a, b) => {
      const scoreA = a.metrics.totalReturn * (a.complianceScore / 100);
      const scoreB = b.metrics.totalReturn * (b.complianceScore / 100);
      return scoreB - scoreA;
    });

    // Update ranks
    agents.forEach((agent, index) => {
      agent.rank = index + 1;
      agent.score = agent.metrics.totalReturn * (agent.complianceScore / 100);
    });

    this.activeCompetitions.set(competitionId, agents);
    return agents;
  }

  /**
   * Start governance monitoring for a competition
   */
  private async startGovernanceMonitoring(
    competitionId: string,
    config: CompetitionGovernanceConfig
  ): Promise<void> {
    const interval = setInterval(async () => {
      try {
        await this.performGovernanceCheck(competitionId, config);
      } catch (error) {
        logger.error(
          `Governance monitoring error for ${competitionId}: ${error}`
        );
      }
    }, config.monitoringInterval);

    this.monitoringIntervals.set(competitionId, interval);
  }

  /**
   * Perform periodic governance checks
   */
  private async performGovernanceCheck(
    competitionId: string,
    config: CompetitionGovernanceConfig
  ): Promise<void> {
    const agents = this.activeCompetitions.get(competitionId) || [];

    for (const agent of agents) {
      // Check compliance thresholds
      if (
        agent.complianceScore < config.complianceThresholds.minComplianceScore
      ) {
        await this.logGovernanceEvent({
          id: `compliance-alert-${Date.now()}`,
          type: "compliance_check",
          agentId: agent.agent.getConfig().name,
          competitionId,
          severity: "medium",
          message: `Low compliance score: ${agent.complianceScore}`,
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      }

      // Check violation limits
      if (agent.violations >= config.complianceThresholds.maxViolations) {
        agent.status = "suspended";

        await this.logGovernanceEvent({
          id: `max-violations-${Date.now()}`,
          type: "policy_violation",
          agentId: agent.agent.getConfig().name,
          competitionId,
          severity: "high",
          message: `Maximum violations exceeded: ${agent.violations}`,
          timestamp: new Date().toISOString(),
          resolved: true,
          action_taken: "Agent suspended",
        });
      }
    }
  }

  /**
   * Log governance event
   */
  private async logGovernanceEvent(event: GovernanceEvent): Promise<void> {
    this.governanceEvents.push(event);

    // Store in audit log
    try {
      await this.auditLogService.logAction(
        {
          id: event.id,
          type: event.type,
          timestamp: event.timestamp,
          description: event.message,
          policyChecks: [],
          metadata: {
            agentId: event.agentId,
            competitionId: event.competitionId,
            severity: event.severity,
            resolved: event.resolved,
            action_taken: event.action_taken,
          },
        },
        [],
        true
      );
    } catch (error) {
      logger.error("Failed to log governance event:", error);
    }
  }

  /**
   * Get competition status
   */
  getCompetitionStatus(competitionId: string): {
    agents: CompetitionAgent[];
    events: GovernanceEvent[];
    summary: any;
  } {
    const agents = this.activeCompetitions.get(competitionId) || [];
    const events = this.governanceEvents.filter(
      (e) => e.competitionId === competitionId
    );

    const summary = {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.status === "active").length,
      suspendedAgents: agents.filter((a) => a.status === "suspended").length,
      totalViolations: events.filter((e) => e.type === "policy_violation")
        .length,
      avgComplianceScore:
        agents.reduce((sum, a) => sum + a.complianceScore, 0) / agents.length ||
        0,
    };

    return { agents, events, summary };
  }

  /**
   * Stop competition and cleanup
   */
  async stopCompetition(competitionId: string): Promise<void> {
    // Stop monitoring
    const interval = this.monitoringIntervals.get(competitionId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(competitionId);
    }

    // Stop all agents
    const agents = this.activeCompetitions.get(competitionId) || [];
    for (const competitionAgent of agents) {
      await competitionAgent.agent.stop();
    }

    // Clean up
    this.activeCompetitions.delete(competitionId);

    logger.info(`Competition ${competitionId} stopped and cleaned up`);
  }
}
