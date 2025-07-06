/**
 * Policy domain types
 */

export interface PolicyRule {
  id: string;
  type: PolicyRuleType;
  condition: string;
  action: PolicyAction;
  metadata: Record<string, any>;
}

export interface PolicyAction {
  type: PolicyActionType;
  parameters: Record<string, any>;
}

export type PolicyRuleType = "allow" | "deny" | "require" | "rate_limit";
export type PolicyActionType =
  | "block"
  | "log"
  | "notify"
  | "escalate"
  | "throttle";
export type PolicyStatus = "active" | "draft" | "archived";
