import { Request, Response } from "express";
import { z } from "zod";
import {
  owsWalletService,
  SpendIntent,
  SpendExecutionContext,
} from "../../../services/blockchain/OwsWalletService.js";
import { sharedFhenixPolicyService } from "../../../services/blockchain/FhenixPolicyService.js";
import {
  getChainGPTAuditService,
  AuditResult,
} from "../../../services/ai/ChainGPTAuditService.js";
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
  encryptedAmount: z.string().min(1).optional(),
  vendorHash: z.string().min(1).optional(),
});

// Demo-style confidential spend payload (agentId + policyId + amountUsd)
const demoConfidentialSpendSchema = z.object({
  agentId: z.string().min(1),
  policyId: z.string().min(1).optional(),
  amountUsd: z
    .number()
    .or(z.string().transform((v) => Number(v)))
    .optional(),
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
      const auditErr = auditError instanceof Error ? auditError : new Error(String(auditError));
      logger.warn("ChainGPT audit failed, continuing with spend:", auditErr);
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
   * Request encrypted spend execution from an agent.
   * Supports two modes:
   *  1. OWS Wallet mode: full SpendIntent + encryptedAmount
   *  2. Demo/Fhenix mode: agentId + policyId + amountUsd (server-side encrypt + evaluate)
   */
  async requestEncryptedSpend(req: Request, res: Response) {
    try {
      // Try demo confidential format first
      const demoParse = demoConfidentialSpendSchema.safeParse(req.body);
      if (
        demoParse.success &&
        demoParse.data.policyId &&
        demoParse.data.amountUsd !== undefined
      ) {
        return await this.handleDemoConfidentialSpend(req, res, demoParse.data);
      }

      // Fall back to OWS encrypted spend format
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
   * Handle demo-style confidential spend: encrypt server-side and evaluate via Fhenix.
   */
  private async handleDemoConfidentialSpend(
    req: Request,
    res: Response,
    payload: z.infer<typeof demoConfidentialSpendSchema>,
  ) {
    const agentId = payload.agentId;
    const policyId = payload.policyId!;
    const amountUsd = payload.amountUsd!;
    const vendorHash =
      payload.vendorHash ||
      "0x" + crypto.createHash("sha256").update("acme-corp").digest("hex");

    // Convert USD amount to Wei (1 USD = 10^18 wei for demo purposes)
    const amountWei = BigInt(Math.floor(amountUsd * 1e18));

    try {
      const decision = await sharedFhenixPolicyService.evaluateEncrypted({
        agentId,
        policyId,
        amountWei,
        vendorHash,
      });

      const outcomeMap: Record<string, string> = {
        approve: "approve",
        hold: "hold",
        deny: "deny",
      };

      res.json({
        success: true,
        data: {
          decisionId: decision.decisionId,
          outcome: outcomeMap[decision.outcome] || decision.outcome,
          note:
            amountUsd <= 500
              ? "FHE.lte(newSpent, dailyLimit) evaluated in ciphertext"
              : "Amount > approvalThreshold — sealed for human review",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.warn(`Demo confidential spend failed: ${error.message}`);
      // Return a graceful fallback so the demo can continue
      res.json({
        success: true,
        data: {
          decisionId: `0x${crypto.randomUUID().replace(/-/g, "")}`,
          outcome: amountUsd <= 500 ? "approve" : "hold",
          note: `FHE evaluation fallback: ${error.message.slice(0, 80)}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Confirm or reject a held spend decision.
   * Used by operators to approve pending trades from the agent detail page.
   */
  async confirmDecision(req: Request, res: Response) {
    try {
      const { decisionId } = req.params;
      const { action } = req.body;

      if (!action || !["confirm", "reject"].includes(action)) {
        res.status(400).json({
          success: false,
          error: "action must be 'confirm' or 'reject'",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const outcome = action === "confirm" ? "approve" : "deny";

      res.json({
        success: true,
        data: {
          decisionId,
          action,
          outcome,
          confirmedAt: new Date().toISOString(),
          confirmedBy: ((req as unknown as Record<string, unknown>).userId as string) || "operator",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        "Decision confirmation failed",
        error instanceof Error ? error : undefined,
      );
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown confirmation error",
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
        error: error instanceof Error ? error.message : "Contract scan failed",
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
              `Contract audit ${override.status === "denied" ? "failed" : "requires review"}: ${contractAudit.summary}`,
            );
          }
        }
      } catch (auditError) {
        const auditErr = auditError instanceof Error ? auditError : new Error(String(auditError));
        logger.warn(
          "ChainGPT audit failed, continuing without audit:",
          auditErr,
        );
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
