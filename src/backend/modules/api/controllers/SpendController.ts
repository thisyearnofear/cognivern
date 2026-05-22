import { Request, Response } from "express";
import { z } from "zod";
import {
  owsWalletService,
  SpendIntent,
  SpendExecutionContext,
} from "../../../services/OwsWalletService.js";
import { getChainGPTAuditService, AuditResult } from "../../../services/ChainGPTAuditService.js";
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

  /**
   * Run ChainGPT audit on contract address if available
   * Returns audit result or null if not applicable
   */
  private async auditContract(recipient: string): Promise<{
    decision: "approve" | "hold" | "deny";
    audit: AuditResult;
  } | null> {
    const auditService = getChainGPTAuditService();
    const isContractAddress = /^0x[a-fA-F0-9]{40}$/.test(recipient);

    if (!auditService || !isContractAddress) {
      return null;
    }

    logger.info(`Running ChainGPT audit for contract: ${recipient}`);
    return auditService.auditContract(recipient);
  }

  /**
   * Apply audit decision to override spend status if needed
   */
  private applyAuditDecision(
    auditResult: { decision: "approve" | "hold" | "deny" },
    currentStatus: "approved" | "held" | "denied",
  ): { status: "approved" | "held" | "denied"; override: boolean } {
    if (auditResult.decision === "deny" && currentStatus === "approved") {
      return { status: "denied", override: true };
    }
    if (auditResult.decision === "hold" && currentStatus === "approved") {
      return { status: "held", override: true };
    }
    return { status: currentStatus, override: false };
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

    // Run ChainGPT audit before execution
    let contractAudit = null;
    try {
      const auditResult = await this.auditContract(intent.recipient);
      if (auditResult) {
        const auditService = getChainGPTAuditService();
        contractAudit = {
          address: intent.recipient,
          decision: auditResult.decision,
          score: auditResult.audit.score,
          safe: auditResult.audit.safe,
          severity: auditResult.audit.severity,
          findingsCount: auditResult.audit.findings.length,
          summary: auditService?.getAuditSummary(auditResult.audit) || "",
          findings: auditResult.audit.findings.slice(0, 5),
        };

        // Block execution if audit denies
        if (auditResult.decision === "deny") {
          logger.warn(`Spend blocked by ChainGPT audit: ${intent.recipient}`);
          res.status(403).json({
            success: false,
            error: "Spend blocked by security audit",
            data: {
              intentId: intent.id,
              status: "denied",
              contractAudit,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }
    } catch (auditError) {
      logger.warn("ChainGPT audit failed, continuing with spend:", auditError);
    }

    const result = await owsWalletService.executeSpend(intent, {
      apiKeyToken: owsScopedAccess,
      walletId,
      ...context,
    });

    res.json({
      success: true,
      data: {
        ...result,
        contractAudit,
      },
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
   * Scan a contract address for security vulnerabilities
   * No authentication required - public endpoint for landing page
   */
  async scanContract(req: Request, res: Response) {
    try {
      const { address } = req.query;

      if (!address || typeof address !== "string") {
        res.status(400).json({
          success: false,
          error: "Missing required parameter: address",
        });
        return;
      }

      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        res.status(400).json({
          success: false,
          error: "Invalid Ethereum address format",
        });
        return;
      }

      const auditService = getChainGPTAuditService();
      if (!auditService) {
        res.status(503).json({
          success: false,
          error: "Audit service unavailable",
        });
        return;
      }

      const auditResult = await auditService.auditContract(address);

      res.json({
        success: true,
        data: {
          address,
          decision: auditResult.decision,
          score: auditResult.audit.score,
          safe: auditResult.audit.safe,
          severity: auditResult.audit.severity,
          findingsCount: auditResult.audit.findings.length,
          summary: auditService.getAuditSummary(auditResult.audit),
          findings: auditResult.audit.findings.slice(0, 5),
          auditedAt: auditResult.audit.auditedAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        "Contract scan failed",
        error instanceof Error ? error : undefined,
      );
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Contract scan failed",
        timestamp: new Date().toISOString(),
      });
    }
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

      // ChainGPT contract audit
      let contractAudit = null;
      try {
        const auditResult = await this.auditContract(parse.data.recipient);
        if (auditResult) {
          const auditService = getChainGPTAuditService();
          contractAudit = {
            address: parse.data.recipient,
            decision: auditResult.decision,
            score: auditResult.audit.score,
            safe: auditResult.audit.safe,
            severity: auditResult.audit.severity,
            findingsCount: auditResult.audit.findings.length,
            summary: auditService?.getAuditSummary(auditResult.audit) || "",
            findings: auditResult.audit.findings.slice(0, 5),
          };

          // Override policy decision if audit finds issues
          const override = this.applyAuditDecision(auditResult, preview.status);
          if (override.override) {
            preview.status = override.status;
            preview.reason = `ChainGPT Audit: ${contractAudit.summary}`;
            preview.simulation.wouldExecute = false;
            preview.simulation.warnings.push(
              `Contract audit ${override.status === "denied" ? "failed" : "requires review"}: ${contractAudit.summary}`
            );
          }
        }
      } catch (auditError) {
        logger.warn("ChainGPT audit failed, continuing without audit:", auditError);
        contractAudit = {
          address: parse.data.recipient,
          error: "Audit service unavailable",
        };
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
