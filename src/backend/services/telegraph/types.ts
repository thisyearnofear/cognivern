/**
 * Telegraph Protocol Types
 *
 * Type definitions for Telegraph miner integrations, x402 payments,
 * engine API, and verified intelligence responses.
 *
 * Field shapes mirror the live Telegraph node (`/miner-dispatcher/integrations`),
 * the engine (`/engine/v1/subnets`, `/engine/v1/ask`), and the daemon
 * (`/daemon/health`, `/daemon/api/categories`, `/daemon/api/questions`).
 */

export interface TelegraphConfig {
  enabled: boolean;
  nodeUrl: string;
  engineUrl: string;
  daemonUrl: string;
  evmPrivateKey?: string;
  solanaPrivateKey?: string;
  evmNetwork?: string;
  svmNetwork?: string;
  refreshIntervalMs?: number;
  confidenceThreshold?: number;
  inferenceProvider?: string;
}

/** A miner endpoint as served by the node integration registry. */
export interface TelegraphMinerEndpoint {
  path: string;
  method: "GET" | "POST";
  description?: string;
  /** Maps caller-facing param names to provider-facing names. */
  param_map?: Record<string, string>;
  content_type?: string;
  multipart_fields?: string[];
}

/** One scored (or unscored) miner entry from the node registry. */
export interface TelegraphMinerIntegration {
  id: string;
  slug: string;
  kind: string;
  protocol: string;
  name: string;
  description: string;
  endpoints: TelegraphMinerEndpoint[];
  input_schema?: unknown;
  output_schema?: unknown;
  /** Declares which response fields carry the confidence signal. */
  signal_mapping?: {
    confidence_field?: string;
    label_field?: string;
    reason_field?: string;
  };
  supported_intents?: string[];
  base_url?: string;
  wallet_address?: string;
  fee_address?: string;
  activation_status?: "active" | "inactive" | string;
  /** Price per call in micro-USDC (1e-6 USDC). 10000 == $0.01. */
  min_price_usdc?: number;
  total_requests_served?: number;
  scored?: boolean;
  scores?: Array<{
    intent_id: string;
    epoch_id: number;
    rank: number;
    score: number;
    scored_at: string;
  }>;
  status?: "active" | "inactive";
  version?: string;
}

/** Lighter view served by the engine (`/v1/subnets`). */
export interface TelegraphEngineSubnet {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_url: string;
  capabilities: string[];
  cost_per_call: string;
  protocol: string;
}

export interface TelegraphMinerRequest {
  /** Miner id (slug) or name to call directly. Omit for engine-routed. */
  minerId?: string;
  intent?: string;
  params: Record<string, unknown>;
  maxPrice?: string; // USD per call (informational; x402 uses the miner price)
  confidenceThreshold?: number;
}

export interface TelegraphMinerResponse<T = unknown> {
  success: boolean;
  data: T;
  metadata: {
    minerId: string;
    minerName: string;
    /** Confidence (0-1) or null when the miner response carries no signal. */
    confidence: number | null;
    latencyMs: number;
    costUsd: string;
    intent?: string;
    timestamp: string;
    paid?: boolean;
    paymentNetwork?: string;
  };
  error?: string;
}

export interface TelegraphEngineAskRequest {
  query: string;
  intent?: string;
  maxPrice?: string;
  confidenceThreshold?: number;
}

export interface TelegraphEngineAskResponse {
  answer: string;
  minerId: string;
  minerName: string;
  /** Confidence (0-1) or null when the engine response carries no signal. */
  confidence: number | null;
  latencyMs: number;
  costUsd: string;
  timestamp: string;
}

export interface TelegraphX402Payment {
  paymentId: string;
  amount: string; // USDC atomic units
  recipient: string;
  signature: string;
  nonce: string;
  deadline: string;
  settled: boolean;
  txHash?: string;
}

export interface TelegraphIntent {
  name: string;
  category: string;
  description: string;
  minerCount: number;
  requestCount: number;
  avgConfidence?: number;
}

export interface TelegraphNodeStatus {
  healthy: boolean;
  nodeUrl: string;
  minersAvailable: number;
  lastRefresh: string;
}

export interface TelegraphDaemonCategory {
  /** A signal category name, e.g. "POLITICS", "CRYPTO", "CLIMATE". */
  name: string;
  /** Count of collected signals in this category. */
  count?: number;
  /** Average interest score for this category (0-10). */
  avg_interest?: number;
  /** Max interest score in this category (0-10). */
  max_interest?: number;
}

export interface TelegraphDaemonCategoriesResponse {
  categories: string[];
  stats: TelegraphDaemonCategory[];
}

export interface TelegraphDaemonQuestion {
  id?: string;
  type?: string;
  source?: string;
  status?: string;
  created_at?: string;
  signal_hash?: string;
  question?: {
    hash?: string;
    text?: string;
    category?: string;
    interest_score?: number;
    [key: string]: unknown;
  };
  routing?: {
    subnet_id?: string;
    subnet_name?: string;
    miner_slug?: string;
    reasoning?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Weather-specific response types (common use case)
export interface WeatherForecastResponse {
  location: string;
  condition: string;
  temperature: {
    current?: number;
    min: number;
    max: number;
    unit: string;
  };
  precipitation?: number;
  windSpeed?: number;
  stormRisk?: number;
  timestamp: string;
}

// AI detection response types
export interface AIDetectionResponse {
  isAIGenerated: boolean;
  confidence: number;
  model?: string;
  indicators?: string[];
}

// LLM chat response types
export interface ChatCompletionResponse {
  message: string;
  model: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// Deepfake detection response types
export interface DeepfakeDetectionResponse {
  isDeepfake: boolean;
  confidence: number;
  indicators?: string[];
  processingTimeMs?: number;
}
