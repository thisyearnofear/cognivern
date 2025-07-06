/**
 * Policy Data Transfer Objects
 *
 * These DTOs are used to pass data between the application layer and other layers.
 * They decouple the domain entities from the presentation layer.
 */

export interface PolicyRuleDTO {
  id: string;
  type:
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
  condition: string;
  action: PolicyActionDTO;
  metadata: Record<string, any>;
}

export interface PolicyActionDTO {
  type:
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
  parameters?: Record<string, any>;
  duration?: string;
  message?: string;
}

export interface PolicyDTO {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRuleDTO[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  status: "active" | "draft" | "archived";
}

export interface CreatePolicyDTO {
  name: string;
  description: string;
  rules: PolicyRuleDTO[];
  metadata?: Record<string, any>;
}

export interface UpdatePolicyDTO {
  name?: string;
  description?: string;
  rules?: PolicyRuleDTO[];
  metadata?: Record<string, any>;
  status?: "active" | "draft" | "archived";
}
