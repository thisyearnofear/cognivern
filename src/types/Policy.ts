export interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  rules: PolicyRule[];
  metadata: Record<string, any>;
}

export interface PolicyRule {
  id: string;
  type: PolicyRuleType;
  condition: string;
  action: PolicyAction;
  metadata: Record<string, any>;
}

export enum PolicyRuleType {
  ALLOW = 'allow',
  DENY = 'deny',
  REQUIRE = 'require',
  RATE_LIMIT = 'rate_limit',
}

export interface PolicyAction {
  type: PolicyActionType;
  parameters: Record<string, any>;
}

export enum PolicyActionType {
  BLOCK = 'block',
  LOG = 'log',
  NOTIFY = 'notify',
  ESCALATE = 'escalate',
}
