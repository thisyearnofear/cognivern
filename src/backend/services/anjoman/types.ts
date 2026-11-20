/**
 * Anjoman API types
 *
 * Field shapes mirror the Anjoman agent API served at
 * `https://backend.telegraphprotocol.com`:
 *   POST /agent/chat          → {answer, sources, costUsd} or 202 {jobId}
 *   GET  /agent/jobs/:id      → {status, costUsd, answer}
 *   POST /agent/jobs/:id/cancel
 *   GET  /engine/escrow/balance
 *   GET  /agent/spend
 *   GET  /agent/payment-methods
 *
 * Auth is a Bearer API key issued from anjoman.ai/dashboard/api-keys — every
 * call settles from the account's funded balance instead of a per-call x402
 * signature. Keys are rate-limited to 30 requests/minute.
 */

export interface AnjomanConfig {
  enabled: boolean;
  /** API base URL, no trailing slash. */
  apiUrl: string;
  apiKey?: string;
  /** Per-task spend ceiling forwarded as `maxSpendUsd` when the caller does not set one. */
  defaultMaxSpendUsd?: number;
  /** Wall-clock cap for one task including async-job polling. */
  taskTimeoutMs: number;
  /** Delay between GET /agent/jobs/:id polls. */
  pollIntervalMs: number;
}

export interface AnjomanTaskRequest {
  /** Plain-language task. Required unless `intent` + `params` are used. */
  message?: string;
  /** Canonical intent call — skips Anjoman's interpretation step. */
  intent?: string;
  params?: Record<string, unknown>;
  /** Continue an earlier Anjoman conversation. */
  conversationId?: string;
  /** Cap what this task may spend, in USD. */
  maxSpendUsd?: number;
  /** Per-call timeout override (ms). */
  timeoutMs?: number;
}

/** One contributor to an Anjoman answer (a ranked specialist that was paid). */
export interface AnjomanSource {
  minerId?: string;
  minerName?: string;
  intent?: string;
  costUsd?: string;
  [key: string]: unknown;
}

export interface AnjomanTaskResult {
  success: boolean;
  /** Terminal task disposition. */
  status: 'completed' | 'failed' | 'cancelled';
  answer?: string;
  /** Structured answer payload when Anjoman returns JSON. */
  data?: unknown;
  sources?: AnjomanSource[];
  costUsd?: string;
  /** Present when the task ran through the async job path. */
  jobId?: string;
  conversationId?: string;
  latencyMs: number;
  error?: string;
}

export interface AnjomanJob {
  id?: string;
  status?: string;
  answer?: string;
  sources?: AnjomanSource[];
  costUsd?: string | number;
  conversationId?: string;
  [key: string]: unknown;
}

export interface AnjomanSpendEntry {
  jobId?: string;
  costUsd?: string | number;
  [key: string]: unknown;
}

export interface AnjomanSpendReport {
  entries: AnjomanSpendEntry[];
  totalCostUsd?: string;
  raw: unknown;
}

export interface AnjomanStatus {
  enabled: boolean;
  apiUrl: string;
  /** True when a key is configured — the honest analogue of paymentReady. */
  ready: boolean;
  /** Set when a live balance read succeeded. */
  escrowBalanceUsd?: string;
  reachable?: boolean;
  error?: string;
}
