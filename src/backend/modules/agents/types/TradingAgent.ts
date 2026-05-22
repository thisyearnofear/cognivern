/**
 * Trading Agent Types
 */

import type {
  TradingDecision,
  TradingAction,
  AgentType,
  AgentStatus,
} from "../../../shared/types/index.js";

// Re-export for convenience
export type { TradingDecision, TradingAction, AgentType, AgentStatus };

export interface TradingAgent {
  id: string;
  name: string;
  status: "active" | "inactive" | "paused" | "error";
  type: AgentType;
  config: TradingAgentConfig;

  // Core methods
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  shutdown(): Promise<void>;

  // Trading methods
  executeTrade(decision: TradingDecision): Promise<TradeResult>;
  getPortfolio(): Promise<Portfolio>;
  getPerformance(): Promise<PerformanceMetrics>;

  // Governance methods
  checkCompliance(decision: TradingDecision): Promise<ComplianceResult>;
  reportActivity(activity: AgentActivity): Promise<void>;

  // Additional methods expected by AgentsModule
  getId(): string;
  isHealthy(): Promise<boolean>;
  getInfo(): AgentInfo;
  getStatus(): Promise<any>;
  getRecentDecisions(limit?: number): Promise<TradingDecision[]>;
}

export interface TradingAgentConfig {
  apiKey?: string;
  maxTradeSize: number;
  riskTolerance: number;
  tradingPairs: string[];
  strategies: string[];
  governanceRules: GovernanceRule[];
}

// Types are imported above - no need to re-export

export interface TradeResult {
  id: string;
  decision: TradingDecision;
  status: "pending" | "executed" | "failed" | "cancelled";
  executedPrice?: number;
  executedQuantity?: number;
  fees?: number;
  error?: string;
  timestamp: Date;
}

export interface Portfolio {
  totalValue: number;
  cash: number;
  positions: Position[];
  lastUpdated: Date;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  averageTradeReturn: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface ComplianceResult {
  isCompliant: boolean;
  violations: ComplianceViolation[];
  warnings: ComplianceWarning[];
}

export interface ComplianceViolation {
  rule: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  suggestedAction: string;
}

export interface ComplianceWarning {
  rule: string;
  message: string;
  recommendation: string;
}

export interface GovernanceRule {
  id: string;
  name: string;
  type: "risk" | "compliance" | "performance" | "operational";
  condition: string;
  action: "block" | "warn" | "log" | "modify";
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface AgentActivity {
  agentId: string;
  type: "trade" | "decision" | "error" | "status_change";
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AgentInfo {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  config: TradingAgentConfig;
  createdAt: Date;
  lastActivity: string;
  owner: string;
  capabilities: string[];
  registeredAt: string;
}

// AgentStatus is imported from shared types
