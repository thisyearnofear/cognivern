import { ApiResponse } from "./types";
import { getApiUrl, getApiKey } from "../utils/api";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "X-API-KEY": getApiKey(),
};

export interface CreRun {
  runId: string;
  workflow: string;
  mode: string;
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
  status?:
    | "queued"
    | "running"
    | "paused_for_approval"
    | "cancelled"
    | "completed"
    | "failed";
  parentRunId?: string;
  retryCount?: number;
  currentStepName?: string;
  requiresApproval?: boolean;
  approvalState?: "not_required" | "pending" | "approved" | "rejected";
  approvalReason?: string;
  plan?: {
    version: number;
    updatedAt: string;
    summary?: string;
    steps: Array<{
      id: string;
      title: string;
      description?: string;
      enabled: boolean;
      status?: "pending" | "approved" | "rejected";
    }>;
  };
  controls?: {
    canCancel: boolean;
    canRetry: boolean;
    canApprove: boolean;
  };
  metrics?: {
    latencyMs?: number;
    stepCount?: number;
    artifactCount?: number;
    estimatedTokens?: number;
    estimatedCostUsd?: number;
  };
  provenance?: {
    source: "cognivern" | "ingested";
    workflowVersion?: string;
    model?: string;
    citations?: Array<{ label: string; value: string }>;
  };
  evidence?: {
    hash: string;
    cid?: string;
    artifactIds?: string[];
    citations?: string[];
  };
  events?: CreRunEvent[];
  steps: Array<{
    kind: string;
    name: string;
    startedAt: string;
    finishedAt?: string;
    ok: boolean;
    summary?: string;
    details?: Record<string, unknown>;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    createdAt: string;
    data: unknown;
    evidence?: {
      hash: string;
      cid?: string;
    };
  }>;
}

export interface CreRunEvent {
  id: string;
  runId: string;
  type:
    | "run_started"
    | "message_delta"
    | "tool_call_started"
    | "tool_result"
    | "run_paused_for_approval"
    | "run_cancel_requested"
    | "run_cancelled"
    | "run_retry_requested"
    | "run_finished"
    | "run_failed";
  timestamp: string;
  stepName?: string;
  payload?: Record<string, unknown>;
  evidence?: {
    hash: string;
    cid?: string;
    artifactIds?: string[];
    citations?: string[];
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(getApiUrl(endpoint), {
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
    ...options,
  });

  const json = await res.json();
  if (!res.ok) {
    return {
      success: false,
      error: json?.error || res.statusText,
    } as ApiResponse<T>;
  }

  return { success: true, data: json } as ApiResponse<T>;
}

export const creApi = {
  listRuns: async (projectId: string = "default") =>
    request<{ success: boolean; runs: CreRun[] }>(
      `/api/cre/runs?projectId=${encodeURIComponent(projectId)}`,
    ),
  getRun: async (runId: string) =>
    request<{ success: boolean; run: CreRun }>(`/api/cre/runs/${runId}`),
  triggerForecast: async (
    params: { writeAttestation?: boolean; requireApproval?: boolean } = {},
  ) =>
    request<{ success: boolean; runId: string; run: CreRun }>(
      "/api/cre/forecast",
      {
        method: "POST",
        body: JSON.stringify({
          writeAttestation: Boolean(params.writeAttestation),
          requireApproval: Boolean(params.requireApproval),
        }),
      },
    ),
  listRunEvents: async (runId: string, since?: number) =>
    request<{
      success: boolean;
      runId: string;
      events: CreRunEvent[];
      cursor: number;
    }>(
      `/api/cre/runs/${encodeURIComponent(runId)}/events${
        since ? `?since=${encodeURIComponent(String(since))}` : ""
      }`,
    ),
  cancelRun: async (runId: string) =>
    request<{ success: boolean; run: CreRun }>(
      `/api/cre/runs/${encodeURIComponent(runId)}/cancel`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  retryRun: async (
    runId: string,
    params: { writeAttestation?: boolean; fromStep?: number } = {},
  ) =>
    request<{
      success: boolean;
      runId: string;
      run: CreRun;
      retriedFrom: string;
    }>(`/api/cre/runs/${encodeURIComponent(runId)}/retry`, {
      method: "POST",
      body: JSON.stringify({
        writeAttestation: Boolean(params.writeAttestation),
        ...(typeof params.fromStep === "number"
          ? { fromStep: params.fromStep }
          : {}),
      }),
    }),
  submitRunApproval: async (
    runId: string,
    params: { approve: boolean; reason?: string },
  ) =>
    request<{ success: boolean; run: CreRun }>(
      `/api/cre/runs/${encodeURIComponent(runId)}/approval`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    ),
  updateRunPlan: async (
    runId: string,
    plan: {
      version: number;
      summary?: string;
      steps: Array<{
        id: string;
        title: string;
        description?: string;
        enabled: boolean;
        status?: "pending" | "approved" | "rejected";
      }>;
    },
  ) =>
    request<{ success: boolean; run: CreRun }>(
      `/api/cre/runs/${encodeURIComponent(runId)}/plan`,
      {
        method: "POST",
        body: JSON.stringify({ plan }),
      },
    ),
};
