/**
 * HydraDB HTTP client — thin wrapper over the HydraDB v2 REST API.
 *
 * No external SDK dependency: cognivern already speaks HTTP everywhere, and a
 * raw client keeps the integration fully toggleable (HYDRADB_ENABLED) with zero
 * install footprint when disabled. The official @hydradb/sdk returns a
 * {success,data,error,meta} envelope; this client mirrors that contract and
 * unwraps `.data` for callers.
 *
 * Docs: https://docs.hydradb.com  ·  API-Version: 2  ·  Base: https://api.hydradb.com
 *
 * All methods throw HydraDbError on non-2xx / network failure. Retryable
 * status codes (429/500/503) are retried with bounded exponential backoff.
 */

import logger from "@backend/utils/logger.js";
import { config } from "@/config.js";

export interface HydraDbEnvelope<T = unknown> {
  success: boolean;
  data: T;
  error: { code?: string; message?: string } | null;
  meta?: {
    request_id?: string;
    latency_ms?: number;
    deprecation?: unknown[];
  };
}

export class HydraDbError extends Error {
  status?: number;
  code?: string;
  requestId?: string;
  retryable: boolean;

  constructor(message: string, opts?: {
    status?: number;
    code?: string;
    requestId?: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = "HydraDbError";
    this.status = opts?.status;
    this.code = opts?.code;
    this.requestId = opts?.requestId;
    this.retryable = opts?.retryable ?? false;
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 503]);
const RETRYABLE_CODES = new Set([
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
]);

export class HydraDbClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;

  constructor(opts?: {
    apiKey?: string;
    baseUrl?: string;
    apiVersion?: string;
    timeoutMs?: number;
  }) {
    this.apiKey = opts?.apiKey ?? config.HYDRADB_API_KEY ?? "";
    this.baseUrl = (opts?.baseUrl ?? config.HYDRADB_BASE_URL).replace(/\/$/, "");
    this.apiVersion = opts?.apiVersion ?? config.HYDRADB_API_VERSION;
    this.timeoutMs = opts?.timeoutMs ?? config.HYDRADB_REQUEST_TIMEOUT_MS;

    if (!this.apiKey) {
      throw new HydraDbError(
        "HYDRADB_API_KEY is not set — cannot initialize HydraDbClient",
        { retryable: false },
      );
    }
  }

  /** True when the integration is enabled and a key is present. */
  static isEnabled(): boolean {
    return Boolean(config.HYDRADB_ENABLED && config.HYDRADB_API_KEY);
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "API-Version": this.apiVersion,
    };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  /**
   * Core request method with bounded retry on 429/500/503.
   * Returns the parsed envelope; callers read from `.data`.
   */
  private async request<T = unknown>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    opts?: {
      query?: Record<string, string | string[] | undefined>;
      jsonBody?: unknown;
      // multipart form fields (for /context/ingest with documents)
      formFields?: Record<string, string>;
      formFiles?: Array<{ name: string; filename: string; contentType: string; data: Buffer }>;
    },
  ): Promise<HydraDbEnvelope<T>> {
    const url = new URL(this.baseUrl + path);
    if (opts?.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v === undefined) continue;
        const values = Array.isArray(v) ? v : [v];
        for (const val of values) url.searchParams.append(k, val);
      }
    }

    let body: BodyInit | undefined;
    const headers: Record<string, string> = { ...this.headers(!opts?.formFields) };
    if (opts?.formFields || opts?.formFiles) {
      const form = new FormData();
      if (opts.formFields) {
        for (const [k, v] of Object.entries(opts.formFields)) form.append(k, v);
      }
      if (opts.formFiles) {
        for (const f of opts.formFiles) {
          form.append(f.name, new Blob([f.data], { type: f.contentType }), f.filename);
        }
      }
      body = form;
      // fetch sets multipart Content-Type with boundary automatically for FormData
      delete headers["Content-Type"];
    } else if (opts?.jsonBody !== undefined) {
      body = JSON.stringify(opts.jsonBody);
    }

    const maxAttempts = 3;
    let attempt = 0;
    let lastError: HydraDbError | null = null;

    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url.toString(), {
          method,
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);

        const text = await res.text();
        let parsed: HydraDbEnvelope<T>;
        try {
          parsed = text ? (JSON.parse(text) as HydraDbEnvelope<T>) : ({} as HydraDbEnvelope<T>);
        } catch {
          throw new HydraDbError(
            `HydraDB returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`,
            { status: res.status, retryable: false },
          );
        }

        if (res.ok && parsed.success !== false) {
          return parsed;
        }

        const code = parsed.error?.code;
        const retryable =
          RETRYABLE_STATUS.has(res.status) ||
          (code ? RETRYABLE_CODES.has(code) : false);
        lastError = new HydraDbError(
          parsed.error?.message ?? `HydraDB ${method} ${path} failed (status ${res.status})`,
          {
            status: res.status,
            code,
            requestId: parsed.meta?.request_id,
            retryable,
          },
        );

        if (!retryable || attempt >= maxAttempts) break;
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
        logger.warn(
          `HydraDB ${method} ${path} ${res.status} (attempt ${attempt}/${maxAttempts}); retrying in ${backoff}ms`,
        );
        await new Promise((r) => setTimeout(r, backoff));
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof HydraDbError) {
          lastError = err;
          if (!err.retryable || attempt >= maxAttempts) break;
          const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        // Network / abort errors are retryable
        lastError = new HydraDbError(
          err instanceof Error ? err.message : String(err),
          { retryable: true },
        );
        if (attempt >= maxAttempts) break;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    throw lastError ?? new HydraDbError("HydraDB request failed with no error captured");
  }

  // ── Databases ────────────────────────────────────────────────────────────

  /** POST /databases — provision an isolated database workspace. */
  async createDatabase(params: {
    database: string;
    database_metadata_schema?: Array<{
      name: string;
      data_type: string;
      enable_match?: boolean;
      enable_dense_embedding?: boolean;
      enable_sparse_embedding?: boolean;
      max_length?: number;
    }>;
  }): Promise<unknown> {
    const env = await this.request("POST", "/databases", {
      jsonBody: {
        database: params.database,
        ...(params.database_metadata_schema
          ? { database_metadata_schema: params.database_metadata_schema }
          : {}),
      },
    });
    return env.data;
  }

  /** GET /databases/status — poll until infra.ready_for_ingestion is true. */
  async getDatabaseStatus(database: string): Promise<{
    infra?: { ready_for_ingestion?: boolean; status?: string };
    [k: string]: unknown;
  }> {
    const env = await this.request("GET", "/databases/status", {
      query: { database },
    });
    return env.data as { infra?: { ready_for_ingestion?: boolean; status?: string } };
  }

  /** GET /databases — list all databases for the org. */
  async listDatabases(): Promise<unknown> {
    const env = await this.request("GET", "/databases");
    return env.data;
  }

  /** GET /databases/stats — usage stats for a database. */
  async getDatabaseStats(database: string): Promise<unknown> {
    const env = await this.request("GET", "/databases/stats", { query: { database } });
    return env.data;
  }

  /** GET /databases/collections — list active collections in a database. */
  async listCollections(database: string): Promise<unknown> {
    const env = await this.request("GET", "/databases/collections", {
      query: { database },
    });
    return env.data;
  }

  /** DELETE /databases — permanently remove a database. */
  async deleteDatabase(database: string): Promise<unknown> {
    const env = await this.request("DELETE", "/databases", { query: { database } });
    return env.data;
  }

  // ── Context: ingest / status / list / inspect / delete / relations ───────

  /**
   * POST /context/ingest — ingest documents, app sources, or memories.
   * Returns the ingest result envelope (caller reads .data.results for ids).
   *
   * For app-source knowledge, pass `appKnowledge` (will be JSON-stringified).
   * For memories, pass `memories` (will be JSON-stringified).
   * For file uploads, pass `documents` (binary) + optional `documentMetadata`.
   */
  async ingest(params: {
    type?: "knowledge" | "memory";
    database: string;
    collection?: string;
    upsert?: boolean;
    // app sources (Slack/Gmail/Jira/Linear/audit-ledger records)
    appKnowledge?: unknown[] | string;
    // memory items
    memories?: unknown[] | string;
    // file uploads
    documents?: Array<{ filename: string; contentType: string; data: Buffer }>;
    documentMetadata?: unknown[] | string;
    // schema-aligned filterable fields
    metadata?: Record<string, unknown>;
    // free-form metadata
    additionalMetadata?: Record<string, unknown>;
  }): Promise<{ results: Array<{ id: string; [k: string]: unknown }> }> {
    const formFields: Record<string, string> = {
      type: params.type ?? "knowledge",
      database: params.database,
    };
    if (params.collection) formFields.collection = params.collection;
    if (params.upsert !== undefined) formFields.upsert = String(params.upsert);
    if (params.appKnowledge) {
      formFields.app_knowledge =
        typeof params.appKnowledge === "string"
          ? params.appKnowledge
          : JSON.stringify(params.appKnowledge);
    }
    if (params.memories) {
      formFields.memories =
        typeof params.memories === "string" ? params.memories : JSON.stringify(params.memories);
    }
    if (params.metadata) formFields.metadata = JSON.stringify(params.metadata);
    if (params.additionalMetadata) {
      formFields.additional_metadata = JSON.stringify(params.additionalMetadata);
    }
    if (params.documentMetadata) {
      formFields.document_metadata =
        typeof params.documentMetadata === "string"
          ? params.documentMetadata
          : JSON.stringify(params.documentMetadata);
    }

    const env = await this.request("POST", "/context/ingest", {
      formFields,
      formFiles: params.documents?.map((d) => ({
        name: "documents",
        filename: d.filename,
        contentType: d.contentType,
        data: d.data,
      })),
    });
    return env.data as { results: Array<{ id: string; [k: string]: unknown }> };
  }

  /** GET /context/status — poll indexing status for ingested ids. */
  async getContextStatus(params: {
    database: string;
    ids: string[];
    collection?: string;
  }): Promise<{
    statuses: Array<{
      id: string;
      indexing_status: string;
      error_message?: string;
      message?: string;
    }>;
  }> {
    const env = await this.request("GET", "/context/status", {
      query: {
        database: params.database,
        collection: params.collection,
        ids: params.ids,
      },
    });
    return env.data as {
      statuses: Array<{
        id: string;
        indexing_status: string;
        error_message?: string;
        message?: string;
      }>;
    };
  }

  /** POST /context/list — browse knowledge or memories with filters. */
  async listContext(params: {
    database: string;
    type?: "knowledge" | "memory";
    collection?: string;
    page?: number;
    pageSize?: number;
    ids?: string[];
    filters?: Record<string, unknown>;
  }): Promise<unknown> {
    const env = await this.request("POST", "/context/list", {
      jsonBody: {
        database: params.database,
        type: params.type ?? "knowledge",
        ...(params.collection ? { collection: params.collection } : {}),
        page: params.page ?? 1,
        page_size: params.pageSize ?? 50,
        ...(params.ids ? { ids: params.ids } : {}),
        ...(params.filters ? { filters: params.filters } : {}),
      },
    });
    return env.data;
  }

  /** GET /context/inspect — fetch original content or presigned URL. */
  async inspectContext(params: {
    database: string;
    id: string;
    mode?: "content" | "url" | "both";
    expirySeconds?: number;
  }): Promise<unknown> {
    const env = await this.request("GET", "/context/inspect", {
      query: {
        database: params.database,
        id: params.id,
        mode: params.mode ?? "both",
        ...(params.expirySeconds ? { expiry_seconds: String(params.expirySeconds) } : {}),
      },
    });
    return env.data;
  }

  /** GET /context/relations — inspect graph relations for a source. */
  async getRelations(params: {
    database: string;
    id: string;
    type?: "knowledge" | "memory";
    limit?: number;
  }): Promise<unknown> {
    const env = await this.request("GET", "/context/relations", {
      query: {
        database: params.database,
        id: params.id,
        type: params.type ?? "knowledge",
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    });
    return env.data;
  }

  /** DELETE /context — delete sources or memories by id. */
  async deleteContext(params: {
    type?: "knowledge" | "memory";
    database: string;
    ids: string[];
    collection?: string;
  }): Promise<unknown> {
    const env = await this.request("DELETE", "/context", {
      jsonBody: {
        type: params.type ?? "knowledge",
        database: params.database,
        ids: params.ids,
        ...(params.collection ? { collection: params.collection } : {}),
      },
    });
    return env.data;
  }

  // ── Query ───────────────────────────────────────────────────────────────

  /**
   * POST /query — unified retrieval over knowledge, memories, or both.
   * Returns the full RetrievalResult (chunks, sources, graph_context, etc.).
   * The envelope's meta.latency_ms is preserved on the returned object.
   */
  async query(params: {
    database: string;
    collection?: string;
    query: string;
    type?: "knowledge" | "memory" | "all";
    queryBy?: "hybrid" | "text";
    operator?: "or" | "and" | "phrase";
    mode?: "fast" | "thinking";
    maxResults?: number;
    alpha?: number | "auto";
    recencyBias?: number;
    graphContext?: boolean;
    queryForcefulRelations?: boolean;
    additionalContext?: string;
    metadataFilters?: Record<string, unknown>;
    queryApps?: boolean;
  }): Promise<HydraDbQueryResult> {
    const env = await this.request<HydraDbQueryResult>("POST", "/query", {
      jsonBody: {
        database: params.database,
        query: params.query,
        type: params.type ?? "knowledge",
        query_by: params.queryBy ?? "hybrid",
        ...(params.collection ? { collection: params.collection } : {}),
        ...(params.operator ? { operator: params.operator } : {}),
        ...(params.mode ? { mode: params.mode } : {}),
        ...(params.maxResults ? { max_results: params.maxResults } : {}),
        ...(params.alpha !== undefined ? { alpha: params.alpha } : {}),
        ...(params.recencyBias !== undefined ? { recency_bias: params.recencyBias } : {}),
        ...(params.graphContext !== undefined ? { graph_context: params.graphContext } : {}),
        ...(params.queryForcefulRelations !== undefined
          ? { query_forceful_relations: params.queryForcefulRelations }
          : {}),
        ...(params.additionalContext ? { additional_context: params.additionalContext } : {}),
        ...(params.metadataFilters ? { metadata_filters: params.metadataFilters } : {}),
        ...(params.queryApps !== undefined ? { query_apps: params.queryApps } : {}),
      },
    });
    // Attach server-reported latency for the router's metrics.
    const result = env.data as HydraDbQueryResult;
    if (!result._meta) result._meta = {};
    result._meta.latency_ms = env.meta?.latency_ms;
    result._meta.request_id = env.meta?.request_id;
    return result;
  }
}

// ── Query result types (subset of the documented RetrievalResult) ──────────

export interface HydraDbChunk {
  chunk_uuid?: string;
  id?: string;
  chunk_content?: string;
  source_title?: string;
  source_type?: string;
  source_upload_time?: string;
  source_last_updated_time?: string;
  relevancy_score?: number;
  metadata?: Record<string, unknown>;
  additional_metadata?: Record<string, unknown>;
  extra_context_ids?: string[];
}

export interface HydraDbSource {
  id: string;
  title?: string;
  type?: string;
  url?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  additional_metadata?: Record<string, unknown>;
  app_kind?: string;
  app_provider?: string;
  app_external_id?: string;
}

export interface HydraDbGraphContext {
  query_paths?: unknown[];
  chunk_relations?: unknown[];
  chunk_id_to_group_ids?: Record<string, string[]>;
}

export interface HydraDbQueryResult {
  chunks?: HydraDbChunk[];
  sources?: HydraDbSource[];
  graph_context?: HydraDbGraphContext;
  additional_context?: Record<string, unknown>;
  /** Attached by HydraDbClient from the envelope meta — not part of the wire payload. */
  _meta?: { latency_ms?: number; request_id?: string };
}
