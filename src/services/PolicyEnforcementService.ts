import { Policy, PolicyRule, PolicyRuleType } from "../types/Policy.js";
import { AgentAction, PolicyCheck } from "../types/Agent.js";
import { PolicyService } from "./PolicyService.js";
import logger from "../utils/logger.js";

/**
 * @deprecated This service is being migrated to the new clean architecture structure.
 * This will be refactored to use the new domain and application services.
 *
 * This file will be removed once the migration is complete.
 */
export class PolicyEnforcementService {
  private currentPolicy: Policy | null = null;
  private policyService: PolicyService | null = null;
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> =
    new Map();

  constructor(policyService?: PolicyService) {
    this.policyService = policyService || null;
    logger.info("PolicyEnforcementService initialized");
  }

  /**
   * Initialize with PolicyService instance (for dependency injection)
   */
  initialize(policyService: PolicyService): void {
    this.policyService = policyService;
    logger.info("PolicyEnforcementService initialized with PolicyService");
  }

  async loadPolicy(policyId: string): Promise<void> {
    if (!this.policyService) {
      throw new Error(
        "PolicyService not initialized. Call initialize() first."
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
          `Policy ${policyId} is not active (status: ${policy.status})`
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
        `Failed to load policy ${policyId}: ${error instanceof Error ? error.message : "Unknown error"}`
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
          result,
          reason: result ? "Rule passed" : "Rule failed",
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
    if (!this.currentPolicy) {
      throw new Error("No policy loaded");
    }

    const checks = await this.evaluateAction(action);

    // Check if any DENY rules were triggered
    const hasDenyViolation = checks.some(
      (check) =>
        !check.result &&
        this.currentPolicy?.rules.find(
          (r: PolicyRule) => r.id === check.policyId
        )?.type === "deny"
    );

    if (hasDenyViolation) {
      return false;
    }

    // Check if all REQUIRE rules passed
    return this.currentPolicy.rules
      .filter((r: PolicyRule) => r.type === "require")
      .every(
        (r: PolicyRule) => checks.find((c) => c.policyId === r.id)?.result
      );
  }

  private async evaluateRule(
    rule: PolicyRule,
    action: AgentAction
  ): Promise<boolean> {
    switch (rule.type) {
      case "allow":
        return this.evaluateAllowRule(rule, action);
      case "deny":
        return !this.evaluateDenyRule(rule, action);
      case "require":
        return this.evaluateRequireRule(rule, action);
      case "rate_limit":
        return this.evaluateRateLimitRule(rule, action);
      default:
        throw new Error(`Unknown rule type: ${rule.type}`);
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
    action: AgentAction
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
      // Simple condition evaluation - can be enhanced with a proper expression parser
      // For now, support basic conditions like:
      // - action.type === 'analysis'
      // - action.metadata.contains('sensitive')
      // - action.timestamp > '2024-01-01'

      const agentId = action.metadata?.agentId || action.id || "unknown";

      // Replace action properties in condition
      const evaluationCode = condition
        .replace(/action\.type/g, `"${action.type}"`)
        .replace(/action\.agentId/g, `"${agentId}"`)
        .replace(/action\.id/g, `"${action.id}"`)
        .replace(/action\.metadata/g, `${JSON.stringify(action.metadata)}`)
        .replace(/action\.description/g, `"${action.description}"`)
        .replace(/action\.timestamp/g, `"${action.timestamp}"`);

      // Basic safety check - only allow simple comparisons
      if (!/^[a-zA-Z0-9\s"'=!<>().,:\-_{}[\]]+$/.test(evaluationCode)) {
        logger.warn(`Potentially unsafe condition detected: ${condition}`);
        return false;
      }

      // For now, return true for any valid condition (can be enhanced with real evaluation)
      logger.debug(`Evaluating condition: ${condition} -> ${evaluationCode}`);
      return true;
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
}
