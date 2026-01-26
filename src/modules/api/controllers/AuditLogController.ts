/**
 * Audit Log Controller
 */

import { Request, Response } from 'express';
import { AuditLogService } from '../../../services/AuditLogService.js';

export class AuditLogController {
  private auditLogService: AuditLogService;

  constructor() {
    this.auditLogService = new AuditLogService();
  }

  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        agent,
        actionType,
        complianceStatus,
        severity
      } = req.query;

      // Get audit logs with filters
      const logs = await this.auditLogService.getFilteredLogs({
        startDate: startDate as string,
        endDate: endDate as string,
        agent: agent as string,
        actionType: actionType as string,
        complianceStatus: complianceStatus as string,
        severity: severity as string
      });

      // Calculate summary statistics
      const totalActions = logs.length;
      const compliantActions = logs.filter(log => log.complianceStatus === 'compliant').length;
      const complianceRate = totalActions > 0 ? (compliantActions / totalActions) * 100 : 0;
      const avgResponseTime = logs.length > 0 
        ? logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / logs.length 
        : 0;
      const criticalIssues = logs.filter(log => log.severity === 'critical').length;

      res.json({
        success: true,
        data: {
          logs,
          summary: {
            totalActions,
            complianceRate: Math.round(complianceRate * 100) / 100,
            avgResponseTime: Math.round(avgResponseTime),
            criticalIssues
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  async getInsights(req: Request, res: Response): Promise<void> {
    try {
      // Generate AI-powered insights based on audit data
      const insights = await this.auditLogService.generateInsights();

      res.json({
        success: true,
        data: insights,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INSIGHTS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate insights'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
}
