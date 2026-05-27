// Typed API client for Cognivern backend

import { useAppStore } from "@/stores/app-store";
import type {
  ApiResponse,
  AuditLog,
  Run,
  Policy,
  Agent,
  GovernanceEvaluation,
  IntentMetrics,
  AuditInsights,
  ApiKey,
  ApiKeyCreateResponse,
  Workspace,
} from "@cognivern/shared";

// Get token from localStorage for auth
function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("cognivern-token");
  }
  return null;
}

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
  ApiKey,
  ApiKeyCreateResponse,
  Workspace,
};

class ApiClient {
  private baseUrl: string;
  private apiKey: string | null;

  constructor() {
    this.baseUrl = "";
    this.apiKey = null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2,
  ): Promise<T> {
    const { user } = useAppStore.getState();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Workspace-Mode": user.workspaceMode,
    };

    // Add API key if set
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    // Add auth token from localStorage
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
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
      if (
        retries > 0 &&
        error instanceof Error &&
        !error.message.includes("4")
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (3 - retries)),
        );
        return this.fetch(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  // Audit Logs
  async getAuditLogs(): Promise<ApiResponse<AuditLog[]>> {
    return this.fetch("/api/audit/logs");
  }

  async getAuditInsights(): Promise<ApiResponse<AuditInsights>> {
    return this.fetch("/api/audit/insights");
  }

  // Runs
  async getRuns(): Promise<ApiResponse<Run[]>> {
    return this.fetch("/api/cre/runs");
  }

  async getRun(runId: string): Promise<ApiResponse<Run>> {
    return this.fetch(`/api/cre/runs/${runId}`);
  }

  // Policies
  async getPolicies(): Promise<ApiResponse<Policy[]>> {
    return this.fetch("/api/governance/policies");
  }

  async createPolicy(policy: Partial<Policy>): Promise<ApiResponse<Policy>> {
    return this.fetch("/api/governance/policies", {
      method: "POST",
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
    return this.fetch("/api/governance/evaluate", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Agents
  async getAgents(): Promise<ApiResponse<Agent[]>> {
    return this.fetch("/api/agents");
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
    return this.fetch("/api/spend/preview", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async executeSpend(params: {
    agentId: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch("/api/spend", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Intent
  async getIntentMetrics(): Promise<ApiResponse<IntentMetrics>> {
    return this.fetch("/api/intent/metrics");
  }

  async processIntent(
    text: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch("/api/intent", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  // OWS Wallet
  async bootstrapWallet(params: {
    name: string;
    chain: string;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch("/api/ows/bootstrap", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getWallets(): Promise<ApiResponse<Array<Record<string, unknown>>>> {
    return this.fetch("/api/ows/wallets");
  }

  async createApiKey(params: {
    walletId: string;
    scopes: string[];
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch("/api/ows/api-keys", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Workspace API Keys
  async getApiKeys(): Promise<ApiResponse<ApiKey[]>> {
    return this.fetch("/api-keys");
  }

  async createWorkspaceApiKey(params: {
    name: string;
    scopes: string[];
  }): Promise<ApiResponse<ApiKeyCreateResponse>> {
    return this.fetch("/api-keys", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async revokeApiKey(
    keyId: string,
  ): Promise<ApiResponse<{ id: string; revokedAt: string }>> {
    return this.fetch(`/api-keys/${keyId}`, { method: "DELETE" });
  }

  // Workspace
  async updateWorkspace(params: {
    name?: string;
    tier?: "demo" | "live";
  }): Promise<ApiResponse<Workspace>> {
    return this.fetch("/workspace", {
      method: "PUT",
      body: JSON.stringify(params),
    });
  }

  // Agent registration (live workspaces)
  async registerAgent(params: {
    name: string;
    role: string;
    chain: string;
    walletAddress?: string;
    budget?: string;
  }): Promise<ApiResponse<Agent>> {
    return this.fetch("/api/agents/register", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async connectAgent(params: {
    name: string;
    role: string;
    chain: string;
    walletAddress: string;
    budget?: string;
    webhookUrl?: string;
  }): Promise<ApiResponse<Agent>> {
    return this.fetch("/api/agents/connect", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Policy creation (live workspaces)
  async createGovernancePolicy(params: {
    name: string;
    type: string;
    description: string;
    rules?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResponse<Policy>> {
    return this.fetch("/api/governance/policies", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Speech-to-text (ElevenLabs proxy)
  async transcribeSpeech(params: {
    audio: string; // base64
    mimeType?: string;
  }): Promise<ApiResponse<{ text: string; language?: string }>> {
    return this.fetch("/api/speech/transcribe", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Agent status update
  async updateAgentStatus(
    agentId: string,
    status: "active" | "paused" | "inactive",
  ): Promise<ApiResponse<{ id: string; status: string }>> {
    return this.fetch(`/api/agents/${agentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
}

export const apiClient = new ApiClient();
