/**
 * Shared Types - Single Source of Truth
 * 
 * All types used across the platform are defined here to ensure consistency
 * and eliminate duplication between API, agents, and frontend.
 */

// Core Agent Types
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  owner: string;
  capabilities: string[];
  registeredAt: string;
  lastActivity: string;
  currentPolicyId?: string;
}

export type AgentType = 
  | 'trading' 
  | 'social-trading' 
  | 'contract' 
  | 'governance' 
  | 'external-trading';

export type AgentStatus = 
  | 'active' 
  | 'inactive' 
  | 'pending' 
  | 'error' 
  | 'maintenance';

// Trading Types
export interface TradingDecision {
  id?: string;
  action: TradingAction;
  symbol: string;
  quantity: number;
  price: number;
  confidence: number;
  reasoning: string;
  riskScore: number;
  timestamp: string;
  agentType: string;
  agentId?: string;
}

export type TradingAction = 'buy' | 'sell' | 'hold';

export interface TradingPerformance {
  totalReturn: number;
  winRate: number;
  sharpeRatio: number;
  totalTrades?: number;
  profitableTrades?: number;
  averageReturn?: number;
  maxDrawdown?: number;
}

// Governance Types
export interface Policy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  creator: string;
  createdAt: string;
  updatedAt: string;
  status: PolicyStatus;
  version: string;
}

export interface PolicyRule {
  id: string;
  type: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
}

export type PolicyStatus = 'active' | 'inactive' | 'draft' | 'deprecated';

// Monitoring Types
export interface AgentMetrics {
  uptime: number;
  successRate: number;
  errorRate: number;
  avgResponseTime: number;
  totalRequests: number;
  lastActive: string;
  actionsToday: number;
}

export interface RiskMetrics {
  currentRiskScore: number;
  violationsToday: number;
  complianceRate: number;
  maxRiskThreshold: number;
}

export interface FinancialMetrics {
  totalValue: number;
  dailyPnL: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Configuration Types
export interface ServiceConfig {
  name: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  port?: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
}

export interface CacheConfig {
  url: string;
  ttl: number;
  maxSize: string;
}

// Event Types (for inter-service communication)
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  data: Record<string, any>;
  timestamp: string;
  version: number;
}

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  dependencies: Record<string, DependencyHealth>;
}

export interface DependencyHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

// Audit Types
export interface AuditLog {
  id: string;
  agentId: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
  outcome: 'success' | 'failure' | 'warning';
  riskLevel: 'low' | 'medium' | 'high';
}
