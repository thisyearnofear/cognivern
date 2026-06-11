/**
 * GovernanceClient
 *
 * The bridge that lets internal agents (Sapience, User, etc.) route their
 * actions through Cognivern's own governance pipeline — the SAME pipeline
 * the Cognivern Copilot uses, the SAME pipeline external agents use.
 *
 * Why this exists: the trading agents used to call Sapience / RPC / etc.
 * directly, bypassing Cognivern's policy engine. That made the
 * "governed spend" story incoherent. Now every spend — whether made by
 * the Sapience agent, a user-owned agent, or an external API caller —
 * goes through /api/governance/evaluate, /api/spend/preview, and
 * /api/spend. The audit trail is consistent end-to-end.
 *
 * The client calls the backend over HTTP (loopback in dev/prod) so the
 * governance middleware, auth, and audit logging all apply. In-process
 * shortcuts would skip those layers.
 */

import { Logger } from "../shared/logging/Logger.js";

const logger = new Logger("GovernanceClient");

export interface GovernanceClientConfig {
  baseUrl: string;
  apiKey: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout. */
  timeoutMs?: number;
}

export interface GovernanceEvaluationRequest {
  agentId: string;
  policyId?: string;
  action: {
    type: string;
    description: string;
    input: string;
    metadata?: Record<string, unknown>;
  };
}

export interface GovernanceDecision {
  approved: boolean;
  reason: string;
  agentId: string;
  actionType: string;
  policyId: string;
  policyChecks: Array<{
    policyId: string;
    result: boolean;
    reason: string;
  }>;
  source?: string;
  timestamp: string;
}

export interface SpendPreviewRequest {
  agentId: string;
  policyId?: string;
  recipient: string;
  amount: string; // atomic units as string
  asset: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface SpendPreviewResult {
  status: "approved" | "held" | "denied";
  decisionId?: string;
  attestationHash?: string;
  policyId?: string;
  reason?: string;
  auditLogId?: string;
  // For the "held" path, the operator must call execute_spend with the
  // same attestation + a humanConfirmationToken.
  humanConfirmationRequired?: boolean;
}

export interface SpendExecuteRequest extends SpendPreviewRequest {
  attestationHash: string;
  humanConfirmationToken: string;
}

export interface AuditEntry {
  id: string;
  decisionId?: string;
  attestationHash?: string;
  timestamp: string;
  agentId: string;
  actionType: string;
  status: string;
  reason?: string;
}

export class GovernanceClient {
  private config: GovernanceClientConfig;

  constructor(config?: Partial<GovernanceClientConfig>) {
    this.config = {
      baseUrl:
        config?.baseUrl ||
        process.env.COGNIVERN_SELF_BASE_URL ||
        process.env.COGNIVERN_BASE_URL ||
        "http://localhost:3000",
      apiKey: config?.apiKey || process.env.COGNIVERN_API_KEY || "",
      fetchImpl: config?.fetchImpl,
      timeoutMs: config?.timeoutMs ?? 15_000,
    };
    if (!this.config.apiKey) {
      logger.warn(
        "GovernanceClient initialized without API key — calls will fail. Set COGNIVERN_API_KEY in env.",
      );
    }
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    const f = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 15_000,
    );

    try {
      const r = await f(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!r.ok) {
        const text = await r.text();
        throw new Error(
          `GovernanceClient ${method} ${path} failed: ${r.status} ${text}`,
        );
      }

      const json = (await r.json()) as { data: T; success?: boolean };
      return json.data !== undefined ? json.data : (json as unknown as T);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Evaluate a non-spend action against a policy. Used for forecast
   * attestations, contract calls, API calls, etc. Returns a
   * GovernanceDecision (approved/denied + matched rules).
   */
  async evaluate(
    req: GovernanceEvaluationRequest,
  ): Promise<GovernanceDecision> {
    return this.request<GovernanceDecision>("POST", "/api/governance/evaluate", {
      agentId: req.agentId,
      policyId: req.policyId,
      action: req.action,
    });
  }

  /**
   * Dry-run a spend. Returns approved | held | denied. If approved or
   * held, the result includes an attestationHash that must be passed
   * to execute() to bind the execution to the preview.
   */
  async previewSpend(req: SpendPreviewRequest): Promise<SpendPreviewResult> {
    return this.request<SpendPreviewResult>("POST", "/api/spend/preview", req);
  }

  /**
   * Execute a spend that was previewed. Requires the attestation hash
   * from the preview and a humanConfirmationToken (returned by the
   * operator UI for held/above-threshold trades).
   */
  async executeSpend(req: SpendExecuteRequest): Promise<SpendPreviewResult> {
    return this.request<SpendPreviewResult>("POST", "/api/spend", req);
  }

  /**
   * Fetch recent audit entries — used by agents to verify their own
   * actions were written to the trail.
   */
  async recentAudit(params?: {
    agentId?: string;
    limit?: number;
  }): Promise<AuditEntry[]> {
    const search = new URLSearchParams();
    if (params?.agentId) search.set("agentId", params.agentId);
    search.set("limit", String(params?.limit ?? 20));
    return this.request<AuditEntry[]>(
      "GET",
      `/api/audit/logs?${search.toString()}`,
    );
  }
}

export const sharedGovernanceClient = new GovernanceClient();
