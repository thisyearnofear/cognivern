export type ChainId = number;
export type CreRunStatus =
  | "queued"
  | "running"
  | "paused_for_approval"
  | "cancelled"
  | "completed"
  | "failed";
export type CreRunEventType =
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

export type CreStepKind =
  | "cron"
  | "http"
  | "confidential_http"
  | "evm_read"
  | "evm_write"
  | "compute";

export interface CreStepLog {
  kind: CreStepKind;
  name: string;
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
  summary?: string;
  // Intentionally keep payloads small; store larger objects in artifacts.
  details?: Record<string, unknown>;
}

export interface CreRunEvent {
  id: string;
  runId: string;
  type: CreRunEventType;
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

export interface CreRunPlanStep {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  status?: "pending" | "approved" | "rejected";
}

export interface CreRunPlan {
  version: number;
  updatedAt: string;
  summary?: string;
  steps: CreRunPlanStep[];
}

export interface CreArtifact {
  id: string;
  type:
    | "sapience_conditions"
    | "chainlink_price_feeds"
    | "llm_forecast"
    | "attestation_request"
    | "attestation_result"
    | "error";
  createdAt: string;
  data: unknown;
  evidence?: {
    hash: string;
    cid?: string;
  };
}

export interface CreRun {
  runId: string;
  projectId?: string;
  workflow: "forecasting";
  mode: "local" | "cre";
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
  status?: CreRunStatus;
  parentRunId?: string;
  retryCount?: number;
  currentStepName?: string;
  requiresApproval?: boolean;
  approvalState?: "not_required" | "pending" | "approved" | "rejected";
  approvalReason?: string;
  plan?: CreRunPlan;
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
  steps: CreStepLog[];
  artifacts: CreArtifact[];
}

export interface SapienceCondition {
  id: string;
  question: string;
  shortName?: string | null;
  endTime: number;
}

export interface PriceFeedReading {
  feedName: string;
  feedAddress: `0x${string}`;
  value: string;
  decimals?: number;
  updatedAt?: string;
}

export interface ForecastInput {
  condition: SapienceCondition;
  priceFeeds: PriceFeedReading[];
}

export interface ForecastOutput {
  probability: number; // 0-100
  reasoning: string;
  model: string;
  provider: string;
}

export interface AttestationRequest {
  conditionId: `0x${string}`;
  probability: number;
  reasoning: string;
}

export interface AttestationResult {
  txHash: `0x${string}`;
}
