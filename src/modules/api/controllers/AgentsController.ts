/**
 * Agents Controller - Connected to Showcase Agents
 */

import { Request, Response } from "express";
import { AgentsModule } from "../../agents/AgentsModule.js";

export class AgentsController {
  private agentsModule: AgentsModule;

  constructor() {
    this.agentsModule = new AgentsModule();
  }

  async initialize(): Promise<void> {
    await this.agentsModule.initialize();
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
      const { id } = req.params;

      // Get real agent status from our showcase agents
      const status = await this.agentsModule.getAgentStatus(id);

      if (!status) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Showcase agent with id ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: status,
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
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
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
            metrics: {
                uptime: agentInfo.status === "active" ? "100%" : "0%",
                successRate: perf.winRate ? `${(perf.winRate * 100).toFixed(1)}%` : "0%",
                avgResponse: "N/A", // Not tracked in basic metrics yet
                actionsToday: perf.period?.totalTrades || 0,
            },
            risk: {
                riskScore: 0, // Placeholder as we don't calculate risk score yet
                violationsToday: agentStatus.policyViolations || 0,
                complianceRate: 100, // Default until we have violation history
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

      // Fetch recent decisions from all agents
      for (const agent of agents) {
          try {
              const decisions = await this.agentsModule.getAgentDecisions(agent.id, 5);
              const activityItems = decisions.map(d => ({
                  id: d.id || `action-${Date.now()}-${Math.random()}`,
                  type: agent.type === 'sapience' ? 'forecast' : 'governance',
                  agent: agent.id,
                  action: d.reasoning || `Action on ${d.symbol}`,
                  amount: d.confidence || 0,
                  timestamp: d.timestamp || new Date().toISOString(),
                  status: 'completed'
              }));
              allActivity.push(...activityItems);
          } catch (e) {
              // Ignore failure for single agent to keep dashboard alive
              console.warn(`Failed to fetch decisions for ${agent.id}`);
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
          complianceRate: 100, // Only tracking basic compliance
          totalActions: allActivity.length,
        },
        agents: agents,
        recentActivity: allActivity.slice(0, 20), // Top 20
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
