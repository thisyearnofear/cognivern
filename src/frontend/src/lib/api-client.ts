// Typed API client for Cognivern backend

import { useAuthStore } from "@/stores/auth-store";
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
  PolicyVersion,
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
  PolicyVersion,
};

export interface CopilotEvent {
  id: number;
  type:
    | "run_started"
    | "model_tool_call"
    | "tool_result"
    | "tool_error"
    | "preview_ready"
    | "confirmation_required"
    | "confirmation_recorded"
    | "execution_blocked"
    | "final"
    | "run_failed";
  timestamp: string;
  name?: string;
  payload?: Record<string, unknown>;
}

export interface CopilotRun {
  id: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
  status:
    | "queued"
    | "running"
    | "awaiting_confirmation"
    | "confirmed"
    | "completed"
    | "failed";
  summary?: string;
  error?: string;
  preview?: Record<string, unknown>;
  result?: Record<string, unknown>;
  events: CopilotEvent[];
}

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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("You are offline. Check your connection and try again.");
    }

    const { workspaceMode } = useAuthStore.getState();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Workspace-Mode": workspaceMode,
    };

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: options.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error ${response.status}: ${error}`);
      }

      return await response.json();
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        throw error;
      }

      const isClientError =
        error instanceof Error && /API error 4\d\d/.test(error.message);
      if (retries > 0 && !isClientError) {
        const delay = Math.min(1000 * Math.pow(2, 3 - retries), 8000);
        await new Promise((resolve) => setTimeout(resolve, delay));
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

  // Multi-workspace
  async listWorkspaces(): Promise<ApiResponse<Workspace[]>> {
    return this.fetch("/workspaces");
  }

  async createWorkspace(params: {
    name: string;
  }): Promise<ApiResponse<Workspace>> {
    return this.fetch("/workspaces", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async switchWorkspace(
    workspaceId: string,
  ): Promise<ApiResponse<{ token: string; workspace: Workspace }>> {
    return this.fetch(`/workspaces/${workspaceId}/switch`, {
      method: "POST",
    });
  }

  // Policy versioning
  async getPolicyVersions(
    policyId: string,
  ): Promise<ApiResponse<PolicyVersion[]>> {
    return this.fetch(`/governance/policies/${policyId}/versions`);
  }

  async rollbackPolicy(
    policyId: string,
    versionId: string,
  ): Promise<ApiResponse<{ id: string; rolledBackToVersion: number }>> {
    return this.fetch(`/governance/policies/${policyId}/rollback`, {
      method: "POST",
      body: JSON.stringify({ versionId }),
    });
  }

  // ── Copilot Agent Runs ───────────────────────────────────────────────

  async startCopilotRun(params: {
    goal: string;
    previewOnly?: boolean;
  }): Promise<{ success: boolean; run: CopilotRun }> {
    return this.fetch("/api/copilot/runs", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getCopilotRun(
    runId: string,
  ): Promise<{ success: boolean; run: CopilotRun }> {
    return this.fetch(`/api/copilot/runs/${runId}`);
  }

  async confirmCopilotRun(
    runId: string,
    params: { approve: boolean; reason?: string },
  ): Promise<{ success: boolean; run: CopilotRun }> {
    return this.fetch(`/api/copilot/runs/${runId}/confirm`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  connectCopilotSse(
    runId: string,
    callbacks: {
      onEvent: (event: CopilotEvent) => void;
      onError: (error: string) => void;
    },
  ): AbortController {
    const controller = new AbortController();
    const token = getAuthToken();

    this.connectGenericSseStream(
      `/api/copilot/runs/${runId}/events/stream`,
      token,
      controller,
      {
        onEvent(event) {
          callbacks.onEvent(event as unknown as CopilotEvent);
        },
        onError: callbacks.onError,
      },
    ).catch((err) =>
      callbacks.onError(err instanceof Error ? err.message : String(err)),
    );

    return controller;
  }

  // ── Async FHE Evaluation (SSE-based progress streaming) ──────────────

  /**
   * Evaluate governance with confidential (FHE) policies.
   * Returns a 202 Accepted with a runId for SSE progress tracking,
   * or a 200 with the result for non-confidential evaluations.
   */
  async evaluateGovernanceFhe(params: {
    agentId: string;
    action: {
      type: string;
      description: string;
      amount: number;
      currency: string;
    };
    policyId?: string;
  }): Promise<{ status: number; data: unknown }> {
    const { workspaceMode } = useAuthStore.getState();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Workspace-Mode": workspaceMode,
    };
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`/api/governance/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    const body = await response.json();
    return { status: response.status, data: body };
  }

  /**
   * Get the final result of a completed FHE evaluation run.
   */
  async getGovernanceEvaluationResult(
    runId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetch(`/api/governance/evaluate/${runId}/result`);
  }

  /**
   * Connect to the SSE stream for an async FHE evaluation run.
   * Calls onEvent for each run_event and onComplete when finished.
   * Returns an abort function to disconnect.
   */
  connectFheSse(
    runId: string,
    callbacks: {
      onEvent: (event: { type: string; stepName?: string; payload?: Record<string, unknown> }) => void;
      onComplete: (result: Record<string, unknown>) => void;
      onError: (error: string) => void;
    },
  ): AbortController {
    const controller = new AbortController();
    const token = getAuthToken();

    this.connectSseStream(runId, token, controller, callbacks).catch(
      (err) =>
        callbacks.onError(err instanceof Error ? err.message : String(err)),
    );

    return controller;
  }

  /**
   * Read an SSE stream via fetch + ReadableStream (supports auth headers).
   */
  private async connectSseStream(
    runId: string,
    token: string | null,
    controller: AbortController,
    callbacks: {
      onEvent: (event: { type: string; stepName?: string; payload?: Record<string, unknown> }) => void;
      onComplete: (result: Record<string, unknown>) => void;
      onError: (error: string) => void;
    },
  ): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `/api/cre/runs/${runId}/events/stream`,
      {
        headers,
        signal: controller.signal,
      },
    );

    if (!response.ok || !response.body) {
      throw new Error(
        `SSE connection failed: ${response.status} ${response.statusText}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";
    let currentData = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6).trim();
        } else if (line === "" && currentData) {
          // Empty line = event delimiter
          try {
            const parsed = JSON.parse(currentData);
            if (currentEvent === "run_event") {
              callbacks.onEvent({
                type: (parsed.type || parsed.eventName || "") as string,
                stepName: parsed.stepName as string | undefined,
                payload: parsed.payload as Record<string, unknown> | undefined,
              });

              // Detect completion from run_event payload
              if (
                parsed.type === "run_finished" &&
                parsed.payload?.result
              ) {
                callbacks.onComplete(
                  parsed.payload.result as Record<string, unknown>,
                );
              } else if (parsed.type === "run_failed") {
                callbacks.onError(
                  "FHE evaluation failed on the network" as string,
                );
              }
            }
          } catch {
            // Ignore parse errors on malformed SSE data
          }
          currentEvent = "";
          currentData = "";
        } else if (line.startsWith(": ")) {
          // Comment / heartbeat — ignore
        }
      }
    }
  }

  private async connectGenericSseStream(
    endpoint: string,
    token: string | null,
    controller: AbortController,
    callbacks: {
      onEvent: (event: Record<string, unknown>) => void;
      onError: (error: string) => void;
    },
  ): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `SSE connection failed: ${response.status} ${response.statusText}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";
    let currentData = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6).trim();
        } else if (line === "" && currentData) {
          try {
            const parsed = JSON.parse(currentData) as Record<string, unknown>;
            if (currentEvent === "run_event") {
              callbacks.onEvent(parsed);
            } else if (currentEvent === "error") {
              callbacks.onError(String(parsed.message || "SSE error"));
            }
          } catch {
            // Ignore malformed SSE frames.
          }
          currentEvent = "";
          currentData = "";
        }
      }
    }
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
