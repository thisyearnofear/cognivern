export interface Agent {
  id: string;
  name: string;
  type: 'governance' | 'monitoring' | 'enforcement';
  capabilities: string[];
  status: 'active' | 'inactive' | 'error';
  metrics: AgentMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMetrics {
  responseTime: number;
  successRate: number;
  errorRate: number;
  totalRequests: number;
  lastActive: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  rules: string[];
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface SystemMetrics {
  timestamp: string;
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
  };
  performance: {
    responseTime: number;
    successRate: number;
    errorRate: number;
  };
  compliance: {
    policyViolations: number;
    auditScore: number;
  };
}
