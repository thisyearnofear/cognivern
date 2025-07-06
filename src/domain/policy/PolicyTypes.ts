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
  parameters?: Record<string, any>;
  duration?: string;
  message?: string;
}

export type PolicyRuleType =
  | "allow"
  | "deny"
  | "require"
  | "rate_limit"
  | "portfolio_risk"
  | "market_condition"
  | "quality_control"
  | "compliance"
  | "dynamic_risk"
  | "time_restriction";

export type PolicyActionType =
  | "block"
  | "log"
  | "notify"
  | "escalate"
  | "throttle"
  | "require_approval"
  | "reduce_exposure"
  | "emergency_stop"
  | "require_human_review"
  | "model_retraining"
  | "flag_for_review"
  | "increase_position_size"
  | "reduce_position_size"
  | "allow";

export type PolicyStatus = "active" | "draft" | "archived";
