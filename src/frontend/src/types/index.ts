// Unified type definitions to eliminate duplication across components

// ===== AGENT TYPES =====
export type AgentType = "recall" | "vincent" | "trading" | "analysis" | "monitoring" | "sapience" | "filecoin";

export interface BaseAgent {
  id: string;
  name: string;
  type: AgentType;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentMetrics {
  responseTime: number;
  successRate: number;
  errorRate: number;
  totalRequests: number;
  lastActive: string;
  uptime: number;
  actionsToday: number;
}

export interface AgentStatus {
  isActive: boolean;
  lastActivity: string;
  metrics: AgentMetrics;
  riskMetrics?: {
    currentRiskScore: number;
    violationsToday: number;
    complianceRate: number;
  };
  financialMetrics?: {
    totalValue: number;
    dailyPnL: number;
    winRate: number;
  };
}

// ===== TRADING TYPES =====
export interface TradingDecision {
  action: "buy" | "sell" | "hold";
  symbol: string;
  quantity: number;
  price: number;
  confidence: number;
  reasoning: string;
  riskScore: number;
  timestamp: string;
  agentType: AgentType;
  sentimentData?: {
    sentiment: number;
    confidence: number;
    sources: string[];
  };
}

// ===== POLICY TYPES =====
export interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  metadata: Record<string, any>;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
  appliedToAgents: string[];
  effectivenessScore: number;
  violationsPrevented: number;
}

export interface PolicyRule {
  id: string;
  type: 'ALLOW' | 'DENY' | 'REQUIRE' | 'RATE_LIMIT';
  condition: string;
  action: string;
  metadata: Record<string, any>;
  priority: number;
  enabled: boolean;
}

export interface PolicyCheck {
  policyId: string;
  result: boolean;
  reason?: string;
}

// ===== COMMON COMPONENT PROPS =====
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingProps {
  isLoading: boolean;
  error?: string | null;
}

export interface AgentComponentProps extends BaseComponentProps, LoadingProps {
  agentType: AgentType;
}

// ===== DASHBOARD TYPES =====
export interface DashboardMetrics {
  totalAgents: number;
  activeAgents: number;
  totalForecasts: number;
  complianceRate: number;
  averageAttestationTime: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    arbitrum: 'online' | 'degraded' | 'offline';
    eas: 'operational' | 'delayed' | 'failed';
    ethereal: 'online' | 'degraded' | 'offline';
    policies: 'active' | 'warning' | 'error';
  };
  metrics: DashboardMetrics;
}

// ===== VINCENT SPECIFIC TYPES =====
export interface VincentStatus {
  isConnected: boolean;
  hasConsent: boolean;
  appId: string;
  delegateeAddress?: string;
  policies: {
    dailySpendingLimit: number;
    allowedTokens: string[];
    maxTradeSize: number;
  };
  isConfigured: boolean;
}

// ===== COMMON HOOK RETURN TYPES =====
export interface UseAgentState {
  agent: BaseAgent | null;
  status: AgentStatus;
  isLoading: boolean;
  error: string | null;
  startAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  refreshData: () => Promise<void>;
}

export interface UseTradingData {
  decisions: TradingDecision[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}