/**
 * Agents Controller - Connected to Showcase Agents
 */

import { Request, Response } from "express";
import { Logger } from "../../../shared/logging/Logger.js";
import { AgentsModule } from "../../agents/AgentsModule.js";
import { MarketDataService } from "../../../services/MarketDataService.js";

const logger = new Logger("AgentsController");
import { AgentMetricsAggregator } from "../../../shared/services/AgentMetricsAggregator.js";
import { TradingHistoryService } from "../../../services/TradingHistoryService.js";
import { MetricsService } from "../../../services/MetricsService.js";

import { AuditLogService } from "../../../services/AuditLogService.js";
import { PolicyService } from "../../../services/PolicyService.js";
import {
  getWorkerClient,
  type WorkerAgent,
  type WorkerMetrics,
} from "../../../services/CloudflareWorkerClient.js";
import { creRunStore } from "../../../cre/storage/CreRunStore.js";

export class AgentsController {
  private agentsModule: AgentsModule;
  private marketDataService: MarketDataService;
  private metricsAggregator: AgentMetricsAggregator;
  private tradingHistory: TradingHistoryService;
  private metricsService: MetricsService;
  private auditLogService: AuditLogService;
  private policyService: PolicyService;
  private workerClient = getWorkerClient();

  constructor(
    agentsModule?: AgentsModule,
    marketDataService?: MarketDataService,
    auditLogService?: AuditLogService,
    policyService?: PolicyService,
  ) {
    this.agentsModule = agentsModule || new AgentsModule();
    this.marketDataService = marketDataService || new MarketDataService();
    this.tradingHistory = new TradingHistoryService();
    this.metricsService = new MetricsService();
    this.metricsAggregator = new AgentMetricsAggregator(
      this.tradingHistory,
      this.metricsService,
      this.agentsModule,
    );
    this.auditLogService = auditLogService || new AuditLogService();
    this.policyService = policyService || new PolicyService();
  }

  async initialize(): Promise<void> {
    // Already initialized by ApiModule
  }

  async getAgents(req: Request, res: Response): Promise<void> {
    try {
      // Get our showcase agents for AI governance platform
      const agents = await this.agentsModule.getAgents();

      res.json({
        success: true,
        data: agents,
        count: agents.length,
        showcase: {
          description: "AI Agent Governance Platform - Showcase Agents",
          agents: [
            "Sapience Forecasting Agent - Automated prediction markets with EAS attestations",
            "Filecoin Governance Agent - Policy enforcement and audit storage",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async registerAgent(req: Request, res: Response): Promise<void> {
    try {
      const { type, name, address, description, riskLevel } = req.body;

      if (!type || !name || !address) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Type, name, and address are required",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const agent = await this.agentsModule.registerUserAgent({
        type,
        name,
        address,
        description,
        riskLevel,
      });

      // Log registration to audit trail
      try {
        await this.auditLogService.logEvent({
          eventType: "agent_registration",
          agentType: agent.type,
          timestamp: new Date(),
          details: {
            agentId: agent.id,
            name: agent.name,
            address,
            riskLevel,
          },
        });
      } catch (logError) {
        logger.error("Failed to log agent registration", logError instanceof Error ? logError : undefined);
      }

      res.json({
        success: true,
        data: agent,
        message: "Agent registered successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Agent registration failed", error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getConnections(req: Request, res: Response): Promise<void> {
    try {
      // Get agent connections for policy management
      const agents = await this.agentsModule.getAgents();

      const connections = agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status === "active" ? "connected" : "disconnected",
        lastSeen: agent.lastActivity,
        capabilities: agent.capabilities || [],
        policies: [], // Agent type doesn't have policies property
        metadata: {
          version: "1.0.0",
          governance: "enabled",
          monitoring: "active",
        },
      }));

      res.json({
        success: true,
        data: connections,
        count: connections.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Get specific showcase agent by ID
      const agent = await this.agentsModule.getAgent(id);

      if (!agent) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Showcase agent with id ${id} not found. Available agents: sapience-agent-1, filecoin-agent-1`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: agent,
        governance: {
          platform: "Cognivern AI Agent Governance",
          monitoring: "Real-time compliance and performance tracking",
          policies: "Automated governance rule enforcement",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getAgentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id, agentType } = req.params;
      const agentId = id || agentType; // Support both :id and :agentType parameters

      // Return mock data for demo agents (governance/portfolio/sapience)
      const demoAgentNames: Record<string, string> = {
        governance: "Spend Governance Agent",
        portfolio: "Portfolio Agent",
        sapience: "Oversight Agent",
      };
      if (agentType && agentType in demoAgentNames) {
        res.json({
          agent: {
            id: agentType,
            name: demoAgentNames[agentType],
            type: agentType,
            status: "active",
          },
          status: {
            isActive: true,
            lastUpdate: new Date().toISOString(),
            tradesExecuted: 5,
            performance: {
              totalReturn: 0,
              winRate: 0,
              sharpeRatio: 0,
            },
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get real agent status from our showcase agents
      const status = await this.agentsModule.getAgentStatus(agentId);

      if (!status) {
        res.status(500).json({
          success: false,
          error: `Failed to fetch ${agentType} agent data`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Transform status to match frontend expectations
      const transformedStatus = {
        isActive: status.status === "active",
        lastUpdate: status.lastActivity || new Date().toISOString(),
        tradesExecuted: status.performance?.totalTrades || 0,
        performance: {
          totalReturn: status.performance?.averageTradeReturn || 0,
          winRate: status.performance?.winRate || 0,
          sharpeRatio: status.performance?.sharpeRatio || 0,
        },
      };

      res.json({
        agent: {
          id: agentId,
          name: status.name || agentId,
          type: agentType || agentId,
          status: status.status || "active",
        },
        status: transformedStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const type = req.params.agentType || req.params.id || "unknown";
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${type} agent data`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async startAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // In real implementation, this would start the agent

      res.json({
        success: true,
        message: `Agent ${id} started successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async stopAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // In real implementation, this would stop the agent

      res.json({
        success: true,
        message: `Agent ${id} stopped successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getAgentDecisions(req: Request, res: Response): Promise<void> {
    try {
      const { agentType, id } = req.params;
      const agentId = id || agentType;
      const limit = parseInt(req.query.limit as string) || 10;

      // Return mock decisions for demo agents
      if (agentType === "governance" || agentType === "portfolio" || agentType === "sapience") {
        const mockDecisions = [
          {
            id: `${agentType}-decision-1`,
            type: agentType === "governance" ? "policy_check" : "portfolio_rebalance",
            action: agentType === "governance" ? "Evaluated spend request" : "Reviewed portfolio allocation",
            result: "approved",
            timestamp: new Date(Date.now() - 60000).toISOString(),
            details: agentType === "governance"
              ? { policy: "spend-limit", outcome: "within limits" }
              : { asset: "ETH", action: "hold" },
          },
          {
            id: `${agentType}-decision-2`,
            type: agentType === "governance" ? "audit_log" : "risk_assessment",
            action: agentType === "governance" ? "Logged governance event" : "Assessed risk exposure",
            result: "completed",
            timestamp: new Date(Date.now() - 120000).toISOString(),
            details: agentType === "governance"
              ? { event: "policy_enforcement", status: "active" }
              : { riskScore: 0.3, status: "low" },
          },
        ];
        res.json({
          success: true,
          data: mockDecisions,
          count: mockDecisions.length,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get real agent decisions from our agents module
      const decisions = await this.agentsModule.getAgentDecisions(
        agentId,
        limit,
      );

      res.json({
        success: true,
        data: decisions,
        count: decisions.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: "Failed to fetch trading decisions",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const agents = await this.agentsModule.getAgents();

      // Transform agents data for monitoring dashboard
      const monitoringDataPromises = agents.map(async (agentInfo) => {
        let agentStatus;
        try {
          agentStatus = await this.agentsModule.getAgentStatus(agentInfo.id);
        } catch (e) {
          // If agent status fetch fails, we return a fallback error state but stick to the structure
          agentStatus = { performance: {}, portfolio: {} };
        }

        const perf = agentStatus.performance || {};
        const portfolio = agentStatus.portfolio || {};

        return {
          id: agentInfo.id,
          name: agentInfo.name,
          type: agentInfo.type,
          status: agentInfo.status,
          lastActivity: agentInfo.lastActivity,
          internalThought:
            agentStatus.internalThought || "Monitoring markets...",
          thoughtHistory: agentStatus.thoughtHistory || [],
          nextActionAt: agentStatus.nextActionAt,
          metrics: {
            uptime: agentInfo.status === "active" ? "100%" : "0%",
            successRate: perf.winRate
              ? `${(perf.winRate * 100).toFixed(1)}%`
              : "0%",
            avgResponse: "N/A", // Not tracked in basic metrics yet
            actionsToday: perf.totalTrades || 0,
          },
          risk: {
            riskScore: 0, // Not calculated yet
            violationsToday: agentStatus.policyViolations || 0,
            complianceRate: 100, // Default until violation history is implemented
          },
          financial: {
            totalValue: `$${(portfolio.totalValue || 0).toLocaleString()}`,
            dailyPnL: `$${(perf.averageTradeReturn || 0).toFixed(2)}`,
            winRate: perf.winRate ? perf.winRate * 100 : 0,
          },
        };
      });

      const monitoringData = await Promise.all(monitoringDataPromises);

      res.json({
        success: true,
        data: monitoringData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getUnified(req: Request, res: Response): Promise<void> {
    try {
      const agents = await this.agentsModule.getAgents();

      const allActivity: any[] = [];
      const enrichedAgents: any[] = [];

      // Fetch recent decisions and status from all agents
      for (const agent of agents) {
        try {
          // 1. Get detailed status for enrichment
          const agentStatus = await this.agentsModule.getAgentStatus(agent.id);
          const perf = agentStatus.performance || {};
          const portfolio = agentStatus.portfolio || {};

          enrichedAgents.push({
            ...agent,
            internalThought:
              agentStatus.internalThought ||
              "Initializing autonomous strategy...",
            thoughtHistory: agentStatus.thoughtHistory || [],
            nextActionAt: agentStatus.nextActionAt,
            performance: {
              uptime: agent.status === "active" ? 100 : 0,
              successRate: perf.winRate * 100, // Real win rate from resolution
              avgResponseTime: 0,
              actionsToday: perf.totalTrades || 0,
            },
            riskMetrics: {
              currentRiskScore: 0,
              violationsToday: agentStatus.policyViolations || 0,
              complianceRate: 100,
            },
            financialMetrics: {
              totalValue: portfolio.totalValue || 0,
              dailyPnL: perf.totalTrades > 0 ? perf.averageTradeReturn : 0, // Using avgReturn (confidence) only if trades exist
              winRate: perf.winRate * 100,
            },
          });

          // 2. Get decisions for activity feed
          const decisions = await this.agentsModule.getAgentDecisions(
            agent.id,
            10,
          );
          const activityItems = decisions.map((d) => ({
            id: d.id || `action-${Date.now()}-${Math.random()}`,
            type: agent.type === "sapience" ? "forecast" : "governance",
            agent: agent.id,
            action: d.reasoning || `Action on ${d.symbol}`,
            amount: d.confidence || 0,
            timestamp: d.timestamp || new Date().toISOString(),
            status: "completed",
            data: {
              details: d.reasoning,
              agent: { name: agent.name },
            },
          }));
          allActivity.push(...activityItems);
        } catch (e) {
          logger.warn(`Failed to enrich agent ${agent.id}`);
          enrichedAgents.push(agent);
        }
      }

      // Sort by timestamp descending
      allActivity.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Unified dashboard data
      // Try to enrich with Worker data if enabled
      let workerAgents: WorkerAgent[] = [];
      let workerMetrics: WorkerMetrics | null = null;
      let workerThoughts: string[] = [];

      if (this.workerClient.isEnabled()) {
        try {
          workerAgents = await this.workerClient.listAgents();
          // Get metrics for first agent if available
          if (workerAgents.length > 0) {
            workerMetrics = await this.workerClient.getAgentMetrics(
              workerAgents[0].id,
            );
            workerThoughts = await this.workerClient.getThoughtHistory(
              workerAgents[0].id,
              20,
            );
          }
        } catch (e) {
          logger.warn("Failed to fetch Worker data");
        }
      }

      const unifiedData = {
        systemHealth: {
          status: "healthy",
          message: "All systems operational",
          activeAgents: agents.filter((a) => a.status === "active").length,
          totalAgents: agents.length,
          complianceRate: 100,
          totalActions: allActivity.length,
          totalPolicies: 2,
          totalForecasts:
            allActivity.filter((a) => a.type === "forecast").length ||
            enrichedAgents.reduce(
              (sum, a) => sum + (a.performance?.actionsToday || 0),
              0,
            ),
          // Cloudflare Worker metrics
          worker: workerMetrics
            ? {
                enabled: true,
                totalDecisions: workerMetrics.totalDecisions,
                approvedActions: workerMetrics.approvedActions,
                rejectedActions: workerMetrics.rejectedActions,
                avgDecisionTimeMs: workerMetrics.avgDecisionTimeMs,
              }
            : { enabled: false },
        },
        agents: enrichedAgents,
        recentActivity: allActivity.slice(0, 20),
        // Include Worker thoughts for cognitive transparency
        workerThoughts: workerThoughts,
        workerAgents: workerAgents,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: unifiedData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Market Data Endpoints
  async getMarketData(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      if (!symbol) {
        res.status(400).json({
          success: false,
          error: "Symbol parameter is required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const marketData = await this.marketDataService.getMarketData(symbol);

      res.json({
        success: true,
        data: marketData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getHistoricalData(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const days = parseInt(req.query.days as string) || 7;

      if (!symbol) {
        res.status(400).json({
          success: false,
          error: "Symbol parameter is required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const historicalData = await this.marketDataService.getHistoricalData(
        symbol,
        days,
      );

      res.json({
        success: true,
        data: historicalData,
        count: historicalData.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getMarketStats(req: Request, res: Response): Promise<void> {
    try {
      const marketStats = await this.marketDataService.getMarketStats();

      res.json({
        success: true,
        data: marketStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getTopMarkets(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const topMarkets = await this.marketDataService.getTopMarkets(limit);

      res.json({
        success: true,
        data: topMarkets,
        count: topMarkets.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Agent Comparison Endpoints
  async compareAgents(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseComparisonFilters(req.query);

      // Get agent IDs matching filters
      const agents = await this.agentsModule.getAgents();
      let filteredAgents = agents;

      if (filters.agentTypes && filters.agentTypes.length > 0) {
        filteredAgents = filteredAgents.filter((a) =>
          filters.agentTypes!.includes(a.type),
        );
      }

      if (filters.status && filters.status.length > 0) {
        filteredAgents = filteredAgents.filter((a) =>
          filters.status!.includes(a.status),
        );
      }

      const agentIds = filteredAgents.map((a) => a.id);

      // Fetch comparison metrics
      const metrics = await this.metricsAggregator.getComparisonMetrics(
        agentIds,
        filters,
      );

      // Sort results
      const sorted = this.metricsAggregator.sortMetrics(metrics, {
        field: (filters.sortBy as any) || "totalReturn",
        direction: filters.sortDirection || "desc",
      });

      res.json({
        success: true,
        data: sorted,
        count: sorted.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Comparison API error", error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const { ecosystem, metric = "totalReturn", limit = 10 } = req.query;

      const filters: any = {};
      if (ecosystem) {
        filters.ecosystems = [ecosystem as string];
      }

      // Get all agents
      const agents = await this.agentsModule.getAgents();
      const agentIds = agents.map((a) => a.id);
      const metrics = await this.metricsAggregator.getComparisonMetrics(
        agentIds,
        filters,
      );

      // Sort by metric and limit
      const sorted = this.metricsAggregator
        .sortMetrics(metrics, {
          field: metric as any,
          direction: "desc",
        })
        .slice(0, parseInt(limit as string));

      res.json({
        success: true,
        data: sorted,
        count: sorted.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Leaderboard API error", error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getAggregateStats(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseComparisonFilters(req.query);

      const agents = await this.agentsModule.getAgents();
      const agentIds = agents.map((a) => a.id);
      const metrics = await this.metricsAggregator.getComparisonMetrics(
        agentIds,
        filters,
      );

      const stats = this.metricsAggregator.calculateAggregateMetrics(metrics);

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Stats API error", error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getDashboardBundle(req: Request, res: Response): Promise<void> {
    try {
      // Get all agents
      const agents = await this.agentsModule.getAgents();
      const agentIds = agents.map((a) => a.id);

      // 1. Get agent comparison metrics (Consolidated via Aggregator)
      const bundle = await this.metricsAggregator.getDashboardBundle(agentIds);

      // 2. Get recent activity (Audit Logs)
      const activityResult = await this.auditLogService.getFilteredLogs({});
      const activity = activityResult.slice(0, 10);

      // 3. Get policies
      const policies = await this.policyService.listPolicies();

      // 4. Get governance quests (Insights)
      const insights = await this.auditLogService.generateInsights();

      // Add policy count to stats (cast to allow extra property)
      (bundle.stats as any).totalPolicies = policies.length;

      res.json({
        success: true,
        data: {
          ...bundle,
          activity,
          policies,
          quests: insights,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Dashboard bundle error", error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async streamDashboardEvents(req: Request, res: Response): Promise<void> {
    const sinceQuery =
      typeof req.query.since === "string" ? req.query.since : undefined;
    const lastEventId = req.header("Last-Event-ID") || sinceQuery || "";
    let cursorTimestamp = 0;
    let cursorId = "";

    if (lastEventId) {
      const [rawTimestamp, ...rest] = lastEventId.split(":");
      const parsed = Number(rawTimestamp);
      if (!Number.isNaN(parsed)) {
        cursorTimestamp = parsed;
        cursorId = rest.join(":");
      }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendEvent = (
      eventName: string,
      payload: Record<string, unknown>,
      id?: string,
    ) => {
      if (id) {
        res.write(`id: ${id}\n`);
      }
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendEvent("ready", {
      cursor: lastEventId,
      timestamp: new Date().toISOString(),
    });

    const sendNewEvents = async () => {
      const [auditLogs, runs] = await Promise.all([
        this.auditLogService.getFilteredLogs({}),
        creRunStore.list(),
      ]);

      const auditEvents = auditLogs.map((log) => ({
        eventName: "audit_log",
        eventId: `${new Date(log.timestamp).getTime()}:audit:${log.id}`,
        timestampMs: new Date(log.timestamp).getTime(),
        cursorTail: `audit:${log.id}`,
        payload: {
          id: log.id,
          type: log.actionType,
          severity: log.severity,
          complianceStatus: log.complianceStatus,
          description: log.description,
          timestamp: log.timestamp,
          agentId: log.agent,
          policyChecks: log.policyChecks,
          metadata: log.metadata,
          details: log.details,
          evidence: log.evidence,
        },
      }));

      const runEvents = runs.flatMap((run) =>
        (run.events || []).map((event) => ({
          eventName: "run_event",
          eventId: `${new Date(event.timestamp).getTime()}:run:${event.id}`,
          timestampMs: new Date(event.timestamp).getTime(),
          cursorTail: `run:${event.id}`,
          payload: {
            id: event.id,
            runId: run.runId,
            projectId: run.projectId,
            workflow: run.workflow,
            type: event.type,
            stepName: event.stepName,
            timestamp: event.timestamp,
            artifactCount: run.artifacts.length,
            citationLabels: (run.provenance?.citations || []).map(
              (citation) => citation.label,
            ),
            workflowVersion: run.provenance?.workflowVersion,
            model: run.provenance?.model,
            evidence: event.evidence,
            runEvidence: run.evidence,
            summary:
              typeof event.payload?.summary === "string"
                ? event.payload.summary
                : typeof event.payload?.reason === "string"
                  ? event.payload.reason
                  : undefined,
          },
        })),
      );

      const streamEvents = [...auditEvents, ...runEvents]
        .filter((entry) => {
          if (Number.isNaN(entry.timestampMs)) {
            return false;
          }

          if (entry.timestampMs > cursorTimestamp) {
            return true;
          }

          return (
            entry.timestampMs === cursorTimestamp && entry.cursorTail > cursorId
          );
        })
        .sort((left, right) => {
          if (left.timestampMs !== right.timestampMs) {
            return left.timestampMs - right.timestampMs;
          }
          return left.cursorTail.localeCompare(right.cursorTail);
        });

      for (const event of streamEvents) {
        sendEvent(event.eventName, event.payload, event.eventId);
        cursorTimestamp = event.timestampMs;
        cursorId = event.cursorTail;
      }

      if (!streamEvents.length) {
        res.write(": heartbeat\n\n");
      }
    };

    await sendNewEvents();

    const intervalId = setInterval(() => {
      void sendNewEvents();
    }, 2000);

    req.on("close", () => {
      clearInterval(intervalId);
      res.end();
    });
  }

  private parseComparisonFilters(query: any): any {
    return {
      agentIds: query.agentIds
        ? (query.agentIds as string).split(",")
        : undefined,
      agentTypes: query.agentTypes
        ? (query.agentTypes as string).split(",")
        : undefined,
      ecosystems: query.ecosystems
        ? (query.ecosystems as string).split(",")
        : undefined,
      status: query.status ? (query.status as string).split(",") : undefined,
      timeRange:
        query.startDate && query.endDate
          ? {
              start: new Date(query.startDate as string),
              end: new Date(query.endDate as string),
            }
          : undefined,
      sortBy: query.sortBy as string,
      sortDirection: query.sortDirection as "asc" | "desc",
    };
  }

  async getAgentBriefing(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.workerClient.getVoiceBriefing(id);

      if (!result) {
        res.status(503).json({
          success: false,
          error: "Voice briefing unavailable (Cloudflare Worker not connected)",
        });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate briefing",
      });
    }
  }
}
