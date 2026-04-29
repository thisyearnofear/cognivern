/**
 * Dashboard Types - Shared type definitions
 * Extracted from UnifiedDashboard for better modularity
 */

export interface AgentSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  winRate?: number;
  totalReturn?: number;
  lastActive?: string;
  policyCount?: number;
  performance24h?: {
    trades: number;
    winRate: number;
    return: number;
    sharpeRatio: number;
  };
}

export interface PolicySummary {
  id: string;
  name: string;
  status: string;
}

export interface ActivityItem {
  id: string;
  agentId?: string;
  agentName?: string;
  type?: string;
  severity?: 'success' | 'warning' | 'error' | 'info';
  description?: string;
  timestamp?: string;
  sourceType?: 'audit' | 'run';
  sourceId?: string;
  runId?: string;
  targetPath?: string;
  evidenceLabel?: string;
  policyIds?: string[];
  projectId?: string;
  workflow?: string;
  artifactCount?: number;
  citations?: string[];
  model?: string;
  workflowVersion?: string;
  evidenceHash?: string;
  cid?: string;
  artifactIds?: string[];
}

export interface QuestItem {
  id: string;
  type: 'pattern' | 'recommendation' | 'trend' | 'alert';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: boolean;
}

export interface QuickStats {
  activeAgents: number;
  totalAgents: number;
  totalTrades: number;
  avgWinRate: number;
  totalReturn: number;
  totalPolicies: number;
}

export interface DashboardBundlePayload {
  stats?: {
    totalAgents?: number;
    avgWinRate?: number;
    avgReturn?: number;
    totalTrades?: number;
    totalPolicies?: number;
  };
  agents?: Array<
    AgentSummary & {
      ecosystem?: string;
      uptime?: number;
      performance24h?: {
        trades: number;
        winRate: number;
        return: number;
        sharpeRatio: number;
      };
    }
  >;
  activity?: Array<Record<string, unknown>>;
  policies?: PolicySummary[];
  quests?: QuestItem[];
}

export interface UnifiedDashboardPayload {
  workerThoughts?: string[];
}

export interface DashboardProps {
  mode?: 'full' | 'minimal';
}

export interface AuditEntry {
  id?: unknown;
  agent?: unknown;
  actionType?: unknown;
  type?: unknown;
  severity?: unknown;
  complianceStatus?: unknown;
  description?: unknown;
  action?: unknown;
  timestamp?: unknown;
  details?: {
    agentId?: unknown;
    agent?: { name?: unknown };
    projectId?: unknown;
    citations?: unknown[];
  };
  policyChecks?: Array<{ policyId?: unknown }>;
  evidence?: {
    artifactIds?: unknown[];
    hash?: unknown;
    cid?: unknown;
  };
}

export interface RunStreamEntry {
  id?: unknown;
  runId?: unknown;
  workflow?: unknown;
  type?: unknown;
  summary?: unknown;
  timestamp?: unknown;
  projectId?: unknown;
  artifactCount?: unknown;
  evidence?: {
    artifactIds?: unknown[];
    hash?: unknown;
    cid?: unknown;
  };
  runEvidence?: {
    artifactIds?: unknown[];
    hash?: unknown;
    cid?: unknown;
  };
  citationLabels?: unknown[];
  model?: unknown;
  workflowVersion?: unknown;
}
