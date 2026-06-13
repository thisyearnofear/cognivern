import { Request, Response } from 'express';
import { AuditLogService } from '../../../services/AuditLogService.js';
import { z } from 'zod';
import { owsWalletService } from '../../../services/OwsWalletService.js';

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
      const { startDate, endDate, agent, actionType, complianceStatus, severity } = req.query;

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
      const compliantActions = logs.filter((log) => log.complianceStatus === 'compliant').length;
      const complianceRate = totalActions > 0 ? (compliantActions / totalActions) * 100 : 0;
      const avgResponseTime =
        logs.length > 0
          ? logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / logs.length
          : 0;
      const criticalIssues = logs.filter((log) => log.severity === 'critical').length;

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
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getInsights(req: Request, res: Response): Promise<void> {
    const dimension = req.query.dimension as string | undefined;

    if (dimension === 'ai_spend') {
      return this.getAiSpendInsights(req, res);
    }

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
          code: 'INSIGHTS_ERROR',
          message: 'Failed to generate unified insights',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getAiSpendInsights(_req: Request, res: Response): Promise<void> {
    try {
      const logs = await this.auditLogService.getFilteredLogs({});
      const aiEntries: Array<{
        provider: string;
        model: string;
        costUsd: number;
        inputTokens: number;
        outputTokens: number;
        taskClass: string;
        timestamp: string;
      }> = [];

      for (const log of logs) {
        const aiUsage = (log as unknown as Record<string, unknown>).aiUsage as
          | Record<string, unknown>
          | undefined;
        if (aiUsage && typeof aiUsage.costUsd === 'number') {
          aiEntries.push({
            provider: String(aiUsage.provider || 'unknown'),
            model: String(aiUsage.model || 'unknown'),
            costUsd: aiUsage.costUsd,
            inputTokens: Number(aiUsage.inputTokens || 0),
            outputTokens: Number(aiUsage.outputTokens || 0),
            taskClass: String(aiUsage.taskClass || 'unknown'),
            timestamp: String((log as unknown as Record<string, unknown>).timestamp || new Date().toISOString()),
          });
        }
      }

      const totalCostUsd = aiEntries.reduce((sum, e) => sum + e.costUsd, 0);
      const totalTokens = aiEntries.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0);
      const byProvider: Record<string, { costUsd: number; tokens: number; calls: number }> = {};
      for (const e of aiEntries) {
        if (!byProvider[e.provider]) {
          byProvider[e.provider] = { costUsd: 0, tokens: 0, calls: 0 };
        }
        byProvider[e.provider].costUsd += e.costUsd;
        byProvider[e.provider].tokens += e.inputTokens + e.outputTokens;
        byProvider[e.provider].calls += 1;
      }

      res.json({
        success: true,
        data: {
          totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
          totalTokens,
          totalCalls: aiEntries.length,
          byProvider,
          recentEntries: aiEntries.slice(-20),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'AI_SPEND_ERROR',
          message: 'Failed to generate AI spend insights',
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
      message: success ? 'Insight resolved successfully' : 'Failed to resolve insight',
      timestamp: new Date().toISOString(),
    });
  }

  async issuePermit(req: Request, res: Response): Promise<void> {
    const parse = issuePermitSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid permit request payload',
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const auditor = parse.data.auditor || parse.data.auditorAddress || '';
    const scope = parse.data.scope || ['dailyLimit', 'spentToday'];

    try {
      const permit = await owsWalletService.issueAuditPermit(auditor, parse.data.policyId);
      res.json({
        success: true,
        data: {
          permit,
          auditor,
          policyId: parse.data.policyId,
          scope,
          note: 'approvalThreshold and perTxLimit remain sealed',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      // Graceful fallback for demo when CoFHE is unavailable
      res.json({
        success: true,
        data: {
          permit: `0x${crypto.randomUUID().replace(/-/g, '')}`,
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
    const permit = req.headers['x-audit-permit'] as string | undefined;

    if (!permit) {
      res.status(400).json({
        success: false,
        error: 'Missing X-Audit-Permit header',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Demo response with mock decrypted values
    res.json({
      success: true,
      data: {
        decisionId,
        dailyLimit: '0x0800000000000010000000000000000000000000000000000000000000000000',
        spentToday: '0x0800000000000000c80000000000000000000000000000000000000000000000',
        outcome: 'approve',
        note: 'approvalThreshold not in permit scope — remains encrypted',
      },
      timestamp: new Date().toISOString(),
    });
  }

  async getTimeline(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const logs = await this.auditLogService.getFilteredLogs({});
      const log = logs.find((l) => l.id === id);
      if (!log) {
        res.status(404).json({
          success: false,
          error: 'Audit log not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const raw = log as unknown as Record<string, unknown>;
      const baseTime = String(raw.timestamp || new Date().toISOString());
      const events: Array<{
        id: number;
        type: string;
        label: string;
        timestamp: string;
        payload?: Record<string, unknown>;
        status?: 'success' | 'error' | 'pending' | 'info';
      }> = [];

      let seq = 1;
      const ms = new Date(baseTime).getTime();

      events.push({
        id: seq++,
        type: 'request_received',
        label: `Governance request received: ${raw.action || raw.actionType || 'evaluate'}`,
        timestamp: baseTime,
        payload: {
          agentId: raw.agentId,
          action: raw.action || raw.actionType,
        },
        status: 'info',
      });

      const checks = raw.policyChecks as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(checks)) {
        for (const check of checks) {
          events.push({
            id: seq++,
            type: 'policy_check',
            label: `Policy check: ${check.policyId || 'unknown'}`,
            timestamp: new Date(ms + seq * 10).toISOString(),
            payload: {
              policyId: check.policyId,
              result: check.result,
              reason: check.reason,
            },
            status: check.result === true ? 'success' : 'error',
          });
        }
      }

      const conf = raw.confidential as Record<string, unknown> | undefined;
      if (conf?.fheEvaluated === true) {
        const ids = (conf.decisionIds as string[]) || [];
        events.push({
          id: seq++,
          type: 'fhe_evaluation',
          label: 'FHE encrypted evaluation completed',
          timestamp: new Date(ms + seq * 10).toISOString(),
          payload: {
            decisionIds: ids,
            resolved: conf.resolved === true,
          },
          status: conf.resolved === true ? 'success' : 'pending',
        });
      }

      if (raw.signingProvider === 'ledger') {
        events.push({
          id: seq++,
          type: 'signing',
          label: 'Hardware signing via Ledger',
          timestamp: new Date(ms + seq * 10).toISOString(),
          status: 'success',
        });
      }

      const decision = raw.decision || raw.outcome || raw.complianceStatus;
      events.push({
        id: seq++,
        type: 'decision_recorded',
        label: `Decision recorded: ${decision || 'unknown'}`,
        timestamp: new Date(ms + seq * 10).toISOString(),
        payload: {
          decision,
          responseTime: raw.responseTime,
        },
        status: decision === 'approved' || decision === 'compliant' ? 'success' : decision === 'denied' ? 'error' : 'info',
      });

      const evidence = raw.evidence as Record<string, unknown> | undefined;
      if (evidence) {
        if (evidence.filecoinCid) {
          events.push({
            id: seq++,
            type: 'anchoring_filecoin',
            label: 'Anchored to Filecoin Calibration',
            timestamp: new Date(ms + seq * 10).toISOString(),
            payload: { cid: evidence.filecoinCid, txHash: evidence.filecoinTxHash },
            status: 'success',
          });
        }
        if (evidence.zeroGRootHash) {
          events.push({
            id: seq++,
            type: 'anchoring_0g',
            label: 'Anchored to 0G Storage',
            timestamp: new Date(ms + seq * 10).toISOString(),
            payload: { rootHash: evidence.zeroGRootHash },
            status: 'success',
          });
        }
      }

      res.json({
        success: true,
        data: { logId: id, events },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'TIMELINE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
