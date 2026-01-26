import { Request, Response } from "express";
import { AuditLogService } from "../../../services/AuditLogService.js";
import { MetricsService } from "../../../services/MetricsService.js";
import logger from "../../../utils/logger.js";

export interface SapienceDecision {
  action: "forecast" | "trade";
  marketId: string;
  probability?: number;
  amount?: number;
  confidence: number;
  reasoning: string;
  timestamp: string;
}

export class AgentController {
  private auditLogService: AuditLogService;
  private metricsService: MetricsService;

  constructor(
    _recallService: any, // Ignored/Removed
    auditLogService: AuditLogService,
    metricsService: MetricsService
  ) {
    this.auditLogService = auditLogService;
    this.metricsService = metricsService;
  }

  // Sapience Endpoints
  async getDecisions(req: Request, res: Response) {
    // No real agent decisions available
    res.status(404).json({ 
      success: false,
      error: "Agent decisions not available - no active agents",
      decisions: [] 
    });
  }

  async getStatus(req: Request, res: Response) {
      res.json({
          status: "active",
          agent: "Sapience Agent 1",
          type: "forecasting"
      });
  }
  
  // Stubs for legacy routes to prevent crashes
  async getRecallDecisions(req: Request, res: Response) { res.json({ decisions: [] }); }
  async getRecallStatus(req: Request, res: Response) { res.json({ status: "inactive" }); }
  async startRecallAgent(req: Request, res: Response) { res.json({ success: false, message: "Deprecated" }); }
  async stopRecallAgent(req: Request, res: Response) { res.json({ success: false, message: "Deprecated" }); }
  async getVincentDecisions(req: Request, res: Response) { res.json({ decisions: [] }); }
  async getVincentStatus(req: Request, res: Response) { res.json({ status: "inactive" }); }
  async startVincentAgent(req: Request, res: Response) { res.json({ success: false, message: "Deprecated" }); }
  async stopVincentAgent(req: Request, res: Response) { res.json({ success: false, message: "Deprecated" }); }
  async updateVincentPolicies(req: Request, res: Response) { res.json({ success: false }); }
  async setVincentConsent(req: Request, res: Response) { res.json({ success: false }); }
}