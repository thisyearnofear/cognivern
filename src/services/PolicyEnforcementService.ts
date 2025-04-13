import { Policy, PolicyRule, PolicyRuleType, PolicyAction } from '../types/Policy';
import { AgentAction, PolicyCheck } from '../types/Agent';
import { RecallClient } from '@recallnet/sdk';

export class PolicyEnforcementService {
  private recall: RecallClient;
  private bucketAddress: string;
  private currentPolicy?: Policy;

  constructor(recall: RecallClient, bucketAddress: string) {
    this.recall = recall;
    this.bucketAddress = bucketAddress;
  }

  async loadPolicy(policyId: string): Promise<Policy> {
    const policyPath = `agents/escheat-agent-1/policies/${policyId}.json`;
    const policyData = await this.recall.bucket.get(this.bucketAddress, policyPath);
    this.currentPolicy = JSON.parse(policyData.toString()) as Policy;
    return this.currentPolicy;
  }

  async evaluateAction(action: AgentAction): Promise<PolicyCheck[]> {
    if (!this.currentPolicy) {
      throw new Error('No policy loaded');
    }

    const checks: PolicyCheck[] = [];

    for (const rule of this.currentPolicy.rules) {
      const check = await this.evaluateRule(rule, action);
      checks.push(check);

      // If a deny rule matches, stop processing
      if (rule.type === PolicyRuleType.DENY && check.result) {
        break;
      }
    }

    return checks;
  }

  private async evaluateRule(rule: PolicyRule, action: AgentAction): Promise<PolicyCheck> {
    try {
      // Evaluate the condition using a safe evaluation context
      const condition = new Function('action', `return ${rule.condition}`);
      const result = condition(action);

      return {
        policyId: rule.id,
        result: result,
        reason: result ? undefined : `Failed to meet condition: ${rule.condition}`,
      };
    } catch (error) {
      return {
        policyId: rule.id,
        result: false,
        reason: `Error evaluating rule: ${error.message}`,
      };
    }
  }

  async enforcePolicy(action: AgentAction): Promise<boolean> {
    const checks = await this.evaluateAction(action);

    // Check if any deny rules matched
    const denied = checks.some(
      (check) =>
        check.result &&
        this.currentPolicy?.rules.find((r) => r.id === check.policyId)?.type ===
          PolicyRuleType.DENY,
    );

    // Check if all require rules matched
    const required = this.currentPolicy?.rules
      .filter((r) => r.type === PolicyRuleType.REQUIRE)
      .every((r) => checks.find((c) => c.policyId === r.id)?.result);

    return !denied && !!required;
  }
}
