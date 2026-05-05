import { Request, Response } from "express";
import { z } from "zod";
import {
  owsWalletService,
  SpendIntent,
  SpendExecutionContext,
} from "../../../services/OwsWalletService.js";
import { getChainGPTAuditService } from "../../../services/ChainGPTAuditService.js";
import crypto from "node:crypto";
import { Logger } from "../../../shared/logging/Logger.js";

const logger = new Logger("SpendController");

const spendIntentSchema = z.object({
  agentId: z.string().min(1),
  recipient: z.string().min(1),
  amount: z.string().min(1),
  asset: z.string().min(1),
  reason: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

const encryptedSpendIntentSchema = spendIntentSchema.extend({
  encryptedAmount: z.string().min(1),
  vendorHash: z.string().min(1).optional(),
});

export class SpendController {
  private buildIntent(payload: z.infer<typeof spendIntentSchema>): SpendIntent {
    return {
      id: `spend_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      agentId: payload.agentId,
      recipient: payload.recipient,
      amount: payload.amount,
      asset: payload.asset,
      reason: payload.reason,
      metadata: payload.metadata,
    };
  }

  private async executeIntent(
    req: Request,
    res: Response,
    intent: SpendIntent,
    context: SpendExecutionContext = {},
  ) {
    const owsScopedAccess = req.headers["x-ows-scoped-access"] as
      | string
      | undefined;
    logger.debug("OWS scoped access received", {
      prefix: owsScopedAccess?.substring(0, 10),
    });
    const walletId =
      typeof intent.metadata?.walletId === "string"
        ? intent.metadata.walletId
        : undefined;

    const result = await owsWalletService.executeSpend(intent, {
      apiKeyToken: owsScopedAccess,
      walletId,
      ...context,
    });
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Request a spend execution from an agent
   */
  async requestSpend(req: Request, res: Response) {
    try {
      const parse = spendIntentSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid spend intent payload",
          details: parse.error.format(),
        });
        return;
      }

      const intent = this.buildIntent(parse.data);
      await this.executeIntent(req, res, intent);
    } catch (error) {
      logger.error(
        "Spend execution failed",
        error instanceof Error ? error : undefined,
      );
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown spend execution error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Request encrypted spend execution from an agent
   */
  async requestEncryptedSpend(req: Request, res: Response) {
    try {
      const parse = encryptedSpendIntentSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid encrypted spend payload",
          details: parse.error.format(),
        });
        return;
      }

      const metadata: Record<string, any> = {
        ...(parse.data.metadata || {}),
        encryptedAmount: parse.data.encryptedAmount,
      };
      if (parse.data.vendorHash) {
        metadata.vendorHash = parse.data.vendorHash;
      }

      const intent = this.buildIntent({
        ...parse.data,
        metadata,
      });

      await this.executeIntent(req, res, intent, {
        confidential: true,
        encryptedAmount: parse.data.encryptedAmount,
        vendorHash: parse.data.vendorHash,
      });
    } catch (error) {
      logger.error(
        "Encrypted spend execution failed",
        error instanceof Error ? error : undefined,
      );
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown encrypted spend execution error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current execution layer status
   */
  async getStatus(req: Request, res: Response) {
    const status = await owsWalletService.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Preview/simulate a spend without executing it
   * Now includes ChainGPT contract audit for contract addresses
   */
  async previewSpend(req: Request, res: Response) {
    try {
      const parse = spendIntentSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid spend intent payload",
          details: parse.error.format(),
        });
        return;
      }

      const intent: SpendIntent = {
        id: `preview_${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        agentId: parse.data.agentId,
        recipient: parse.data.recipient,
        amount: parse.data.amount,
        asset: parse.data.asset,
        reason: parse.data.reason,
        metadata: { ...parse.data.metadata, previewMode: true },
      };

      // Run policy preview
      const preview = await owsWalletService.previewSpend(intent);

      // ChainGPT contract audit for contract addresses
      let contractAudit = null;
      const auditService = getChainGPTAuditService();
      const isContractAddress = /^0x[a-fA-F0-9]{40}$/.test(parse.data.recipient);

      if (auditService && isContractAddress) {
        logger.info(`Running ChainGPT audit for contract: ${parse.data.recipient}`);
        try {
          const auditResult = await auditService.auditContract(parse.data.recipient);
          contractAudit = {
            address: parse.data.recipient,
            decision: auditResult.decision,
            score: auditResult.audit.score,
            safe: auditResult.audit.safe,
            severity: auditResult.audit.severity,
            findingsCount: auditResult.audit.findings.length,
            summary: auditService.getAuditSummary(auditResult.audit),
            findings: auditResult.audit.findings.slice(0, 5), // Top 5 findings
          };

          // Override policy decision if audit finds critical issues
          if (auditResult.decision === "deny" && preview.status === "approved") {
            preview.status = "denied";
            preview.reason = `ChainGPT Audit: ${contractAudit.summary}`;
            preview.simulation.wouldExecute = false;
            preview.simulation.warnings.push(
              `Contract audit failed: ${contractAudit.summary}`
            );
          } else if (auditResult.decision === "hold" && preview.status === "approved") {
            preview.status = "held";
            preview.reason = `ChainGPT Audit: ${contractAudit.summary}`;
            preview.simulation.wouldExecute = false;
            preview.simulation.warnings.push(
              `Contract audit requires review: ${contractAudit.summary}`
            );
          }
        } catch (auditError) {
          logger.warn("ChainGPT audit failed, continuing without audit:", auditError);
          contractAudit = {
            address: parse.data.recipient,
            error: "Audit service unavailable",
          };
        }
      }

      res.json({
        success: true,
        data: {
          ...preview,
          contractAudit,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown spend preview error",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
