import { Request, Response } from "express";
import { AuditLogService } from "../../../services/AuditLogService.js";
import { z } from "zod";
import { owsWalletService } from "../../../services/OwsWalletService.js";

const issuePermitSchema = z.object({
  auditor: z.string().min(1),
  policyId: z.string().min(1),
});

export class AuditLogController {
  private auditLogService: AuditLogService;

  constructor(auditLogService?: AuditLogService) {
    this.auditLogService = auditLogService || new AuditLogService();
  }

  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        agent,
        actionType,
        complianceStatus,
        severity,
      } = req.query;

      // Get audit logs with filters (now backed by CRE storage)
      const logs = await this.auditLogService.getFilteredLogs({
        startDate: startDate as string,
        endDate: endDate as string,
        agent: agent as string,
        actionType: actionType as string,
        complianceStatus: complianceStatus as string,
        severity: severity as string,
      });

      // Calculate summary statistics
      const totalActions = logs.length;
      const compliantActions = logs.filter(
        (log) => log.complianceStatus === "compliant",
      ).length;
      const complianceRate =
        totalActions > 0 ? (compliantActions / totalActions) * 100 : 0;
      const avgResponseTime =
        logs.length > 0
          ? logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) /
            logs.length
          : 0;
      const criticalIssues = logs.filter(
        (log) => log.severity === "critical",
      ).length;

      res.json({
        success: true,
        data: {
          logs,
          summary: {
            totalActions,
            complianceRate: Math.round(complianceRate * 100) / 100,
            avgResponseTime: Math.round(avgResponseTime),
            criticalIssues,
          },
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

  async getInsights(req: Request, res: Response): Promise<void> {
    try {
      const insights = await this.auditLogService.generateInsights();

      res.json({
        success: true,
        data: insights,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INSIGHTS_ERROR",
          message: "Failed to generate unified insights",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async resolveInsight(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const success = await this.auditLogService.resolveInsight(id);
    res.json({
      success,
      message: success ? "Insight resolved successfully" : "Failed to resolve insight",
      timestamp: new Date().toISOString(),
    });
  }

  async issuePermit(req: Request, res: Response): Promise<void> {
    const parse = issuePermitSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: "Invalid permit request payload",
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const permit = await owsWalletService.issueAuditPermit(
      parse.data.auditor,
      parse.data.policyId,
    );
    res.json({
      success: true,
      data: {
        permit,
        auditor: parse.data.auditor,
        policyId: parse.data.policyId,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
