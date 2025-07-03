/**
 * Policy Data Transfer Objects
 *
 * These DTOs are used to pass data between the application layer and other layers.
 * They decouple the domain entities from the presentation layer.
 */

export interface PolicyRuleDTO {
  id: string;
  type: "allow" | "deny" | "require" | "rate_limit";
  condition: string;
  action: PolicyActionDTO;
  metadata: Record<string, any>;
}

export interface PolicyActionDTO {
  type: "block" | "log" | "notify" | "escalate";
  parameters: Record<string, any>;
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
