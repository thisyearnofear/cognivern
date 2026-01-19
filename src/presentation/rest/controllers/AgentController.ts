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
    // Mock data for now until we connect real agent events
    const decisions: SapienceDecision[] = [
      {
         action: "forecast",
         marketId: "Will ETH be above $3000 by Dec 31?",
         probability: 0.75,
         confidence: 0.8,
         reasoning: "Strong technical indicators and network growth.",
         timestamp: new Date().toISOString()
      }
    ];
    res.json({ decisions });
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