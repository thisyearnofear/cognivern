import { AgentAction, PolicyCheck } from "../types/Agent.js";
import logger from "../utils/logger.js";

export interface AuditLog {
  timestamp: string;
  action: AgentAction;
  policyChecks: PolicyCheck[];
  outcome: "allowed" | "denied";
  metadata: Record<string, any>;
}

export class AuditLogService {
  constructor() {
    logger.info("AuditLogService initialized (Local Mode)");
  }

  async logEvent(eventData: {
    eventType: string;
    agentType: string;
    timestamp: Date;
    details: Record<string, any>;
  }): Promise<void> {
    logger.info(`[AuditLog] Event: ${eventData.eventType}`, {
      timestamp: eventData.timestamp,
      agentType: eventData.agentType,
      details: eventData.details,
    });
  }

  async logAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    allowed: boolean
  ): Promise<void> {
    logger.info(`[AuditLog] Action: ${action.type}`, {
      actionId: action.id,
      allowed,
      policyChecks: policyChecks.length,
    });
  }

  async getActionLogs(startTime: string, endTime: string): Promise<AuditLog[]> {
    // Return empty logs for now as we are not persisting
    return [];
  }

  async searchLogs(options: any): Promise<any[]> {
    return [];
  }

  async exportLogs(
    startDate: string,
    endDate: string,
    format: "json" | "csv"
  ): Promise<any> {
    return { format, data: [] };
  }
}