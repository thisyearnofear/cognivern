/**
 * TelegraphService
 *
 * Client for Telegraph Protocol verified AI intelligence network.
 * Handles miner discovery, x402 micropayments, and confidence-based routing.
 *
 * Architecture:
 * - Auto-discovers live miners from the Telegraph node (`/miner-dispatcher/integrations`)
 * - Routes inference through the Engine (`/engine/v1/ask`) or a specific miner
 * - Handles x402 payments transparently via `@x402/fetch` (~$0.01 per call)
 * - Enforces confidence thresholds (low confidence → held for review)
 * - Records all calls as governed spend with full audit trail
 *
 * Reuses the existing governance flow:
 *   TelegraphService.callMiner / engineAsk
 *     → confidence check
 *       → GovernanceClient.previewSpend (if confidence >= threshold)
 *         → approved/held/denied
 *           → CRE artifact + audit trail
 *
 * Live endpoints (verified 2026-09-01):
 *   Node:     {nodeUrl}/status, /miner-dispatcher/integrations
 *   Engine:   {nodeUrl}/engine/v1/subnets, /engine/v1/ask, /engine/v1/ask/:subnetId
 *   Daemon:   {nodeUrl}/daemon/health, /daemon/api/categories, /daemon/api/questions
 */

import { Logger } from "@backend/shared/logging/Logger.js";
import {
  TelegraphConfig,
  TelegraphMinerIntegration,
  TelegraphMinerRequest,
  TelegraphMinerResponse,
  TelegraphEngineAskRequest,
  TelegraphEngineAskResponse,
  TelegraphEngineSubnet,
  TelegraphIntent,
  TelegraphDaemonCategory,
  TelegraphDaemonQuestion,
} from "./types.js";
import { createPaymentAwareFetch, PaymentAwareFetch } from "./x402.js";

const logger = new Logger("TelegraphService");

/** Micro-USDC → USDC string (10000 micro-USDC == $0.01). */
function microUsdcToUsd(microUsdc?: number): string {
  if (microUsdc === undefined || microUsdc === null || isNaN(microUsdc)) {
    return "0.01";
  }
  return (microUsdc / 1_000_000).toFixed(4);
}

export class TelegraphService {
  /** Resolved config: all fields required except the optional private keys. */
  private config: Required<Omit<TelegraphConfig, "evmPrivateKey" | "solanaPrivateKey">> &
    Pick<TelegraphConfig, "evmPrivateKey" | "solanaPrivateKey">;
  private minerCache: Map<string, TelegraphMinerIntegration> = new Map();
  private engineSubnetCache: Map<string, TelegraphEngineSubnet> = new Map();
  private lastRefresh: number = 0;
  private paymentFetch: PaymentAwareFetch | null | undefined = undefined;
  private paymentInitError: string | null = null;

  constructor(config?: Partial<TelegraphConfig>) {
    this.config = {
      enabled: config?.enabled ?? this.loadBooleanEnv("TELEGRAPH_ENABLED", false),
      nodeUrl: config?.nodeUrl ?? process.env.TELEGRAPH_NODE_URL ?? "http://13.237.89.59:7044",
      engineUrl:
        config?.engineUrl ??
        process.env.TELEGRAPH_ENGINE_URL ??
        "http://13.237.89.59:7044/engine",
      daemonUrl:
        config?.daemonUrl ??
        process.env.TELEGRAPH_DAEMON_URL ??
        "http://13.237.89.59:7044/daemon",
      evmPrivateKey: config?.evmPrivateKey ?? process.env.TELEGRAPH_EVM_PRIVATE_KEY,
      solanaPrivateKey: config?.solanaPrivateKey ?? process.env.TELEGRAPH_SOLANA_PRIVATE_KEY,
      evmNetwork: config?.evmNetwork ?? process.env.TELEGRAPH_EVM_NETWORK ?? "eip155:*",
      svmNetwork: config?.svmNetwork ?? process.env.TELEGRAPH_SVM_NETWORK ?? "solana:*",
      refreshIntervalMs: config?.refreshIntervalMs ?? parseInt(process.env.TELEGRAPH_REFRESH_INTERVAL_MS ?? "300000", 10),
      confidenceThreshold: config?.confidenceThreshold ?? parseFloat(process.env.TELEGRAPH_CONFIDENCE_THRESHOLD ?? "0.7"),
      inferenceProvider: config?.inferenceProvider ?? process.env.TELEGRAPH_INFERENCE_PROVIDER ?? "",
    };

    if (!this.config.enabled) {
      logger.info("Telegraph integration disabled (TELEGRAPH_ENABLED=false)");
      return;
    }

    if (!this.config.evmPrivateKey && !this.config.solanaPrivateKey) {
      logger.warn("Telegraph enabled but no private keys set — x402 payments will fail");
    } else {
      logger.info("Telegraph service initialized", {
        nodeUrl: this.config.nodeUrl,
        engineUrl: this.config.engineUrl,
        daemonUrl: this.config.daemonUrl,
        confidenceThreshold: this.config.confidenceThreshold,
        hasEvmKey: !!this.config.evmPrivateKey,
        hasSolanaKey: !!this.config.solanaPrivateKey,
      });
    }
  }

  private loadBooleanEnv(key: string, defaultValue: boolean): boolean {
    const val = process.env[key];
    if (val === undefined) return defaultValue;
    return val.toLowerCase() === "true" || val === "1";
  }

  /**
   * True when the integration is enabled, configured with at least one payment
   * key, and a payment signer was constructed successfully. This is the honest
   * readiness gate: without a working signer, paid Telegraph calls would 402.
   */
  async isReady(): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (!this.config.evmPrivateKey && !this.config.solanaPrivateKey) return false;
    const pf = await this.getPaymentFetch();
    return pf !== null;
  }

  /** Legacy sync check — only reflects enabled + key presence, not signer health. */
  isEnabled(): boolean {
    return this.config.enabled && (!!this.config.evmPrivateKey || !!this.config.solanaPrivateKey);
  }

  getEnabled(): boolean {
    return this.config.enabled;
  }

  getConfidenceThreshold(): number {
    return this.config.confidenceThreshold;
  }

  getConfig(): Required<Omit<TelegraphConfig, "evmPrivateKey" | "solanaPrivateKey">> &
    Pick<TelegraphConfig, "evmPrivateKey" | "solanaPrivateKey"> {
    return this.config;
  }

  /** Lazy, memoized payment-aware fetch. Returns null if no signer could be built. */
  async getPaymentFetch(): Promise<PaymentAwareFetch | null> {
    if (this.paymentFetch !== undefined) return this.paymentFetch;
    this.paymentFetch = await createPaymentAwareFetch({
      evmPrivateKey: this.config.evmPrivateKey,
      evmNetwork: this.config.evmNetwork,
      solanaPrivateKey: this.config.solanaPrivateKey,
      svmNetwork: this.config.svmNetwork,
    });
    if (this.paymentFetch === null) {
      this.paymentInitError =
        "No x402 payment signer could be constructed (set TELEGRAPH_EVM_PRIVATE_KEY or TELEGRAPH_SOLANA_PRIVATE_KEY)";
      logger.warn(this.paymentInitError);
    }
    return this.paymentFetch;
  }

  getPaymentInitError(): string | null {
    return this.paymentInitError;
  }

  // ---------------------------------------------------------------------------
  // Miner discovery
  // ---------------------------------------------------------------------------

  /**
   * Fetch live miner integrations from the Telegraph node.
   */
  async refreshMiners(): Promise<TelegraphMinerIntegration[]> {
    if (!this.config.enabled) {
      return [];
    }

    const now = Date.now();
    if (
      this.config.refreshIntervalMs > 0 &&
      this.minerCache.size > 0 &&
      now - this.lastRefresh < this.config.refreshIntervalMs
    ) {
      return Array.from(this.minerCache.values());
    }

    try {
      const url = `${this.config.nodeUrl}/miner-dispatcher/integrations`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Telegraph node returned ${response.status}: ${await response.text()}`);
      }

      const integrations = (await response.json()) as TelegraphMinerIntegration[];

      // Update cache
      this.minerCache.clear();
      for (const integration of integrations) {
        const id = integration.id ?? integration.slug ?? integration.name;
        this.minerCache.set(id, integration);
        if (integration.slug) this.minerCache.set(integration.slug, integration);
        this.minerCache.set(integration.name, integration);
      }

      this.lastRefresh = now;
      logger.info(`Refreshed ${integrations.length} Telegraph miners`);

      return integrations;
    } catch (error) {
      logger.error("Failed to refresh Telegraph miners", { error });
      throw error;
    }
  }

  /**
   * Get available miners, optionally filtered by intent.
   */
  async getMiners(intent?: string): Promise<TelegraphMinerIntegration[]> {
    const miners = await this.refreshMiners();

    if (!intent) {
      return miners;
    }

    return miners.filter((m) => m.supported_intents?.includes(intent));
  }

  /**
   * Get a specific miner by id, slug, or name.
   */
  async getMiner(minerIdOrName: string): Promise<TelegraphMinerIntegration | null> {
    await this.refreshMiners();

    return this.minerCache.get(minerIdOrName) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Engine API
  // ---------------------------------------------------------------------------

  /**
   * List the miners the Engine can route to (lighter view than the node registry).
   */
  async listEngineSubnets(): Promise<TelegraphEngineSubnet[]> {
    const url = `${this.config.engineUrl}/v1/subnets`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Engine list subnets failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { count?: number; miners?: TelegraphEngineSubnet[] };
    const miners = data.miners ?? [];
    this.engineSubnetCache.clear();
    for (const m of miners) {
      this.engineSubnetCache.set(m.id, m);
      this.engineSubnetCache.set(m.slug, m);
    }
    return miners;
  }

  /**
   * Auto-routed inference via the Telegraph Engine.
   *
   * The Engine picks the best-ranked miner for your query. Paid via x402.
   */
  async engineAsk(request: TelegraphEngineAskRequest): Promise<TelegraphEngineAskResponse> {
    const paymentFetch = await this.getPaymentFetch();
    if (!paymentFetch) {
      throw new Error(
        this.paymentInitError ?? "Telegraph is not enabled or no payment signer configured",
      );
    }

    const startTime = Date.now();
    const url = `${this.config.engineUrl}/v1/ask`;

    try {
      const response = await paymentFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: request.query }),
      });

      if (!response.ok) {
        throw new Error(`Engine ask failed: ${response.status} ${await response.text()}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const latencyMs = Date.now() - startTime;

      const minerId = String(data.miner_id ?? data.subnet_id ?? data.minerId ?? data.id ?? "engine-routed");
      const minerName = String(data.miner_name ?? data.minerName ?? data.name ?? "Auto-routed");
      const confidence = this.extractNumber(data.confidence, data.confidence_score, data.score);

      // Real cost from the routed miner's listed price when available.
      const subnet = this.engineSubnetCache.get(minerId) ?? this.engineSubnetCache.get(minerName);
      const costUsd = subnet?.cost_per_call && subnet.cost_per_call !== "0.00"
        ? subnet.cost_per_call
        : "0.01";

      return {
        answer: this.extractAnswer(data),
        minerId,
        minerName,
        confidence,
        latencyMs,
        costUsd,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Telegraph engine ask failed", { query: request.query, error });
      throw error;
    }
  }

  /**
   * Direct inference through a specific Engine miner by ID (paid via x402).
   * Mirrors `tg_engine_ask_subnet`.
   */
  async engineAskSubnet(
    subnetId: string,
    method: "GET" | "POST",
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<{ minerId: string; minerName: string; data: unknown; confidence: number | null; latencyMs: number; costUsd: string }> {
    const paymentFetch = await this.getPaymentFetch();
    if (!paymentFetch) {
      throw new Error(this.paymentInitError ?? "No payment signer configured");
    }

    const startTime = Date.now();
    const url = `${this.config.engineUrl}/v1/ask/${subnetId}`;

    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ method, endpoint, payload }),
    };

    const response = await paymentFetch(url, init);
    if (!response.ok) {
      throw new Error(`Engine ask subnet failed: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();

    const subnet = this.engineSubnetCache.get(subnetId);
    return {
      minerId: subnetId,
      minerName: subnet?.name ?? `subnet-${subnetId}`,
      data,
      confidence: this.extractConfidenceFromData(data),
      latencyMs: Date.now() - startTime,
      costUsd: subnet?.cost_per_call && subnet.cost_per_call !== "0.00" ? subnet.cost_per_call : "0.01",
    };
  }

  // ---------------------------------------------------------------------------
  // Direct miner calls
  // ---------------------------------------------------------------------------

  /**
   * Call a specific miner directly through the node's miner dispatcher.
   *
   * URL: {nodeUrl}/miner-dispatcher/v1/:subnetId/:path (paid via x402)
   */
  async callMiner<T = unknown>(request: TelegraphMinerRequest): Promise<TelegraphMinerResponse<T>> {
    const paymentFetch = await this.getPaymentFetch();
    if (!paymentFetch) {
      return {
        success: false,
        data: null as T,
        metadata: {
          minerId: request.minerId ?? "unknown",
          minerName: "unknown",
          confidence: 0,
          latencyMs: 0,
          costUsd: "0",
          timestamp: new Date().toISOString(),
        },
        error:
          this.paymentInitError ?? "Telegraph is not enabled or no payment signer configured",
      };
    }

    const startTime = Date.now();

    try {
      // Get miner details
      const miner = request.minerId ? await this.getMiner(request.minerId) : null;

      if (request.minerId && !miner) {
        throw new Error(`Miner ${request.minerId} not found`);
      }

      if (!miner) {
        throw new Error(
          "Direct miner call requires a minerId; use engineAsk for auto-routed inference",
        );
      }

      const endpoint = miner.endpoints[0];
      if (!endpoint) {
        throw new Error(`Miner ${miner.name} has no endpoints`);
      }

      const subnetId = miner.id;
      const url = `${this.config.nodeUrl}/miner-dispatcher/v1/${subnetId}${endpoint.path}`;
      const upperMethod = (endpoint.method ?? "POST").toUpperCase();

      // Map caller-facing params to provider-facing names.
      const paramMap = endpoint.param_map ?? {};
      const mappedParams: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(request.params)) {
        if (v !== undefined && v !== null) {
          mappedParams[paramMap[k] ?? k] = v;
        }
      }

      const contentType = endpoint.content_type ?? "application/json";
      let body: BodyInit;
      let headers: Record<string, string> = { Accept: "application/json" };

      if (endpoint.multipart_fields && endpoint.multipart_fields.length > 0) {
        const form = new FormData();
        for (const [k, v] of Object.entries(mappedParams)) {
          form.append(k, String(v));
        }
        body = form;
      } else {
        body = JSON.stringify(mappedParams);
        headers["Content-Type"] = contentType;
      }

      const response = await paymentFetch(url, {
        method: upperMethod,
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Miner call failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as T;
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        data,
        metadata: {
          minerId: miner.id,
          minerName: miner.name,
          confidence: this.extractConfidenceFromData(data, miner),
          latencyMs,
          costUsd: microUsdcToUsd(miner.min_price_usdc),
          intent: request.intent,
          timestamp: new Date().toISOString(),
          paid: true,
          paymentNetwork: this.config.evmPrivateKey ? this.config.evmNetwork : this.config.svmNetwork,
        },
      };
    } catch (error) {
      logger.error("Telegraph miner call failed", {
        minerId: request.minerId,
        intent: request.intent,
        error,
      });

      return {
        success: false,
        data: null as T,
        metadata: {
          minerId: request.minerId ?? "unknown",
          minerName: "unknown",
          confidence: 0,
          latencyMs: Date.now() - startTime,
          costUsd: "0",
          timestamp: new Date().toISOString(),
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Confidence & helpers
  // ---------------------------------------------------------------------------

  /**
   * Check if a miner response meets the confidence threshold.
   * A null/unknown confidence NEVER auto-approves (fail-safe → held).
   */
  meetsConfidenceThreshold(confidence: number | null | undefined, customThreshold?: number): boolean {
    if (confidence === null || confidence === undefined || isNaN(confidence)) {
      return false;
    }
    const threshold = customThreshold ?? this.config.confidenceThreshold;
    return confidence >= threshold;
  }

  /**
   * Extract a confidence score from a miner response.
   *
   * Priority:
   *   1. The miner's declared `signal_mapping.confidence_field` (e.g. "risk")
   *   2. Common explicit fields: confidence, score, certainty
   *   3. Nested metadata
   * Returns null when no confidence signal exists (never fabricates a number).
   */
  extractConfidenceFromData(data: unknown, miner?: TelegraphMinerIntegration | null): number | null {
    if (typeof data !== "object" || data === null) return null;

    const record = data as Record<string, unknown>;

    // 1. Declared confidence field from the miner's signal mapping.
    const confidenceField = miner?.signal_mapping?.confidence_field;
    if (confidenceField) {
      const fieldValue = this.dig(record, confidenceField);
      const parsed = typeof fieldValue === "number" ? fieldValue : parseFloat(String(fieldValue ?? ""));
      if (!isNaN(parsed)) return this.clamp01(parsed);
    }

    // 2. Common explicit fields.
    for (const key of ["confidence", "score", "certainty"]) {
      const value = record[key];
      if (typeof value === "number" && !isNaN(value)) return this.clamp01(value);
    }

    // 3. Nested metadata.
    for (const nested of [record.metadata, record.meta]) {
      if (typeof nested === "object" && nested !== null) {
        for (const key of ["confidence", "score", "certainty"]) {
          const value = (nested as Record<string, unknown>)[key];
          if (typeof value === "number" && !isNaN(value)) return this.clamp01(value);
        }
      }
    }

    return null;
  }

  private extractNumber(...values: unknown[]): number | null {
    for (const v of values) {
      const parsed = typeof v === "number" ? v : parseFloat(String(v ?? ""));
      if (!isNaN(parsed)) return this.clamp01(parsed);
    }
    return null;
  }

  private extractAnswer(data: Record<string, unknown>): string {
    if (typeof data.answer === "string") return data.answer;
    if (typeof data.message === "string") return data.message;
    if (typeof data.response === "string") return data.response;
    if (typeof data.result === "string") return data.result;
    if (typeof data.text === "string") return data.text;
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }

  private dig(record: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc !== null && typeof acc === "object") {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, record);
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  // ---------------------------------------------------------------------------
  // Node + daemon status
  // ---------------------------------------------------------------------------

  /**
   * Get Telegraph node status.
   */
  async getNodeStatus(): Promise<{
    healthy: boolean;
    nodeUrl: string;
    minersAvailable: number;
    lastRefresh: string;
  }> {
    try {
      const miners = await this.refreshMiners();

      return {
        healthy: true,
        nodeUrl: this.config.nodeUrl,
        minersAvailable: miners.length,
        lastRefresh: new Date(this.lastRefresh).toISOString(),
      };
    } catch (error) {
      logger.error("Telegraph node health check failed", { error });
      return {
        healthy: false,
        nodeUrl: this.config.nodeUrl,
        minersAvailable: 0,
        lastRefresh: new Date(this.lastRefresh).toISOString(),
      };
    }
  }

  /**
   * Get daemon health (free — no payment).
   */
  async getDaemonHealth(): Promise<{ healthy: boolean; status?: string; time?: string }> {
    try {
      const response = await fetch(`${this.config.daemonUrl}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return { healthy: false };
      }
      const data = (await response.json()) as { status?: string; time?: string };
      return { healthy: data.status === "ok", status: data.status, time: data.time };
    } catch (error) {
      logger.error("Telegraph daemon health check failed", { error });
      return { healthy: false };
    }
  }

  /**
   * List daemon signal categories (free — no payment).
   *
   * The daemon returns `{ categories: string[], stats: [{category, count,
   * avg_interest, max_interest}] }`. The stats array carries the real per-
   * category counts and interest — used for the signal dashboard.
   */
  async getDaemonCategories(): Promise<{
    categories: string[];
    stats: TelegraphDaemonCategory[];
  }> {
    const response = await fetch(`${this.config.daemonUrl}/api/categories`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Daemon categories failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      categories?: string[];
      stats?: TelegraphDaemonCategory[];
    };
    return {
      categories: data.categories ?? [],
      stats: data.stats ?? [],
    };
  }

  /**
   * Query daemon-collected signals (free — no payment).
   *
   * The daemon returns `{ results: [...] }` where each result carries the
   * question text, category, interest score, source, and the miner the
   * daemon would route it to.
   */
  async getDaemonQuestions(query: Record<string, string | number | undefined> = {}): Promise<{
    results: TelegraphDaemonQuestion[];
  }> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    const response = await fetch(
      `${this.config.daemonUrl}/api/questions${qs ? `?${qs}` : ""}`,
      { method: "GET", headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`Daemon questions failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      results?: TelegraphDaemonQuestion[];
    };
    return { results: data.results ?? [] };
  }

  // ---------------------------------------------------------------------------
  // Intents
  // ---------------------------------------------------------------------------

  /**
   * Get available intents and their miner counts.
   */
  async getIntents(): Promise<TelegraphIntent[]> {
    const miners = await this.refreshMiners();

    // Group miners by intent
    const intentMap = new Map<string, TelegraphMinerIntegration[]>();

    for (const miner of miners) {
      if (miner.supported_intents) {
        for (const intent of miner.supported_intents) {
          if (!intentMap.has(intent)) {
            intentMap.set(intent, []);
          }
          intentMap.get(intent)!.push(miner);
        }
      }
    }

    // Convert to intent list
    const intents: TelegraphIntent[] = [];
    for (const [name, minerList] of intentMap.entries()) {
      intents.push({
        name,
        category: this.categorizeIntent(name),
        description: `${minerList.length} miners available`,
        minerCount: minerList.length,
        requestCount: minerList.reduce((sum, m) => sum + (m.total_requests_served ?? 0), 0),
      });
    }

    return intents;
  }

  private categorizeIntent(intent: string): string {
    const upper = intent.toUpperCase();
    if (upper.includes("WEATHER") || upper.includes("FORECAST") || upper.includes("STORM")) return "weather";
    if (upper.includes("CHAT") || upper.includes("LLM") || upper.includes("COMPLETION") || upper.includes("GENERATION")) return "llm";
    if (upper.includes("DETECT") || upper.includes("AI") || upper.includes("DEEPFAKE") || upper.includes("VERIFICATION") || upper.includes("AUTHENTIC")) return "detection";
    if (upper.includes("PRICE") || upper.includes("CRYPTO") || upper.includes("FINANCIAL") || upper.includes("TVL") || upper.includes("BALANCE")) return "financial";
    return "other";
  }
}

// Singleton instance
export const telegraphService = new TelegraphService();
