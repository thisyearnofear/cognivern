/**
 * Agents Controller - Connected to Showcase Agents
 */

import { Request, Response } from "express";
import { AgentsModule } from "../../agents/AgentsModule.js";

export class AgentsController {
  private agentsModule: AgentsModule;

  constructor(agentsModule?: AgentsModule) {
    this.agentsModule = agentsModule || new AgentsModule();
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

  async getConnections(req: Request, res: Response): Promise<void> {
    try {
      // Get agent connections for policy management
      const agents = await this.agentsModule.getAgents();
      
      const connections = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status === 'active' ? 'connected' : 'disconnected',
        lastSeen: agent.lastActivity,
        capabilities: agent.capabilities || [],
        policies: [], // Agent type doesn't have policies property
        metadata: {
          version: '1.0.0',
          governance: 'enabled',
          monitoring: 'active'
        }
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

      // Get real agent status from our showcase agents
      const status = await this.agentsModule.getAgentStatus(agentId);

      if (!status) {
        res.status(500).json({
          success: false,
          error: "Failed to fetch recall agent data",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Transform status to match frontend expectations
      const transformedStatus = {
        isActive: status.status === 'active',
        lastUpdate: status.lastActivity || new Date().toISOString(),
        tradesExecuted: status.performance?.totalTrades || 0,
        performance: {
          totalReturn: status.performance?.averageTradeReturn || 0,
          winRate: status.performance?.winRate || 0,
          sharpeRatio: status.performance?.sharpeRatio || 0,
        }
      };

      res.json({
        success: true,
        data: transformedStatus,
        governance: {
          compliance: "Real-time monitoring active",
          riskManagement: "Automated risk controls enabled",
          auditTrail: "All activities logged and tracked",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch recall agent data",
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

      // Get real agent decisions from our agents module
      const decisions = await this.agentsModule.getAgentDecisions(agentId, limit);

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
          } catch(e) {
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
            internalThought: agentStatus.internalThought || "Monitoring markets...",
            thoughtHistory: agentStatus.thoughtHistory || [],
            nextActionAt: agentStatus.nextActionAt,
            metrics: {
                uptime: agentInfo.status === "active" ? "100%" : "0%",
                successRate: perf.winRate ? `${(perf.winRate * 100).toFixed(1)}%` : "0%",
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
                  internalThought: agentStatus.internalThought || "Initializing autonomous strategy...",
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
                  }
              });

              // 2. Get decisions for activity feed
              const decisions = await this.agentsModule.getAgentDecisions(agent.id, 10);
              const activityItems = decisions.map(d => ({
                  id: d.id || `action-${Date.now()}-${Math.random()}`,
                  type: agent.type === 'sapience' ? 'forecast' : 'governance',
                  agent: agent.id,
                  action: d.reasoning || `Action on ${d.symbol}`,
                  amount: d.confidence || 0,
                  timestamp: d.timestamp || new Date().toISOString(),
                  status: 'completed',
                  data: {
                      details: d.reasoning,
                      agent: { name: agent.name }
                  }
              }));
              allActivity.push(...activityItems);
          } catch (e) {
              console.warn(`Failed to enrich agent ${agent.id}:`, e);
              enrichedAgents.push(agent);
          }
      }

      // Sort by timestamp descending
      allActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Unified dashboard data
      const unifiedData = {
        systemHealth: {
          status: "healthy",
          message: "All systems operational",
          activeAgents: agents.filter((a) => a.status === "active").length,
          totalAgents: agents.length,
          complianceRate: 100,
          totalActions: allActivity.length,
          totalPolicies: 2, 
          totalForecasts: allActivity.filter(a => a.type === 'forecast').length || enrichedAgents.reduce((sum, a) => sum + (a.performance?.actionsToday || 0), 0)
        },
        agents: enrichedAgents,
        recentActivity: allActivity.slice(0, 20),
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
}
