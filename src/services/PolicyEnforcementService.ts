import { Policy, PolicyRule, PolicyRuleType } from "../types/Policy.js";
import { AgentAction, PolicyCheck } from "../types/Agent.js";
import { PolicyService } from "./PolicyService.js";
import { FhenixPolicyService } from "./FhenixPolicyService.js";
import { ChainGPTAuditService } from "./ChainGPTAuditService.js";
import logger from "../utils/logger.js";
import { Script } from "node:vm";

/**
 * @deprecated This service is being migrated to the new clean architecture structure.
 * This will be refactored to use the new domain and application services.
 *
 * This file will be removed once the migration is complete.
 */
export class PolicyEnforcementService {
  private currentPolicy: Policy | null = null;
  private policyService: PolicyService | null = null;
  private fhenixPolicyService: FhenixPolicyService | null = null;
  private chainGPTAuditService: ChainGPTAuditService | null = null;
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> =
    new Map();

  constructor(policyService?: PolicyService, fhenixPolicyService?: FhenixPolicyService, chainGPTAuditService?: ChainGPTAuditService) {
    this.policyService = policyService || null;
    this.fhenixPolicyService = fhenixPolicyService || null;
    this.chainGPTAuditService = chainGPTAuditService || null;
    logger.info("PolicyEnforcementService initialized");
  }

  /**
   * Initialize with PolicyService instance (for dependency injection)
   */
  initialize(policyService: PolicyService, fhenixPolicyService?: FhenixPolicyService, chainGPTAuditService?: ChainGPTAuditService): void {
    this.policyService = policyService;
    if (fhenixPolicyService) {
      this.fhenixPolicyService = fhenixPolicyService;
    }
    if (chainGPTAuditService) {
      this.chainGPTAuditService = chainGPTAuditService;
    }
    logger.info("PolicyEnforcementService initialized with PolicyService");
  }

  async loadPolicy(policyId: string): Promise<void> {
    if (!this.policyService) {
      throw new Error(
        "PolicyService not initialized. Call initialize() first.",
      );
    }

    try {
      // Load policy from Recall storage via PolicyService
      const policy = await this.policyService.getPolicy(policyId);

      if (!policy) {
        throw new Error(`Policy ${policyId} not found`);
      }

      // Only load active policies for enforcement
      if (policy.status !== "active") {
        throw new Error(
          `Policy ${policyId} is not active (status: ${policy.status})`,
        );
      }

      this.currentPolicy = policy;
      logger.info(`Policy loaded successfully: ${policyId}`, {
        policyName: policy.name,
        rulesCount: policy.rules.length,
        version: policy.version,
      });
    } catch (error) {
      logger.error(`Failed to load policy ${policyId}`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error(
        `Failed to load policy ${policyId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async evaluateAction(action: AgentAction): Promise<PolicyCheck[]> {
    if (!this.currentPolicy) {
      throw new Error("No policy loaded");
    }

    const checks: PolicyCheck[] = [];
    for (const rule of this.currentPolicy.rules) {
      try {
        const result = await this.evaluateRule(rule, action);
        checks.push({
          policyId: rule.id,
          result: result.allowed,
          reason: result.reason || (result.allowed ? "Rule passed" : "Rule failed"),
          metadata: result.metadata,
        });
      } catch (error) {
        checks.push({
          policyId: rule.id,
          result: false,
          reason: `Error evaluating rule: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }
    return checks;
  }

  async enforcePolicy(action: AgentAction): Promise<boolean> {
    const decision = await this.evaluateDecision(action);
    return decision.allowed;
  }

  async evaluateDecision(
    action: AgentAction,
  ): Promise<{ allowed: boolean; policyChecks: PolicyCheck[] }> {
    if (!this.currentPolicy) {
      throw new Error("No policy loaded");
    }

    const checks = await this.evaluateAction(action);

    // Check if any DENY rules were triggered
    const hasDenyViolation = checks.some(
      (check) =>
        !check.result &&
        this.currentPolicy?.rules.find(
          (r: PolicyRule) => r.id === check.policyId,
        )?.type === "deny",
    );

    if (hasDenyViolation) {
      return { allowed: false, policyChecks: checks };
    }

    // Check if all REQUIRE rules passed
    const allRequireRulesPassed = this.currentPolicy.rules
      .filter(
        (r: PolicyRule) => this.normalizeRuleType(r.type) === "require",
      )
      .every(
        (r: PolicyRule) => checks.find((c) => c.policyId === r.id)?.result,
      );

    return { allowed: allRequireRulesPassed, policyChecks: checks };
  }

  private async evaluateRule(
    rule: PolicyRule,
    action: AgentAction,
  ): Promise<{ allowed: boolean; reason?: string; metadata?: any }> {
    // If rule is confidential, delegate to FhenixPolicyService
    if (rule.metadata?.confidential && this.fhenixPolicyService) {
      logger.info(`Evaluating confidential rule via Fhenix: ${rule.id}`);
      const decision = await this.fhenixPolicyService.evaluateEncrypted({
        agentId: action.metadata?.agentId || action.id || "unknown",
        policyId: rule.id,
        amountWei: BigInt(action.metadata?.amountWei || 0),
        vendorHash: action.metadata?.vendorHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
      });
      return {
        allowed: decision.outcome === "approve",
        reason: `Fhenix Evaluation: ${decision.outcome}`,
        metadata: {
          decisionId: decision.decisionId,
          attestation: decision.attestation,
          confidential: true,
        },
      };
    }

    switch (this.normalizeRuleType(rule.type)) {
      case "allow":
        return { allowed: this.evaluateAllowRule(rule, action) };
      case "deny":
        return { allowed: !this.evaluateDenyRule(rule, action) };
      case "require":
        return { allowed: this.evaluateRequireRule(rule, action) };
      case "rate_limit":
        return { allowed: this.evaluateRateLimitRule(rule, action) };
      case "contract_audit":
        return await this.evaluateContractAuditRule(rule, action);
      default:
        throw new Error(`Unknown rule type: ${rule.type}`);
    }
  }

  /**
   * Evaluate a contract audit rule using ChainGPT's Smart Contract Auditor.
   * This is a runtime defense mechanism that blocks/holds spend if critical/high
   * vulnerabilities are found in the target contract.
   */
  private async evaluateContractAuditRule(
    rule: PolicyRule,
    action: AgentAction,
  ): Promise<{ allowed: boolean; reason?: string; metadata?: any }> {
    if (!this.chainGPTAuditService) {
      logger.warn("ChainGPT Audit service not configured - skipping contract audit");
      return { allowed: true, reason: "Contract audit skipped (service not configured)" };
    }

    // Extract target contract address from the action
    const targetContract = action.metadata?.targetContract as string || undefined;

    if (!targetContract) {
      logger.debug("No target contract found in action - skipping audit");
      return { allowed: true, reason: "No contract target to audit" };
    }

    try {
      logger.info(`Running contract audit for ${targetContract}`, {
        ruleId: rule.id,
        agentId: action.metadata?.agentId || action.id || "unknown",
      });

      const auditResponse = await this.chainGPTAuditService.auditContract(targetContract);
      const { decision, audit } = auditResponse;

      const metadata = {
        auditScore: audit.score,
        severity: audit.severity,
        findings: audit.findings,
        auditedAt: audit.auditedAt,
        chaingptAudit: true, // Mark as ChainGPT-powered
      };

      switch (decision) {
        case "deny":
          return {
            allowed: false,
            reason: `Contract audit DENIED: ${audit.summary}. Score: ${audit.score}/100`,
            metadata,
          };
        case "hold":
          return {
            allowed: false,
            reason: `Contract audit HOLD: ${audit.summary}. Requires operator review. Score: ${audit.score}/100`,
            metadata: {
              ...metadata,
              requiresReview: true,
              reviewReason: "contract_audit_flagged",
            },
          };
        default: // "approve"
          return {
            allowed: true,
            reason: `Contract audit PASSED: ${audit.summary}. Score: ${audit.score}/100`,
            metadata,
          };
      }
    } catch (error) {
      logger.error("Contract audit evaluation failed", {
        ruleId: rule.id,
        contract: targetContract,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // On error, default to hold for safety
      return {
        allowed: false,
        reason: `Contract audit failed: ${error instanceof Error ? error.message : "Unknown error"}. Defaulting to hold for safety.`,
        metadata: {
          error: true,
          originalError: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  private evaluateAllowRule(rule: PolicyRule, action: AgentAction): boolean {
    // Check if the action matches the allow condition
    return this.evaluateCondition(rule.condition, action);
  }

  private evaluateDenyRule(rule: PolicyRule, action: AgentAction): boolean {
    // Check if the action matches the deny condition (returns true if should be denied)
    return this.evaluateCondition(rule.condition, action);
  }

  private evaluateRequireRule(rule: PolicyRule, action: AgentAction): boolean {
    // Check if the action satisfies the required condition
    return this.evaluateCondition(rule.condition, action);
  }

  private evaluateRateLimitRule(
    rule: PolicyRule,
    action: AgentAction,
  ): boolean {
    // Use action.id as fallback for agentId since agentId doesn't exist on AgentAction
    const agentId = action.metadata?.agentId || action.id || "unknown";
    const key = `${agentId}:${action.type}:${rule.id}`;
    const now = Date.now();
    const windowMs = rule.metadata?.windowMs || 60000; // Default 1 minute
    const maxRequests = rule.metadata?.maxRequests || 10; // Default 10 requests

    // Get or create counter
    let counter = this.rateLimitCounters.get(key);
    if (!counter || now > counter.resetTime) {
      counter = { count: 0, resetTime: now + windowMs };
      this.rateLimitCounters.set(key, counter);
    }

    // Check if limit exceeded
    if (counter.count >= maxRequests) {
      logger.warn(`Rate limit exceeded for ${key}`, {
        count: counter.count,
        maxRequests,
        windowMs,
        resetTime: new Date(counter.resetTime).toISOString(),
      });
      return false;
    }

    // Increment counter
    counter.count++;
    return true;
  }

  private evaluateCondition(condition: string, action: AgentAction): boolean {
    try {
      const trimmed = condition.trim();
      if (!trimmed) {
        return false;
      }

      if (!this.isSafeConditionExpression(trimmed)) {
        logger.warn(`Potentially unsafe condition detected: ${condition}`);
        return false;
      }

      const actionContext = {
        ...action,
        agentId: action.metadata?.agentId || action.id || "unknown",
      };
      const referenceDate = new Date(action.timestamp || Date.now());
      const SafeDate = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(referenceDate);
            return;
          }
          super(args[0]);
        }

        static now() {
          return referenceDate.getTime();
        }
      };

      const script = new Script(`Boolean(${trimmed})`);
      const result = script.runInNewContext(
        {
          action: actionContext,
          Date: SafeDate,
          Math,
        },
        { timeout: 50 },
      );

      logger.debug(`Evaluating condition: ${condition}`);
      return Boolean(result);
    } catch (error) {
      logger.error(`Error evaluating condition: ${condition}`, {
        error: error instanceof Error ? error.message : "Unknown error",
        action: action.type,
      });
      return false;
    }
  }

  /**
   * Get the currently loaded policy
   */
  getCurrentPolicy(): Policy | null {
    return this.currentPolicy;
  }

  /**
   * Clear rate limit counters (useful for testing)
   */
  clearRateLimitCounters(): void {
    this.rateLimitCounters.clear();
    logger.info("Rate limit counters cleared");
  }

  private normalizeRuleType(ruleType: string): PolicyRuleType {
    return ruleType.toLowerCase() as PolicyRuleType;
  }

  private isSafeConditionExpression(condition: string): boolean {
    const forbiddenPatterns = [
      /(^|[^\w$])(?:process|global|globalThis|require|import|module|exports)([^\w$]|$)/,
      /(^|[^\w$])(?:Function|eval|constructor|prototype|__proto__)([^\w$]|$)/,
      /(^|[^\w$])(?:while|for|do|switch|try|catch|throw|class|async|await)([^\w$]|$)/,
      /=>/,
      /;/,
    ];

    return !forbiddenPatterns.some((pattern) => pattern.test(condition));
  }
}
