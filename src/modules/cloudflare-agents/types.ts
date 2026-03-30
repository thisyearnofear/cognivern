/**
 * Type definitions for Cloudflare Agents
 */

export interface GovernanceAgentState {
  agentId: string;
  agentName: string;
  createdAt: string;
  lastActive: string;
  policyVersion: string;
  enforcementMode: "strict" | "advisory" | "disabled";
  thoughtHistory: string[];
  actionLog: GovernanceAction[];
  metrics: AgentMetrics;
  configuration: AgentConfiguration;
  lastBriefingScript?: string;
  lastBriefingAt?: number;
  briefingCount?: number;
}

export interface AgentMetrics {
  totalDecisions: number;
  approvedActions: number;
  rejectedActions: number;
  avgDecisionTimeMs: number;
}

export interface AgentConfiguration {
  maxThoughtHistory: number;
  enableAuditLogging: boolean;
  modelPreference: "auto" | "workers-ai" | "fireworks" | "kilocode" | "openai" | "gemini" | "anthropic";
  enableVoiceBriefing?: boolean;
  userApiKeys?: {
    fireworks?: string;
    kilocode?: string;
    openai?: string;
    gemini?: string;
    anthropic?: string;
  };
}

export interface GovernanceAction {
  id?: string;
  agentId: string;
  actionType: string;
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
  timestamp?: string;
}

export interface PolicyDecision {
  id: string;
  actionId: string;
  agentId: string;
  approved: boolean;
  reasoning: string;
  decisionType: string;
  timestamp: string;
  policyVersion: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRegistry {
  agents: Map<string, AgentInfo>;
  lastUpdated: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  status: "active" | "inactive" | "suspended";
  capabilities: string[];
  policyId: string;
  registeredAt: string;
  lastActive: string;
}

export interface PolicyDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active" | "archived";
}

export interface PolicyRule {
  id: string;
  name: string;
  condition: string;
  action: "allow" | "deny" | "review";
  priority: number;
  metadata?: Record<string, unknown>;
}

export interface AIAnalysisResult {
  score: number;
  threshold: number;
  reasoning: string;
  riskFactors: string[];
  confidence: number;
  model: string;
}

export interface MultiModelConfig {
  providers: {
    workersAI?: {
      enabled: boolean;
      model: string;
    };
    fireworks?: {
      enabled: boolean;
      model: string;
    };
    kilocode?: {
      enabled: boolean;
      model: string;
    };
    openai?: {
      enabled: boolean;
      model: string;
    };
    gemini?: {
      enabled: boolean;
      model: string;
    };
    anthropic?: {
      enabled: boolean;
      model: string;
    };
  };
  fallbackOrder: string[];
  timeoutMs: number;
  // User-provided API keys (override environment variables)
  userApiKeys?: {
    fireworks?: string;
    kilocode?: string;
    openai?: string;
    gemini?: string;
    anthropic?: string;
  };
}

export interface ProviderPreference {
  primary: string;
  fallbacks: string[];
  userApiKeys?: {
    fireworks?: string;
    kilocode?: string;
    openai?: string;
    gemini?: string;
    anthropic?: string;
  };
}
