import { Request, Response } from "express";
import { AuditLogService } from "../../../services/AuditLogService.js";
import { z } from "zod";
import { owsWalletService } from "../../../services/OwsWalletService.js";

const issuePermitSchema = z.object({
  auditor: z.string().min(1).optional(),
  auditorAddress: z.string().min(1).optional(),
  policyId: z.string().min(1),
  scope: z.array(z.string()).optional(),
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

    const auditor = parse.data.auditor || parse.data.auditorAddress || "";
    const scope = parse.data.scope || ["dailyLimit", "spentToday"];

    try {
      const permit = await owsWalletService.issueAuditPermit(
        auditor,
        parse.data.policyId,
      );
      res.json({
        success: true,
        data: {
          permit,
          auditor,
          policyId: parse.data.policyId,
          scope,
          note: "approvalThreshold and perTxLimit remain sealed",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      // Graceful fallback for demo when CoFHE is unavailable
      res.json({
        success: true,
        data: {
          permit: `0x${crypto.randomUUID().replace(/-/g, "")}`,
          auditor,
          policyId: parse.data.policyId,
          scope,
          note: `Permit fallback: ${error.message.slice(0, 80)}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async decryptLog(req: Request, res: Response): Promise<void> {
    const { decisionId } = req.params;
    const permit = req.headers["x-audit-permit"] as string | undefined;

    if (!permit) {
      res.status(400).json({
        success: false,
        error: "Missing X-Audit-Permit header",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Demo response with mock decrypted values
    res.json({
      success: true,
      data: {
        decisionId,
        dailyLimit: "0x0800000000000010000000000000000000000000000000000000000000000000",
        spentToday: "0x0800000000000000c80000000000000000000000000000000000000000000000",
        outcome: "approve",
        note: "approvalThreshold not in permit scope — remains encrypted",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
