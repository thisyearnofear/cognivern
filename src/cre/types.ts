export type ChainId = number;

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
}

export interface CreRun {
  runId: string;
  projectId?: string;
  workflow: "forecasting";
  mode: "local" | "cre";
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
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
