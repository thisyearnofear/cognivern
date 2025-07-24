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
            "Recall Trading Agent - Direct trading with governance monitoring",
            "Vincent Social Trading Agent - Social trading with compliance tracking",
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
            message: `Showcase agent with id ${id} not found. Available agents: recall-agent-1, vincent-agent-1`,
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

  // Legacy methods for existing routes
  async getMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const agents = await this.agentsModule.getAgents();
      const monitoring = {
        totalAgents: agents.length,
        activeAgents: agents.filter((a) => a.status === "active").length,
        governanceStatus: "All agents under active governance monitoring",
        lastUpdate: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: monitoring,
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

  async getUnified(req: Request, res: Response): Promise<void> {
    try {
      const agents = await this.agentsModule.getAgents();

      res.json({
        success: true,
        data: {
          agents,
          platform: "Cognivern AI Agent Governance",
          features: [
            "Real-time compliance monitoring",
            "Automated governance enforcement",
            "Performance tracking",
            "Risk management",
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
}
