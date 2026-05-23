// Typed API client for Cognivern backend

import type {
  ApiResponse,
  AuditLog,
  Run,
  Policy,
  Agent,
  GovernanceEvaluation,
  IntentMetrics,
  AuditInsights,
} from '@cognivern/shared';

// Re-export for convenience
export type {
  ApiResponse,
  AuditLog,
  Run,
  Policy,
  Agent,
  GovernanceEvaluation,
  IntentMetrics,
  AuditInsights,
};

class ApiClient {
  private baseUrl: string;
  private apiKey: string | null;

  constructor() {
    this.baseUrl = '';
    this.apiKey = null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error ${response.status}: ${error}`);
      }

      return await response.json();
    } catch (error) {
      if (retries > 0 && error instanceof Error && !error.message.includes('4')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)));
        return this.fetch(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  // Audit Logs
  async getAuditLogs(): Promise<ApiResponse<AuditLog[]>> {
    return this.fetch('/api/audit/logs');
  }

  async getAuditInsights(): Promise<ApiResponse<AuditInsights>> {
    return this.fetch('/api/audit/insights');
  }

  // Runs
  async getRuns(): Promise<ApiResponse<Run[]>> {
    return this.fetch('/api/cre/runs');
  }

  async getRun(runId: string): Promise<ApiResponse<Run>> {
    return this.fetch(`/api/cre/runs/${runId}`);
  }

  // Policies
  async getPolicies(): Promise<ApiResponse<Policy[]>> {
    return this.fetch('/api/governance/policies');
  }

  async createPolicy(policy: Partial<Policy>): Promise<ApiResponse<Policy>> {
    return this.fetch('/api/governance/policies', {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  }

  async evaluateGovernance(params: {
    agentId: string;
    action: {
      type: string;
      description: string;
      amount: number;
      currency: string;
    };
    policyId?: string;
  }): Promise<ApiResponse<GovernanceEvaluation>> {
    return this.fetch('/api/governance/evaluate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Agents
  async getAgents(): Promise<ApiResponse<Agent[]>> {
    return this.fetch('/api/agents');
  }

  async getAgent(agentId: string): Promise<ApiResponse<Agent>> {
    return this.fetch(`/api/agents/${agentId}`);
  }

  // Spend
  async previewSpend(params: {
    agentId: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<ApiResponse<GovernanceEvaluation>> {
    return this.fetch('/api/spend/preview', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async executeSpend(params: {
    agentId: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch('/api/spend', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Intent
  async getIntentMetrics(): Promise<ApiResponse<IntentMetrics>> {
    return this.fetch('/api/intent/metrics');
  }

  async processIntent(text: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch('/api/intent', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  // OWS Wallet
  async bootstrapWallet(params: {
    name: string;
    chain: string;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch('/api/ows/bootstrap', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getWallets(): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    return this.fetch('/api/ows/wallets');
  }

  async createApiKey(params: {
    walletId: string;
    scopes: string[];
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch('/api/ows/api-keys', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

export const apiClient = new ApiClient();
