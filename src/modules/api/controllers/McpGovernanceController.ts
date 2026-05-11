/**
 * MCP Governance-Check Controller
 *
 * Exposes POST /api/mcp/governance-check — an MCP-compliant tool endpoint that
 * wraps Cognivern's policy evaluation + audit trail, making it discoverable and
 * invokable in the Prompt Opinion Marketplace.
 *
 * Agents Assemble Healthcare AI Endgame — MCP tool integration requirement.
 */

import { Request, Response } from "express";
import { Logger } from "../../../shared/logging/Logger.js";
import { PolicyService, sharedPolicyService } from "../../../services/PolicyService.js";
import { PolicyEnforcementService } from "../../../services/PolicyEnforcementService.js";
import { AuditLogService } from "../../../services/AuditLogService.js";
import { evaluatePolicyWithTogetherAI } from "../../../services/TogetherAIPolicyEvaluator.js";
import type { AgentAction, PolicyCheck } from "../../../types/Agent.js";
import type { SharpContext } from "../../../types/Policy.js";
import crypto from "node:crypto";

const logger = new Logger("McpGovernanceController");

/** MCP tool manifest — returned by GET /api/mcp/governance-check */
const MCP_TOOL_MANIFEST = {
  schema_version: "v1",
  name: "governance-check",
  display_name: "Cognivern Governance Check",
  description:
    "Policy-checked, HIPAA-aware governance evaluation for autonomous healthcare AI agents. " +
    "Accepts an agent action and optional FHIR R4 / SHARP clinical context, evaluates it " +
    "against the active policy using Together AI, records an immutable audit log, and returns " +
    "an allow/deny decision with full reasoning.",
  categories: ["healthcare", "governance", "compliance", "audit"],
  input_schema: {
    type: "object",
    required: ["agentId", "action"],
    properties: {
      agentId: { type: "string", description: "Cognivern agent identifier" },
      action: {
        type: "object",
        description: "AgentAction payload",
        properties: {
          type: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string" },
          metadata: { type: "object" },
        },
        required: ["type", "description"],
      },
      fhirContext: {
        type: "object",
        description: "Optional FHIR R4 / SHARP clinical context block",
        properties: {
          subject: {
            type: "object",
            properties: {
              resourceType: { type: "string" },
              id: { type: "string" },
              display: { type: "string" },
            },
            required: ["resourceType", "id"],
          },
          encounter: { type: "object" },
          requester: { type: "object" },
          eventTime: { type: "string", format: "date-time" },
          sensitivityLabels: { type: "array", items: { type: "string" } },
          consentRef: { type: "string" },
        },
        required: ["subject"],
      },
      policyId: { type: "string", description: "Override policy ID (optional)" },
      a2aTraceId: {
        type: "string",
        description: "A2A call-chain trace ID for multi-agent correlation",
      },
    },
  },
  output_schema: {
    type: "object",
    properties: {
      tool: { type: "string" },
      callId: { type: "string" },
      allowed: { type: "boolean" },
      reasoning: { type: "string" },
      policyChecks: { type: "array" },
      auditLogId: { type: "string" },
      provider: { type: "string" },
      model: { type: "string" },
      a2aTraceId: { type: "string" },
      timestamp: { type: "string" },
    },
  },
};

export class McpGovernanceController {
  private policyService: PolicyService;
  private policyEnforcementService: PolicyEnforcementService;
  private auditLogService: AuditLogService;

  constructor(
    policyService?: PolicyService,
    auditLogService?: AuditLogService,
    policyEnforcementService?: PolicyEnforcementService,
  ) {
    this.policyService = policyService || sharedPolicyService;
    this.auditLogService = auditLogService || new AuditLogService();
    this.policyEnforcementService =
      policyEnforcementService || new PolicyEnforcementService(this.policyService);
  }

  /** GET /api/mcp/governance-check — return MCP tool manifest */
  async getManifest(_req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: MCP_TOOL_MANIFEST, timestamp: new Date().toISOString() });
  }

  /** POST /api/mcp/governance-check — evaluate governance and return MCP tool result */
  async governanceCheck(req: Request, res: Response): Promise<void> {
    const callId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    try {
      const { agentId, action, fhirContext, policyId, a2aTraceId } = req.body as {
        agentId?: string;
        action?: Partial<AgentAction>;
        fhirContext?: SharpContext;
        policyId?: string;
        a2aTraceId?: string;
      };

      if (!agentId || !action) {
        res.status(400).json({
          success: false,
          error: { code: "BAD_REQUEST", message: "Missing required fields: agentId, action" },
          timestamp,
        });
        return;
      }

      // Resolve active policy
      let resolvedPolicyId = policyId;
      if (!resolvedPolicyId) {
        const policies = await this.policyService.getPolicies();
        const active = policies.find((p: { status: string }) => p.status === "active");
        resolvedPolicyId = active?.id;
      }

      if (!resolvedPolicyId) {
        res.status(503).json({
          success: false,
          error: { code: "NO_ACTIVE_POLICY", message: "No active governance policy available" },
          timestamp,
        });
        return;
      }

      const policy = await this.policyService.getPolicy(resolvedPolicyId);
      if (!policy) {
        res.status(404).json({
          success: false,
          error: { code: "POLICY_NOT_FOUND", message: `Policy ${resolvedPolicyId} not found` },
          timestamp,
        });
        return;
      }

      const normalizedAction: AgentAction = {
        id: crypto.randomUUID(),
        timestamp,
        type: action.type ?? "unknown",
        description: action.description ?? "",
        metadata: {
          ...(action.metadata ?? {}),
          agentId,
          amount: action.amount ?? 0,
          currency: action.currency ?? "USD",
          a2aTraceId,
          mcpCallId: callId,
        },
        policyChecks: [],
      };

      // Prefer Together AI evaluator; fall back to enforcement service
      const useTogetherAI =
        !!process.env.TOGETHER_API_KEY || process.env.TOGETHER_AI_ENABLED === "true";

      let allowed: boolean;
      let reasoning: string;
      let policyChecks: PolicyCheck[];
      let provider: string;
      let model: string;

      if (useTogetherAI) {
        const result = await evaluatePolicyWithTogetherAI({
          action: normalizedAction,
          policy,
          fhirContext,
        });
        allowed = result.allowed;
        reasoning = result.reasoning;
        policyChecks = result.policyChecks;
        provider = result.provider;
        model = result.model;
      } else {
        await this.policyEnforcementService.loadPolicy(resolvedPolicyId);
        const decision = await this.policyEnforcementService.evaluateDecision(normalizedAction);
        allowed = decision.allowed;
        reasoning = "";
        policyChecks = decision.policyChecks;
        provider = "local";
        model = "rule-engine";
      }

      // Record audit log
      let auditLogId: string | undefined;
      try {
        const auditLog = await this.auditLogService.logAction(
          normalizedAction,
          policyChecks,
          allowed,
        );
        auditLogId = auditLog?.id;
      } catch (auditErr) {
        logger.warn("Audit log write failed (non-fatal)", {
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }

      logger.info("MCP governance-check complete", { callId, agentId, allowed, provider });

      res.json({
        success: true,
        data: {
          tool: "governance-check",
          callId,
          allowed,
          reasoning,
          policyChecks,
          auditLogId,
          provider,
          model,
          a2aTraceId: a2aTraceId ?? null,
          timestamp,
        },
        timestamp,
      });
    } catch (error) {
      logger.error("MCP governance-check error", {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp,
      });
    }
  }
}
