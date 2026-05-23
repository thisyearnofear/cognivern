// Shared type definitions for Cognivern frontend and backend

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface AuditLog {
  id: string;
  agentId: string;
  action: string;
  description: string;
  decision: 'approved' | 'denied' | 'held';
  chain: string;
  timestamp: string;
  latency?: string;
  policyChecks?: PolicyCheck[];
}

export interface PolicyCheck {
  policyId: string;
  result: boolean;
  reason: string;
}

export interface Run {
  id: string;
  workflow: string;
  status: 'completed' | 'running' | 'failed' | 'paused_for_approval';
  mode: string;
  steps: number;
  duration: string;
  artifacts: number;
  timestamp: string;
  events?: RunEvent[];
}

export interface RunEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface Policy {
  id: string;
  name: string;
  type: string;
  description: string;
  status: 'active' | 'draft' | 'inactive';
  agents: number;
  violations: number;
  rules?: PolicyRule[];
}

export interface PolicyRule {
  id?: string;
  condition: string;
  action: 'allow' | 'deny' | 'flag';
  params?: Record<string, unknown>;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'paused' | 'inactive';
  trades: number;
  budget: string;
  chain: string;
  spendHistory?: SpendEntry[];
}

export interface SpendEntry {
  amount: number;
  currency: string;
  timestamp: string;
  decision: string;
}

export interface GovernanceEvaluation {
  allowed: boolean;
  reasoning: string;
  policyChecks: PolicyCheck[];
  auditLogId?: string;
  provider?: string;
  model?: string;
  timestamp: string;
}

export interface IntentMetrics {
  totalIntents: number;
  successRate: number;
  averageLatency: number;
  topActions: ActionCount[];
}

export interface ActionCount {
  action: string;
  count: number;
}

export interface AuditInsights {
  compliance: number;
  trends: Record<string, unknown>[];
}

// Spend request types
export interface SpendRequest {
  agentId: string;
  amount: number;
  currency: string;
  description: string;
}

export interface SpendPreviewRequest extends SpendRequest {}

export interface EncryptedSpendRequest {
  agentId: string;
  encryptedPayload: string;
  signature: string;
}

// Governance evaluation request
export interface GovernanceEvaluateRequest {
  agentId: string;
  action: {
    type: string;
    description: string;
    amount: number;
    currency: string;
  };
  policyId?: string;
}

// OWS types
export interface OwsWallet {
  id: string;
  name: string;
  chain: string;
  address: string;
  createdAt: string;
}

export interface OwsApiKey {
  id: string;
  walletId: string;
  key: string;
  scopes: string[];
  createdAt: string;
}

export interface BootstrapWalletRequest {
  name: string;
  chain: string;
}

export interface CreateApiKeyRequest {
  walletId: string;
  scopes: string[];
}