export interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived';
}

export interface PolicyRule {
  id: string;
  type: 'allow' | 'deny' | 'require' | 'rate_limit';
  condition: string;
  action: PolicyAction;
  metadata: Record<string, any>;
}

export interface PolicyAction {
  type: 'block' | 'log' | 'notify' | 'escalate';
  parameters: Record<string, any>;
}

export type PolicyRuleType = 'allow' | 'deny' | 'require' | 'rate_limit';
export type PolicyActionType = 'block' | 'log' | 'notify' | 'escalate';
