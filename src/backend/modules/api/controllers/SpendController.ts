import { Request, Response } from 'express';
import { z } from 'zod';
import {
  owsWalletService,
  SpendIntent,
  SpendExecutionContext,
} from '@backend/services/blockchain/OwsWalletService.js';
import { sharedFhenixPolicyService } from '@backend/services/blockchain/FhenixPolicyService.js';
import { getChainGPTAuditService, AuditResult } from '@backend/services/ai/ChainGPTAuditService.js';
import crypto from 'node:crypto';
import { Logger } from '@backend/shared/logging/Logger.js';
import {
  SOURCE_KINDS,
  sourceAwareSpendAuthorizationService,
} from '@backend/services/governance/SourceAwareSpendAuthorization.js';
import { FundedMandateService } from '@backend/services/governance/FundedMandateService.js';

const logger = new Logger('SpendController');

const spendIntentSchema = z.object({
  agentId: z.string().min(1),
  recipient: z.string().min(1),
  amount: z.string().min(1),
  asset: z.string().min(1),
  reason: z.string().min(1),
  metadata: z.record(z.any()).optional(),
  // Binding fields from /api/spend/preview. Previously these were silently
  // stripped by this schema, so the server never verified them — the
  // attestation flow was a client-side convention only.
  attestationHash: z.string().optional(),
  humanConfirmationToken: z.string().optional(),
  sourceAuthorization: z.string().optional(),
});

const sourceProvenanceSchema = z.object({
  sources: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(SOURCE_KINDS),
        locator: z.string().min(1).optional(),
        contentHash: z.string().min(1).optional(),
      }),
    )
    .min(1),
  recipientIntroducedByUntrustedSource: z.boolean().optional(),
});

const sourceAuthorizationRequestSchema = z.object({
  agentId: z.string().min(1),
  recipient: z.string().min(1),
  asset: z.string().min(1),
  maxAmount: z.string().regex(/^\d+$/),
  reason: z.string().min(1),
  allowedSourceKinds: z.array(z.enum(SOURCE_KINDS)).min(1),
  expiresInSeconds: z.number().int().positive().optional(),
});

// Secret for preview→execute attestation binding. Falls back to a
// per-process random secret (verification still works because preview and
// execute hit the same process; set SPEND_ATTESTATION_SECRET for
// multi-process deployments or restart-survival).
const attestationSecret =
  process.env.SPEND_ATTESTATION_SECRET || crypto.randomBytes(32).toString('hex');

function computeAttestationHash(payload: {
  agentId: string;
  recipient: string;
  amount: string;
  asset: string;
}): string {
  return crypto
    .createHmac('sha256', attestationSecret)
    .update(`${payload.agentId}|${payload.recipient}|${payload.amount}|${payload.asset}`)
    .digest('hex');
}

function verifyAttestationHash(
  provided: string,
  payload: {
    agentId: string;
    recipient: string;
    amount: string;
    asset: string;
  },
): boolean {
  const expected = computeAttestationHash(payload);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

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
  private validateSourceProvenance(
    metadata: Record<string, unknown> | undefined,
    res: Response,
  ): boolean {
    if (!metadata?.sourceProvenance) return true;
    const provenance = sourceProvenanceSchema.safeParse(metadata.sourceProvenance);
    if (provenance.success) return true;
    res.status(400).json({
      success: false,
      error: 'Invalid source provenance',
      details: provenance.error.format(),
    });
    return false;
  }

  /**
   * Operator-only authorization minting. There is intentionally no agent tool
   * for this route: the token expresses the user's payment authority, not a
   * model-generated approval.
   */
  async createSourceAuthorization(req: Request, res: Response) {
    const operatorId = (req as Request & { userId?: string }).userId;
    if (!operatorId) {
      res.status(401).json({
        success: false,
        error: 'Operator authentication is required to authorize a source-aware spend.',
      });
      return;
    }
    const parse = sourceAuthorizationRequestSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid source-aware spend authorization payload',
        details: parse.error.format(),
      });
      return;
    }
    try {
      const authorization = sourceAwareSpendAuthorizationService.issue(parse.data, operatorId);
      res.status(201).json({
        success: true,
        data: authorization,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid source-aware authorization',
      });
    }
  }

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
   * Verify the preview→execute attestation binding and the human
   * confirmation token server-side. Returns metadata to persist on the
   * intent (and thus into the audit run), or null if a 403 was sent.
   * The raw token is never stored — only its verification outcome.
   */
  private verifyBindings(
    payload: z.infer<typeof spendIntentSchema>,
    res: Response,
  ): Record<string, unknown> | null {
    const attestationProvided = Boolean(payload.attestationHash);
    if (payload.attestationHash && !verifyAttestationHash(payload.attestationHash, payload)) {
      logger.warn(
        `Attestation mismatch for agent ${payload.agentId}: execution does not match any preview of this intent`,
      );
      res.status(403).json({
        success: false,
        error:
          'Attestation hash does not match this spend intent. Re-run /api/spend/preview and pass its attestationHash unchanged.',
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    const configuredToken =
      process.env.COGNIVERN_HUMAN_CONFIRM_TOKEN || process.env.SAPIENCE_HUMAN_CONFIRM_TOKEN;
    const token = payload.humanConfirmationToken;
    const tokenVerified = Boolean(
      token &&
        configuredToken &&
        token.length === configuredToken.length &&
        crypto.timingSafeEqual(Buffer.from(token), Buffer.from(configuredToken)),
    );

    return {
      attestation: {
        provided: attestationProvided,
        verified: attestationProvided,
      },
      humanConfirmation: {
        provided: Boolean(token),
        verified: tokenVerified,
      },
    };
  }

  /**
   * Run ChainGPT audit on contract address if available
   * Returns audit result or null if not applicable
   */
  private async auditContract(recipient: string): Promise<{
    decision: 'approve' | 'hold' | 'deny';
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
    auditResult: { decision: 'approve' | 'hold' | 'deny' },
    currentStatus: 'approved' | 'held' | 'denied',
  ): { status: 'approved' | 'held' | 'denied'; override: boolean } {
    if (auditResult.decision === 'deny' && currentStatus === 'approved') {
      return { status: 'denied', override: true };
    }
    if (auditResult.decision === 'hold' && currentStatus === 'approved') {
      return { status: 'held', override: true };
    }
    return { status: currentStatus, override: false };
  }

  private validateMandateReference(
    req: Request,
    metadata: Record<string, unknown> | undefined,
    res: Response,
  ): boolean {
    const mandateId = typeof metadata?.mandateId === 'string' ? metadata.mandateId.trim() : undefined;
    if (!mandateId) return true;
    if (!req.workspaceId || !FundedMandateService.get(req.workspaceId, mandateId)) {
      res.status(404).json({ success: false, error: 'Mandate not found in the current workspace' });
      return false;
    }
    return true;
  }

  private async executeIntent(
    req: Request,
    res: Response,
    intent: SpendIntent,
    context: SpendExecutionContext = {},
  ) {
    if (!this.validateMandateReference(req, intent.metadata, res)) return;
    const owsScopedAccess = req.headers['x-ows-scoped-access'] as string | undefined;
    logger.debug('OWS scoped access received', {
      prefix: owsScopedAccess?.substring(0, 10),
    });
    const walletId =
      typeof intent.metadata?.walletId === 'string' ? intent.metadata.walletId : undefined;

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
          summary: auditService?.getAuditSummary(auditResult.audit) || '',
          findings: auditResult.audit.findings.slice(0, 5),
        };

        // Block execution if audit denies
        if (auditResult.decision === 'deny') {
          logger.warn(`Spend blocked by ChainGPT audit: ${intent.recipient}`);
          res.status(403).json({
            success: false,
            error: 'Spend blocked by security audit',
            data: {
              intentId: intent.id,
              status: 'denied',
              contractAudit,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }
    } catch (auditError) {
      const auditErr = auditError instanceof Error ? auditError : new Error(String(auditError));
      logger.warn('ChainGPT audit failed, continuing with spend:', auditErr);
      // The spend proceeds, but the run must show the audit never happened —
      // otherwise the absence of findings reads as a clean audit.
      contractAudit = {
        address: intent.recipient,
        decision: 'unavailable',
        error: `audit skipped: ${auditErr.message.slice(0, 120)}`,
      };
      intent.metadata = {
        ...(intent.metadata || {}),
        contractAuditSkipped: true,
      };
    }

    const result = await owsWalletService.executeSpend(intent, {
      apiKeyToken: owsScopedAccess,
      walletId,
      workspaceId: req.workspaceId,
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
          error: 'Invalid spend intent payload',
          details: parse.error.format(),
        });
        return;
      }
      if (!this.validateSourceProvenance(parse.data.metadata, res)) return;
      if (!this.validateMandateReference(req, parse.data.metadata, res)) return;

      const bindings = this.verifyBindings(parse.data, res);
      if (!bindings) return;

      const intent = this.buildIntent(parse.data);
      intent.metadata = { ...(intent.metadata || {}), ...bindings };
      await this.executeIntent(req, res, intent, {
        sourceAuthorizationToken: parse.data.sourceAuthorization,
      });
    } catch (error) {
      logger.error('Spend execution failed', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown spend execution error',
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
      if (demoParse.success && demoParse.data.policyId && demoParse.data.amountUsd !== undefined) {
        return await this.handleDemoConfidentialSpend(req, res, demoParse.data);
      }

      // Fall back to OWS encrypted spend format
      const parse = encryptedSpendIntentSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid encrypted spend payload',
          details: parse.error.format(),
        });
        return;
      }
      if (!this.validateSourceProvenance(parse.data.metadata, res)) return;
      if (!this.validateMandateReference(req, parse.data.metadata, res)) return;

      const bindings = this.verifyBindings(parse.data, res);
      if (!bindings) return;

      const metadata: Record<string, any> = {
        ...(parse.data.metadata || {}),
        ...bindings,
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
        sourceAuthorizationToken: parse.data.sourceAuthorization,
      });
    } catch (error) {
      logger.error('Encrypted spend execution failed', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown encrypted spend execution error',
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
      payload.vendorHash || '0x' + crypto.createHash('sha256').update('acme-corp').digest('hex');

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
        approve: 'approve',
        hold: 'hold',
        deny: 'deny',
      };

      res.json({
        success: true,
        data: {
          decisionId: decision.decisionId,
          outcome: outcomeMap[decision.outcome] || decision.outcome,
          fabricated: decision.fabricated === true || undefined,
          note: decision.fabricated
            ? 'CoFHE unavailable — locally synthesized deny, no ciphertext evaluation'
            : amountUsd <= 500
              ? 'FHE.lte(newSpent, dailyLimit) evaluated in ciphertext'
              : 'Amount > approvalThreshold — sealed for human review',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.warn(`Demo confidential spend failed: ${error.message}`);
      // The FHE evaluation failed — do NOT fabricate a decisionId and report
      // success. A fabricated decision is exactly the kind of self-reported
      // claim this system exists to prevent.
      res.status(502).json({
        success: false,
        error: `FHE evaluation unavailable: ${error.message.slice(0, 120)}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Confirm or reject a held spend decision.
   *
   * Held spends are CRE runs; the canonical operator-approval path is
   * POST /api/cre/runs/:runId/approval, which authenticates the operator,
   * broadcasts the held transfer, and finalizes the run. This endpoint
   * previously echoed success without doing any of that — a fabricated
   * approval. It now refuses honestly instead of pretending.
   */
  async confirmDecision(req: Request, res: Response) {
    const { decisionId } = req.params;
    res.status(501).json({
      success: false,
      error:
        'Not implemented here. Held spends are approved via the CRE run approval endpoint, which broadcasts the held transfer and records the operator identity.',
      canonicalEndpoint: `/api/cre/runs/${decisionId}/approval`,
      timestamp: new Date().toISOString(),
    });
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

      if (!address || typeof address !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Missing required parameter: address',
        });
        return;
      }

      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format',
        });
        return;
      }

      const auditService = getChainGPTAuditService();
      if (!auditService) {
        res.status(503).json({
          success: false,
          error: 'Audit service unavailable',
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
      logger.error('Contract scan failed', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Contract scan failed',
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
          error: 'Invalid spend intent payload',
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

      if (!this.validateSourceProvenance(parse.data.metadata, res)) return;
      if (!this.validateMandateReference(req, parse.data.metadata, res)) return;

      // Run policy preview
      const preview = await owsWalletService.previewSpend(intent, {
        sourceAuthorizationToken: parse.data.sourceAuthorization,
      });

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
            summary: auditService?.getAuditSummary(auditResult.audit) || '',
            findings: auditResult.audit.findings.slice(0, 5),
          };

          // Override policy decision if audit finds issues
          const override = this.applyAuditDecision(auditResult, preview.status);
          if (override.override) {
            preview.status = override.status;
            preview.reason = `ChainGPT Audit: ${contractAudit.summary}`;
            preview.simulation.wouldExecute = false;
            preview.simulation.warnings.push(
              `Contract audit ${override.status === 'denied' ? 'failed' : 'requires review'}: ${contractAudit.summary}`,
            );
          }
        }
      } catch (auditError) {
        const auditErr = auditError instanceof Error ? auditError : new Error(String(auditError));
        logger.warn('ChainGPT audit failed, continuing without audit:', auditErr);
        contractAudit = {
          address: parse.data.recipient,
          error: 'Audit service unavailable',
        };
      }

      res.json({
        success: true,
        data: {
          ...preview,
          // Server-minted binding: pass this back unchanged to /api/spend so
          // execution can be verified against this exact intent.
          attestationHash:
            preview.status === 'denied' ? undefined : computeAttestationHash(parse.data),
          contractAudit,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown spend preview error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
