import { Policy, PolicyRule } from '../types/Policy.js';
import { AgentAction, PolicyCheck } from '../types/Agent.js';
import { RecallClient } from '@recallnet/sdk/client';
import type { Address } from 'viem';
import type { ObjectValue } from '@recallnet/sdk/bucket';

export class PolicyEnforcementService {
  private currentPolicy: Policy | null = null;
  private recall: RecallClient;
  private bucketAddress: Address;

  constructor(recall: RecallClient, bucketAddress: Address) {
    this.recall = recall;
    this.bucketAddress = bucketAddress;
  }

  async loadPolicy(policyId: string): Promise<void> {
    try {
      // Load policy from Recall bucket
      const bucketManager = this.recall.bucketManager();
      const { result } = await bucketManager.get(this.bucketAddress, `policies/${policyId}`);

      if (!result) {
        throw new Error(`Policy ${policyId} not found`);
      }

      let policyText: string;

      // Handle different types of results
      if (
        typeof result === 'object' &&
        result !== null &&
        ('buffer' in result || Object.prototype.toString.call(result) === '[object Uint8Array]')
      ) {
        policyText = new TextDecoder().decode(result as Uint8Array);
      } else if (typeof result === 'string') {
        policyText = result;
      } else {
        // Try to convert to string if it's a different type
        try {
          policyText = JSON.stringify(result);
        } catch (stringifyError) {
          throw new Error(`Failed to stringify policy data: ${stringifyError}`);
        }
      }

      try {
        this.currentPolicy = JSON.parse(policyText) as Policy;
      } catch (parseError) {
        throw new Error(`Failed to parse policy JSON: ${parseError}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to load policy ${policyId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async evaluateAction(action: AgentAction): Promise<PolicyCheck[]> {
    if (!this.currentPolicy) {
      throw new Error('No policy loaded');
    }

    const checks: PolicyCheck[] = [];
    for (const rule of this.currentPolicy.rules) {
      try {
        const result = await this.evaluateRule(rule, action);
        checks.push({
          policyId: rule.id,
          result,
          reason: result ? 'Rule passed' : 'Rule failed',
        });
      } catch (error) {
        checks.push({
          policyId: rule.id,
          result: false,
          reason: `Error evaluating rule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
    return checks;
  }

  async enforcePolicy(action: AgentAction): Promise<boolean> {
    if (!this.currentPolicy) {
      throw new Error('No policy loaded');
    }

    const checks = await this.evaluateAction(action);

    // Check if any DENY rules were triggered
    const hasDenyViolation = checks.some(
      (check) =>
        !check.result &&
        this.currentPolicy?.rules.find((r: PolicyRule) => r.id === check.policyId)?.type === 'deny',
    );

    if (hasDenyViolation) {
      return false;
    }

    // Check if all REQUIRE rules passed
    return this.currentPolicy.rules
      .filter((r: PolicyRule) => r.type === 'require')
      .every((r: PolicyRule) => checks.find((c) => c.policyId === r.id)?.result);
  }

  private async evaluateRule(rule: PolicyRule, action: AgentAction): Promise<boolean> {
    switch (rule.type) {
      case 'require':
        return this.evaluateRequireRule(rule, action);
      case 'deny':
        return !this.evaluateDenyRule(rule, action);
      default:
        throw new Error(`Unknown rule type: ${rule.type}`);
    }
  }

  private evaluateRequireRule(rule: PolicyRule, action: AgentAction): boolean {
    // Implement require rule evaluation logic
    return true;
  }

  private evaluateDenyRule(rule: PolicyRule, action: AgentAction): boolean {
    // Implement deny rule evaluation logic
    return false;
  }
}
