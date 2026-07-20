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

// Read auth token from the persisted auth store. The store is the single
// source of truth - falling back to localStorage here would risk reading a
// stale token after logout, or vice versa.
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return useAuthStore.getState().token;
  } catch {
    return null;
  }
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
        if (response.status === 401) {
          useAuthStore.getState().logout();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth:expired"));
          }
        }
        const errorBody = await response.text();
        // Parse structured error codes from the backend and surface
        // actionable guidance instead of raw "API error 500: ...".
        let actionableMsg: string;
        try {
          const parsed = JSON.parse(errorBody);
          const code = parsed?.error?.code || parsed?.code;
          const msg = parsed?.error?.message || parsed?.error || parsed?.message || errorBody;
          switch (code) {
            case "NO_ACTIVE_POLICY":
              actionableMsg = `No active policy found. Create one in the Policies page to start governing spends.`;
              break;
            case "BAD_REQUEST":
              actionableMsg = `Invalid request: ${msg}. Check your input and try again.`;
              break;
            default:
              actionableMsg = msg || errorBody;
          }
        } catch {
          actionableMsg = errorBody;
        }
        // Add status-specific guidance for common error codes.
        if (response.status === 403) {
          actionableMsg = `Permission denied: ${actionableMsg}. Check that your API key has the required scopes.`;
        } else if (response.status === 404) {
          actionableMsg = `Resource not found: ${actionableMsg}`;
        } else if (response.status === 429) {
          actionableMsg = `Rate limit exceeded. Wait 60 seconds and try again.`;
        } else if (response.status >= 500) {
          actionableMsg = `Server error (${response.status}): ${actionableMsg}. Try again in a moment.`;
        }
        // Attach the status code so the retry logic can decide whether
        // to retry (5xx = retry, 4xx = don't retry).
        const err = new Error(actionableMsg) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      return await response.json();
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        throw error;
      }

      // 4xx errors are not retried (they'll fail the same way). Only
      // 5xx and network errors get retried with exponential backoff.
      const status = (error as Error & { status?: number }).status;
      const isClientError = typeof status === "number" && status >= 400 && status < 500;
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
    suspicionHoldThreshold?: number;
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

  async listCopilotRuns(
    limit = 10,
  ): Promise<{ success: boolean; runs: CopilotRun[] }> {
    return this.fetch(`/api/copilot/runs?limit=${limit}`);
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

  // CRE Run Approval
  // POSTs to /api/cre/runs/:runId/approval with a FRESH Idempotency-Key per
  // call. For held spend runs the backend will broadcast a real native
  // transfer; the response surfaces { transferTxHash, transferStatus,
  // transferError }. A failed transfer leaves the run at paused_for_approval
  // so a retry click re-enters the broadcast path. We always mint a new idem
  // key per call so retries are not blocked by a cached failure response.
  async submitRunApproval(
    runId: string,
    params: { approve: boolean; reason?: string },
  ): Promise<{
    success: boolean;
    run?: Record<string, unknown>;
    transfer?: {
      transferTxHash?: string;
      transferStatus?: "sent" | "failed" | "skipped";
      transferError?: string;
    };
    error?: string;
  }> {
    const { workspaceMode } = useAuthStore.getState();
    const idemKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Workspace-Mode": workspaceMode,
      "Idempotency-Key": idemKey,
    };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`/api/cre/runs/${runId}/approval`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    if (response.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
    }

    // The controller returns 200 even for transfer failures (with success:false
    // in the body), so always parse and let the caller decide based on
    // success/transferStatus. On a true 5xx fall through to a generic error.
    try {
      return await response.json();
    } catch {
      return {
        success: false,
        error: `Approval failed: HTTP ${response.status}`,
      };
    }
  }

  // ── Sealed-bid vendor selection ─────────────────────────────────────────
  async getSealedBidRounds(): Promise<ApiResponse<SealedBidRoundSummary[]>> {
    return this.fetch("/api/vendor/sealed-bid/rounds");
  }

  async getSealedBidRound(
    roundId: string,
  ): Promise<ApiResponse<SealedBidRound>> {
    return this.fetch(`/api/vendor/sealed-bid/rounds/${encodeURIComponent(roundId)}`);
  }

  // Query the ledger AS a party — returns exactly the bids that party can read
  // on-ledger (real Canton disclosure, not a client-side filter).
  async getSealedBidPartyView(
    roundId: string,
    party: string,
  ): Promise<ApiResponse<SealedBidPartyView>> {
    return this.fetch(
      `/api/vendor/sealed-bid/rounds/${encodeURIComponent(roundId)}/party-view?party=${encodeURIComponent(party)}`,
    );
  }

  async createSealedBidRound(params: {
    description: string;
    serviceCategory: string;
    deadline: string;
    maxBids: number;
    backend?: "fhe" | "canton";
    manager?: string;
    // Agent governance — optional. If present, the backend creates a CRE
    // run, records a round_created event, and gates closeRound on policy.
    agentId?: string;
    settlementAmount?: number;
    settlementAssetTag?: string;
  }): Promise<ApiResponse<SealedBidRound>> {
    return this.fetch("/api/vendor/sealed-bid/rounds", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async submitSealedBid(params: {
    roundId: string;
    bidder: string;
    amountUsd: number;
    proposalDetails?: string;
  }): Promise<ApiResponse<SealedBid>> {
    return this.fetch(
      `/api/vendor/sealed-bid/rounds/${encodeURIComponent(params.roundId)}/bid`,
      {
        method: "POST",
        body: JSON.stringify({
          bidder: params.bidder,
          amountUsd: params.amountUsd,
          proposalDetails: params.proposalDetails,
        }),
      },
    );
  }

  async closeSealedBidRound(params: {
    roundId: string;
    manager?: string;
  }): Promise<
    ApiResponse<{
      roundId: string;
      status: string;
      bidCount: number;
      policyChecks?: PolicyCheck[];
    }>
  > {
    return this.fetch(
      `/api/vendor/sealed-bid/rounds/${encodeURIComponent(params.roundId)}/close`,
      {
        method: "POST",
        body: JSON.stringify({ manager: params.manager }),
      },
    );
  }

  // Fetch the tamper-evident governance event timeline for an agent-governed
  // round. Returns 404 for non-agent-governed rounds — callers should guard.
  async getGovernanceTimeline(
    roundId: string,
  ): Promise<ApiResponse<GovernanceTimeline>> {
    return this.fetch(
      `/api/vendor/sealed-bid/rounds/${encodeURIComponent(roundId)}/governance-timeline`,
    );
  }

  async revealSealedBidWinner(params: {
    roundId: string;
    selectionMethod: "lowest-bid" | "highest-bid" | "specific";
    specificBidder?: string;
  }): Promise<
    ApiResponse<{
      roundId: string;
      winner: string;
      winningBid: number;
      winningProposalHash: string;
      status: string;
      totalBids: number;
    }>
  > {
    return this.fetch(
      `/api/vendor/sealed-bid/rounds/${encodeURIComponent(params.roundId)}/reveal`,
      {
        method: "POST",
        body: JSON.stringify({
          selectionMethod: params.selectionMethod,
          specificBidder: params.specificBidder,
        }),
      },
    );
  }
}

// Types for the sealed-bid endpoints. Kept in this file so both apiClient
// and the frontend components share a single canonical shape without a
// separate `types.ts` module for one feature.
export type SealedBidBackendName = "fhe" | "canton";
export type SealedBidRoundStatus = "open" | "closed" | "revealed";
export interface SealedBid {
  bidder: string;
  encryptedAmount: string;
  proposalHash: string;
  status: "pending" | "selected" | "rejected";
  submittedAt: string;
  index: number;
}
export interface PartyVisibleBid {
  bidder: string;
  amountUsd: number;
  proposalHash: string;
  index: number;
}
export interface SealedBidPartyView {
  supported: boolean;
  party: string;
  partyId?: string;
  visibleBids?: PartyVisibleBid[];
}
export interface SealedBidRound {
  roundId: string;
  description: string;
  serviceCategory: string;
  manager: string;
  deadline: string;
  maxBids: number;
  status: SealedBidRoundStatus;
  bids: SealedBid[];
  winner: string | null;
  winningBid: number | null;
  winningProposalHash: string | null;
  createdAt: string;
  backend?: SealedBidBackendName;
  // Value settlement — present when the round was created with
  // settlementAmount/settlementAssetTag and the CloseAndReveal has
  // atomically transferred the escrowed PaymentDeposit to the winner.
  // settledAssetCid is the on-ledger contract ID of the new deposit
  // (owned by the winner); null until reveal completes.
  settledAssetCid?: string | null;
  settlementAmount?: number | null;
  settlementAssetTag?: string | null;
  // Agent governance — present when the round was created by an agent
  // (agentId in the create request). createdByAgent is the agent id;
  // governanceRunId is the CRE run that tracks the tamper-evident event
  // timeline for this round. Absent for human-created rounds.
  createdByAgent?: string;
  governanceRunId?: string;
}
export interface SealedBidRoundSummary {
  roundId: string;
  description: string;
  serviceCategory: string;
  status: SealedBidRoundStatus;
  bidCount: number;
  maxBids: number;
  deadline: string;
  winner: string | null;
  winningBid: number | null;
  createdAt: string;
  backend?: SealedBidBackendName;
  createdByAgent?: string;
  governanceRunId?: string;
}

// ── Agent governance types ──────────────────────────────────────────────
// Mirrors the backend PolicyCheck / GovernanceEvent / GovernanceTimeline
// shapes from docs/AGENT_GOVERNANCE_INTEGRATION_SPEC.md. Used by the
// governance timeline component and the policy-gated close flow.

export interface PolicyCheck {
  name: string; // "min_bids" | "deadline_elapsed" | "budget_within_limit"
  passed: boolean;
  detail: string; // human-readable, e.g. "3 bids received (min: 3)"
}

export interface GovernanceEvent {
  eventType: string; // "round_created" | "bid_submitted" | "policy_checked" | "round_closed" | "winner_revealed"
  timestamp: string; // ISO 8601
  eventHash: string; // SHA-256(runId|eventType|timestamp|canonicalJSON(payload))
  payload: Record<string, unknown>;
}

export interface GovernanceTimeline {
  runId: string;
  agentId: string;
  events: GovernanceEvent[];
}

// Response shape when the policy gate rejects a close attempt (HTTP 403).
export interface ClosePolicyRejected {
  success: false;
  error: "Policy gate failed";
  policyChecks: PolicyCheck[];
  reason: string;
  timestamp: string;
}

export const apiClient = new ApiClient();
