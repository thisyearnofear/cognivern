/**
 * AnjomanService
 *
 * Client for Anjoman's agent API (`backend.telegraphprotocol.com`) — the
 * delegation surface on top of Telegraph. One API key replaces per-call x402
 * signing: every request settles from the account's funded escrow balance.
 *
 * Where TelegraphService calls one miner, `/agent/chat` hands Anjoman a whole
 * task: it plans, fans out to ranked specialists, retries failures, and
 * returns one combined answer with its `sources` and total `costUsd`.
 *
 * Delivery contract:
 *   POST /agent/chat {message|intent+params, stream:false, maxSpendUsd?}
 *     → 200 {answer, sources, costUsd}             (fast answers)
 *     → 202 {jobId}                                 (anything past ~80s)
 *        → GET /agent/jobs/:id until a terminal status
 *        → POST /agent/jobs/:id/cancel on timeout
 *
 * Polling waits on the job's typed status, never a bare timer — a task is
 * only done when Anjoman says so.
 */

import { Logger } from '@backend/shared/logging/Logger.js';
import type {
  AnjomanConfig,
  AnjomanJob,
  AnjomanSource,
  AnjomanSpendReport,
  AnjomanStatus,
  AnjomanTaskRequest,
  AnjomanTaskResult,
} from './types.js';

const logger = new Logger('AnjomanService');

const DEFAULT_API_URL = 'https://backend.telegraphprotocol.com';
const DEFAULT_TASK_TIMEOUT_MS = 180_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

const COMPLETED_STATUSES = new Set(['completed', 'succeeded', 'done', 'finished', 'resolved']);
const FAILED_STATUSES = new Set([
  'failed',
  'error',
  'cancelled',
  'canceled',
  'rejected',
  'timed_out',
  'timeout',
]);

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Injectable seams so tests don't hit the network or the clock. */
export interface AnjomanServiceDeps {
  fetchFn?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
}

export class AnjomanService {
  private config: AnjomanConfig;
  private fetchFn: FetchFn;
  private sleep: (ms: number) => Promise<void>;

  constructor(config?: Partial<AnjomanConfig>, deps: AnjomanServiceDeps = {}) {
    const apiKey = config?.apiKey ?? process.env.ANJOMAN_API_KEY;
    this.config = {
      // Setting a key is enough to enable; ANJOMAN_ENABLED=false force-disables.
      enabled:
        config?.enabled ??
        this.loadBooleanEnv('ANJOMAN_ENABLED', apiKey !== undefined && apiKey !== ''),
      apiUrl: (config?.apiUrl ?? process.env.ANJOMAN_API_URL ?? DEFAULT_API_URL).replace(
        /\/+$/,
        '',
      ),
      apiKey,
      defaultMaxSpendUsd:
        config?.defaultMaxSpendUsd ?? this.parseNumber(process.env.ANJOMAN_MAX_SPEND_USD),
      taskTimeoutMs:
        config?.taskTimeoutMs ??
        (parseInt(process.env.ANJOMAN_TASK_TIMEOUT_MS ?? '', 10) || DEFAULT_TASK_TIMEOUT_MS),
      pollIntervalMs:
        config?.pollIntervalMs ??
        (parseInt(process.env.ANJOMAN_POLL_INTERVAL_MS ?? '', 10) || DEFAULT_POLL_INTERVAL_MS),
    };
    this.fetchFn = deps.fetchFn ?? ((input, init) => fetch(input, init));
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

    if (!this.config.enabled) {
      logger.info('Anjoman integration disabled (no ANJOMAN_API_KEY / ANJOMAN_ENABLED=false)');
      return;
    }
    logger.info('Anjoman service initialized', {
      apiUrl: this.config.apiUrl,
      hasKey: !!this.config.apiKey,
      defaultMaxSpendUsd: this.config.defaultMaxSpendUsd,
    });
  }

  private loadBooleanEnv(key: string, defaultValue: boolean): boolean {
    const val = process.env[key];
    if (val === undefined) return defaultValue;
    return val.toLowerCase() === 'true' || val === '1';
  }

  private parseNumber(raw: string | undefined): number | undefined {
    if (!raw) return undefined;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /** Enabled AND a key configured — the honest readiness gate. */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  getConfig(): AnjomanConfig {
    return this.config;
  }

  private headers(withBody = false): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      Accept: 'application/json',
    };
    if (withBody) headers['Content-Type'] = 'application/json';
    return headers;
  }

  private requireEnabled(): void {
    if (!this.isEnabled()) {
      throw new Error(
        'Anjoman is not enabled — set ANJOMAN_API_KEY (anjoman.ai/dashboard/api-keys)',
      );
    }
  }

  /**
   * Run one delegated task. Returns a terminal result — completed answers or
   * a failed/cancelled disposition; never resolves early on a pending job.
   */
  async runTask(request: AnjomanTaskRequest): Promise<AnjomanTaskResult> {
    const startTime = Date.now();
    const finish = (partial: Omit<AnjomanTaskResult, 'latencyMs'>): AnjomanTaskResult => ({
      ...partial,
      latencyMs: Date.now() - startTime,
    });

    if (!this.isEnabled()) {
      return finish({
        success: false,
        status: 'failed',
        error: 'Anjoman is not enabled — set ANJOMAN_API_KEY',
      });
    }

    const message = request.message?.trim();
    if (!message && !request.intent) {
      return finish({
        success: false,
        status: 'failed',
        error: 'Either message or intent (+ params) is required',
      });
    }

    const body: Record<string, unknown> = { stream: false };
    if (message) body.message = message;
    if (request.intent) {
      body.intent = request.intent;
      if (request.params) body.params = request.params;
    }
    if (request.conversationId) body.conversationId = request.conversationId;
    const maxSpendUsd = request.maxSpendUsd ?? this.config.defaultMaxSpendUsd;
    if (maxSpendUsd !== undefined) body.maxSpendUsd = maxSpendUsd;

    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.apiUrl}/agent/chat`, {
        method: 'POST',
        headers: this.headers(true),
        body: JSON.stringify(body),
      });
    } catch (error) {
      logger.error('Anjoman task request failed', { error });
      return finish({
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (response.status === 202) {
      const jobId = await this.readJobId(response);
      if (!jobId) {
        return finish({
          success: false,
          status: 'failed',
          error: 'Anjoman accepted the task but returned no jobId',
        });
      }
      return this.awaitJob(jobId, request.timeoutMs ?? this.config.taskTimeoutMs, startTime);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const hint = response.status === 429 ? ' (rate limited — 30 req/min per key)' : '';
      return finish({
        success: false,
        status: 'failed',
        error: `Anjoman task failed: ${response.status}${hint} ${text}`.trim(),
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    return finish(this.resultFromPayload(data, { status: 'completed' }));
  }

  /** Poll a running job until Anjoman reports a terminal status. */
  private async awaitJob(
    jobId: string,
    timeoutMs: number,
    startTime: number,
  ): Promise<AnjomanTaskResult> {
    const deadline = startTime + timeoutMs;

    while (Date.now() < deadline) {
      const job = await this.getJob(jobId);
      const status = (job?.status ?? '').toLowerCase();

      if (COMPLETED_STATUSES.has(status)) {
        return {
          ...this.resultFromPayload(job as Record<string, unknown>, {
            status: 'completed',
          }),
          jobId,
          latencyMs: Date.now() - startTime,
        };
      }
      if (FAILED_STATUSES.has(status)) {
        return {
          success: false,
          status: status === 'cancelled' || status === 'canceled' ? 'cancelled' : 'failed',
          jobId,
          error: `Anjoman job ${jobId} ended with status "${job?.status}"`,
          latencyMs: Date.now() - startTime,
        };
      }
      await this.sleep(this.config.pollIntervalMs);
    }

    // Timeout: try to stop the spend, then report. A cancel failure doesn't
    // hide the timeout — the job is still flagged for the operator.
    try {
      await this.cancelJob(jobId);
    } catch (error) {
      logger.warn('Anjoman job cancel after timeout failed', { jobId, error });
    }
    return {
      success: false,
      status: 'cancelled',
      jobId,
      error: `Anjoman job ${jobId} did not finish within ${timeoutMs}ms — cancelled`,
      latencyMs: Date.now() - startTime,
    };
  }

  /** Normalizes the 200 answer body or a terminal job payload. */
  private resultFromPayload(
    data: Record<string, unknown>,
    overrides: Pick<AnjomanTaskResult, 'status'>,
  ): Omit<AnjomanTaskResult, 'latencyMs'> {
    const answer = this.extractAnswer(data);
    return {
      success: true,
      status: overrides.status,
      answer,
      data: this.parseStructuredAnswer(answer, data),
      sources: this.extractSources(data),
      costUsd: this.extractCostUsd(data),
      conversationId: typeof data.conversationId === 'string' ? data.conversationId : undefined,
      jobId: typeof data.jobId === 'string' ? data.jobId : undefined,
    };
  }

  private extractAnswer(data: Record<string, unknown>): string | undefined {
    for (const key of ['answer', 'result', 'message', 'response', 'text']) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return undefined;
  }

  /** JSON answers surface as `data` so callers can inspect verdict fields. */
  private parseStructuredAnswer(answer: string | undefined, raw: Record<string, unknown>): unknown {
    if (typeof raw.data === 'object' && raw.data !== null) return raw.data;
    if (!answer) return undefined;
    const trimmed = answer.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  private extractSources(data: Record<string, unknown>): AnjomanSource[] | undefined {
    const raw = data.sources ?? data.deliveries;
    return Array.isArray(raw) ? (raw as AnjomanSource[]) : undefined;
  }

  private extractCostUsd(data: Record<string, unknown>): string | undefined {
    const raw = data.costUsd ?? data.cost_usd ?? data.cost;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw.toFixed(4);
    if (typeof raw === 'string' && raw.trim()) return raw;
    return undefined;
  }

  private async readJobId(response: Response): Promise<string | null> {
    try {
      const data = (await response.json()) as Record<string, unknown>;
      const id = data.jobId ?? data.job_id ?? data.id;
      return typeof id === 'string' && id ? id : null;
    } catch {
      return null;
    }
  }

  /** GET /agent/jobs/:id — returns undefined on non-ok so polls keep trying. */
  async getJob(jobId: string): Promise<AnjomanJob | undefined> {
    this.requireEnabled();
    const response = await this.fetchFn(
      `${this.config.apiUrl}/agent/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET', headers: this.headers() },
    );
    if (!response.ok) {
      logger.warn('Anjoman job poll failed', { jobId, status: response.status });
      return undefined;
    }
    return (await response.json()) as AnjomanJob;
  }

  /** POST /agent/jobs/:id/cancel — closing the connection does NOT stop a job. */
  async cancelJob(jobId: string): Promise<void> {
    this.requireEnabled();
    const response = await this.fetchFn(
      `${this.config.apiUrl}/agent/jobs/${encodeURIComponent(jobId)}/cancel`,
      { method: 'POST', headers: this.headers() },
    );
    if (!response.ok) {
      throw new Error(`Anjoman cancel failed: ${response.status} ${await response.text()}`);
    }
  }

  /** GET /engine/escrow/balance — the balance API-key calls settle from. */
  async getEscrowBalance(): Promise<string | undefined> {
    this.requireEnabled();
    const response = await this.fetchFn(`${this.config.apiUrl}/engine/escrow/balance`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`Anjoman escrow balance failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as Record<string, unknown>;
    const raw = data.balance ?? data.balance_usdc ?? data.usdc ?? data.amount;
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
    if (typeof raw === 'string' && raw.trim()) return raw;
    return undefined;
  }

  /** GET /agent/spend — per-job costs plus totals. */
  async getSpend(): Promise<AnjomanSpendReport> {
    this.requireEnabled();
    const response = await this.fetchFn(`${this.config.apiUrl}/agent/spend`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`Anjoman spend report failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as Record<string, unknown>;
    const rawEntries = data.jobs ?? data.entries ?? data.spend ?? [];
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const totalRaw = data.totalCostUsd ?? data.total_cost_usd ?? data.total;
    return {
      entries: entries as AnjomanSpendReport['entries'],
      totalCostUsd:
        typeof totalRaw === 'number'
          ? totalRaw.toFixed(4)
          : typeof totalRaw === 'string'
            ? totalRaw
            : undefined,
      raw: data,
    };
  }

  /**
   * Status for /api/telegraph/status — key presence is the readiness gate;
   * a best-effort balance read proves the key actually works.
   */
  async getStatus(): Promise<AnjomanStatus> {
    const base: AnjomanStatus = {
      enabled: this.config.enabled,
      apiUrl: this.config.apiUrl,
      ready: this.isEnabled(),
    };
    if (!this.isEnabled()) return base;
    try {
      const escrowBalanceUsd = await this.getEscrowBalance();
      return { ...base, reachable: true, escrowBalanceUsd };
    } catch (error) {
      return {
        ...base,
        reachable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Singleton instance
export const anjomanService = new AnjomanService();
