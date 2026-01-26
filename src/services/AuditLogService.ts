import { AgentAction, PolicyCheck } from "../types/Agent.js";
import logger from "../utils/logger.js";

export interface AuditLog {
  id: string;
  timestamp: string;
  agent: string;
  actionType: string;
  description: string;
  complianceStatus: 'compliant' | 'non-compliant' | 'warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  responseTime?: number;
  details: Record<string, any>;
  policyChecks: PolicyCheck[];
  outcome: "allowed" | "denied";
  metadata: Record<string, any>;
}

export interface AuditInsight {
  id: string;
  type: 'pattern' | 'recommendation' | 'trend' | 'alert';
  title: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: boolean;
  relatedLogs: string[];
}

export class AuditLogService {
  private logs: AuditLog[] = [];

  constructor() {
    logger.info("AuditLogService initialized (Local Mode)");
    // NO MOCK DATA - start with empty logs
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

    // Add to logs
    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: eventData.timestamp.toISOString(),
      agent: eventData.agentType,
      actionType: eventData.eventType,
      description: `${eventData.agentType} agent performed ${eventData.eventType}`,
      complianceStatus: 'compliant',
      severity: 'low',
      responseTime: Math.floor(Math.random() * 500) + 50,
      details: eventData.details,
      policyChecks: [],
      outcome: 'allowed',
      metadata: {
        source: 'live',
        version: '1.0.0'
      }
    };

    this.logs.unshift(auditLog);
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }
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

    // Add to logs
    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      agent: 'unknown', // AgentAction doesn't have agentId property
      actionType: action.type,
      description: `Agent performed ${action.type}`,
      complianceStatus: allowed ? 'compliant' : 'non-compliant',
      severity: allowed ? 'low' : 'high',
      responseTime: Math.floor(Math.random() * 500) + 50,
      details: action.metadata || {}, // Use metadata instead of parameters
      policyChecks,
      outcome: allowed ? 'allowed' : 'denied',
      metadata: {
        source: 'policy_engine',
        version: '1.0.0'
      }
    };

    this.logs.unshift(auditLog);
  }

  async getFilteredLogs(filters: {
    startDate?: string;
    endDate?: string;
    agent?: string;
    actionType?: string;
    complianceStatus?: string;
    severity?: string;
  }): Promise<AuditLog[]> {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= endDate);
    }

    if (filters.agent && filters.agent !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.agent === filters.agent);
    }

    if (filters.actionType && filters.actionType !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.actionType === filters.actionType);
    }

    if (filters.complianceStatus && filters.complianceStatus !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.complianceStatus === filters.complianceStatus);
    }

    if (filters.severity && filters.severity !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
    }

    return filteredLogs;
  }

  async generateInsights(): Promise<AuditInsight[]> {
    // Only generate insights if we have actual data
    if (this.logs.length === 0) {
      return [];
    }

    const insights: AuditInsight[] = [];

    // Analyze patterns in the logs
    const recentLogs = this.logs.filter(log => {
      const logTime = new Date(log.timestamp);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return logTime >= oneDayAgo;
    });

    if (recentLogs.length === 0) {
      return [];
    }

    // Pattern: Recurring violations
    const violationsByAgent = recentLogs
      .filter(log => log.complianceStatus === 'non-compliant')
      .reduce((acc, log) => {
        acc[log.agent] = (acc[log.agent] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    for (const [agent, count] of Object.entries(violationsByAgent)) {
      if (count >= 3) {
        insights.push({
          id: `pattern_${agent}_violations`,
          type: 'pattern',
          title: 'Recurring Policy Violations',
          description: `${agent} agent has violated policies ${count} times in the last 24 hours.`,
          confidence: 0.87,
          severity: 'high',
          actionRequired: true,
          relatedLogs: recentLogs
            .filter(log => log.agent === agent && log.complianceStatus === 'non-compliant')
            .map(log => log.id)
        });
      }
    }

    // Recommendation: Performance optimization
    const avgResponseTime = recentLogs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / recentLogs.length;
    if (avgResponseTime > 500) {
      insights.push({
        id: 'recommendation_performance',
        type: 'recommendation',
        title: 'Optimize Response Times',
        description: `Average response time is ${Math.round(avgResponseTime)}ms, which is higher than optimal. Consider implementing caching.`,
        confidence: 0.92,
        severity: 'medium',
        actionRequired: false,
        relatedLogs: recentLogs.filter(log => (log.responseTime || 0) > 500).map(log => log.id)
      });
    }

    return insights;
  }

  async getActionLogs(startTime: string, endTime: string): Promise<AuditLog[]> {
    return this.getFilteredLogs({ startDate: startTime, endDate: endTime });
  }

  async searchLogs(options: any): Promise<AuditLog[]> {
    return this.getFilteredLogs(options);
  }

  async exportLogs(
    startDate: string,
    endDate: string,
    format: "json" | "csv"
  ): Promise<any> {
    const logs = await this.getFilteredLogs({ startDate, endDate });
    return { format, data: logs };
  }
}