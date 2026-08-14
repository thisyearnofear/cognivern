/**
 * HydraDB service — v2 REST API client for the Cognivern OS memory layer.
 *
 * The OS Terminal `hydra` commands (status / memory / recent / recall /
 * prefs / qna / metrics) are backed by HydraDB memories. This module talks
 * to the same v2 API the backend uses (see
 * `src/backend/services/hydradb/HydraDbClient.ts`) so the product speaks one
 * API version end to end.
 *
 * Env (Next.js server runtime — set in Vercel):
 *   HYDRADB_API_KEY     required — API key from https://app.hydradb.com
 *   HYDRADB_DATABASE    optional, default `cognivern`
 *   HYDRADB_COLLECTION  optional, default `cognivern_os` (terminal memories)
 *   HYDRADB_BASE_URL    optional, default https://api.hydradb.com
 *   HYDRADB_API_VERSION optional, default 2
 *
 * When unconfigured every function fails open (returns an error result)
 * without touching the network, so the OS still works without HydraDB.
 */

export interface MemoryEntry {
  text: string;
  title?: string;
}

export interface RecallResultItem {
  text: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface HydraDBStatus {
  configured: boolean;
  tenantExists: boolean;
  tenantId: string | null;
  error?: string;
}

interface HydraDbEnvelope<T = unknown> {
  success: boolean;
  data: T;
  error: { code?: string; message?: string } | null;
  meta?: { request_id?: string; latency_ms?: number };
}

class HydraDbRequestError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "HydraDbRequestError";
    this.status = status;
  }
}

function getToken(): string | null {
  return process.env.HYDRADB_API_KEY || null;
}

function getDatabase(): string {
  return process.env.HYDRADB_DATABASE || "cognivern";
}

function getCollection(): string {
  return process.env.HYDRADB_COLLECTION || "cognivern_os";
}

function getBaseUrl(): string {
  return (process.env.HYDRADB_BASE_URL || "https://api.hydradb.com").replace(
    /\/$/,
    "",
  );
}

/**
 * Check if HydraDB is configured (has API key + database).
 */
export function isConfigured(): boolean {
  return !!getToken() && !!getDatabase();
}

/**
 * Core v2 request — mirrors the backend client's envelope contract.
 * Throws HydraDbRequestError on non-2xx or malformed responses.
 */
async function request<T = unknown>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  opts?: {
    query?: Record<string, string | string[] | undefined>;
    jsonBody?: unknown;
    formFields?: Record<string, string>;
  },
): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new HydraDbRequestError("HYDRADB_API_KEY not set", 401);
  }

  const url = new URL(getBaseUrl() + path);
  if (opts?.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value === undefined) continue;
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) url.searchParams.append(key, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "API-Version": process.env.HYDRADB_API_VERSION || "2",
  };
  let body: BodyInit | undefined;
  if (opts?.formFields) {
    const form = new FormData();
    for (const [key, value] of Object.entries(opts.formFields)) {
      form.append(key, value);
    }
    body = form;
  } else if (opts?.jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.jsonBody);
  }

  const res = await fetch(url.toString(), { method, headers, body });
  const text = await res.text();
  let parsed: HydraDbEnvelope<T> | null = null;
  try {
    parsed = text ? (JSON.parse(text) as HydraDbEnvelope<T>) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok || parsed?.success === false) {
    const message =
      parsed?.error?.message || `HydraDB ${method} ${path} failed (status ${res.status})`;
    throw new HydraDbRequestError(message, res.status);
  }
  return (parsed?.data ?? null) as T;
}

/**
 * Get the health / status of the HydraDB integration.
 * `tenantExists` mirrors the historical "is my tenant provisioned" check —
 * in v2 terms it means the database exists and is ready for ingestion.
 */
export async function getStatus(): Promise<HydraDBStatus> {
  const token = getToken();
  const database = getDatabase();

  if (!token || !database) {
    return {
      configured: false,
      tenantExists: false,
      tenantId: database,
      error: !token ? "HYDRADB_API_KEY not set" : "HYDRADB_DATABASE not set",
    };
  }

  try {
    const status = await request<{
      infra?: { ready_for_ingestion?: boolean; status?: string };
    }>("GET", "/databases/status", { query: { database } });
    const ready = status?.infra?.ready_for_ingestion === true;
    return {
      configured: true,
      tenantExists: ready,
      tenantId: database,
      error: ready ? undefined : "Database exists but is not ready for ingestion",
    };
  } catch (err) {
    const status = err instanceof HydraDbRequestError ? err.status : undefined;
    if (status === 404) {
      return {
        configured: true,
        tenantExists: false,
        tenantId: database,
        error: "Database not found",
      };
    }
    return {
      configured: true,
      tenantExists: false,
      tenantId: database,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Ensure the HydraDB database exists — create it if it doesn't.
 */
export async function ensureTenant(): Promise<{ ok: boolean; error?: string }> {
  const status = await getStatus();
  if (status.tenantExists) return { ok: true };
  if (!status.configured) return { ok: false, error: "HydraDB not configured" };

  try {
    await request("POST", "/databases", { jsonBody: { database: getDatabase() } });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A concurrent create or an already-existing database is fine.
    if (/already exists/i.test(message) || /409/.test(message)) return { ok: true };
    return { ok: false, error: message };
  }
}

/**
 * Store a memory entry in HydraDB (v2 memories ingest).
 * Memories represent things the OS should remember across sessions.
 */
export async function addMemory(
  text: string,
  title?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: false, error: "HydraDB not configured" };
  if (!text || typeof text !== "string") {
    return { ok: false, error: "text is required" };
  }

  // /context/list surfaces only title/description/note — not the searchable
  // body — so the title doubles as the display text for `hydra recent`.
  // The generic "CLI memory" label is replaced with the memory's own text
  // (truncated) so recent lists read as real content.
  const displayTitle =
    title && title !== "CLI memory"
      ? title
      : text.length > 80
        ? `${text.slice(0, 80)}…`
        : text;
  const memory = {
    id: crypto.randomUUID(),
    title: displayTitle,
    text,
    infer: true,
    user_name: "cognivern-os",
  };

  try {
    await request("POST", "/context/ingest", {
      formFields: {
        type: "memory",
        database: getDatabase(),
        collection: getCollection(),
        memories: JSON.stringify([memory]),
      },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Map a v2 query chunk to the shape the OS Terminal renders. */
function chunkToItem(chunk: {
  chunk_content?: string;
  content?: string;
  text?: string;
  relevancy_score?: number;
  score?: number;
  additional_metadata?: Record<string, unknown>;
}): RecallResultItem {
  return {
    text: chunk.chunk_content || chunk.content || chunk.text || "",
    score: chunk.relevancy_score ?? chunk.score,
    metadata: chunk.additional_metadata,
  };
}

/**
 * Full recall — search stored memories for relevant context.
 */
export async function fullRecall(
  query: string,
): Promise<{ ok: boolean; results?: RecallResultItem[]; error?: string }> {
  if (!isConfigured()) return { ok: false, error: "HydraDB not configured" };
  if (!query || typeof query !== "string") {
    return { ok: false, error: "query is required" };
  }

  try {
    const result = await request<{
      chunks?: Array<Record<string, unknown>>;
    }>("POST", "/query", {
      jsonBody: {
        database: getDatabase(),
        collection: getCollection(),
        query,
        type: "memory",
        query_by: "hybrid",
        max_results: 10,
      },
    });
    return { ok: true, results: (result.chunks || []).map(chunkToItem) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Preference recall — memories carry `additional_metadata.kind` when the
 * terminal stores a preference; a plain recall over the memory collection is
 * equivalent for the demo pool.
 */
export async function recallPreferences(
  query: string,
): Promise<{ ok: boolean; results?: RecallResultItem[]; error?: string }> {
  return fullRecall(query);
}

/**
 * Q&A — ask a question against stored memory. HydraDB v2 returns retrieved
 * chunks (no generative answer), so the top match is returned as the answer.
 */
export async function qna(
  question: string,
): Promise<{ ok: boolean; answer?: string; error?: string }> {
  if (!isConfigured()) return { ok: false, error: "HydraDB not configured" };
  if (!question || typeof question !== "string") {
    return { ok: false, error: "question is required" };
  }

  try {
    const result = await request<{
      chunks?: Array<Record<string, unknown>>;
    }>("POST", "/query", {
      jsonBody: {
        database: getDatabase(),
        collection: getCollection(),
        query: question,
        type: "memory",
        mode: "thinking",
        graph_context: true,
        max_results: 3,
      },
    });
    const chunks = result.chunks || [];
    const top = chunks[0]
      ? chunkToItem(chunks[0]).text || "No text in top match."
      : "No memories found matching your question.";
    // The terminal parses this JSON and falls back to raw text on failure.
    return { ok: true, answer: JSON.stringify({ answer: top }) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Get storage metrics for the database.
 */
export async function getMetrics(): Promise<{
  ok: boolean;
  metrics?: Record<string, unknown>;
  error?: string;
}> {
  if (!isConfigured()) return { ok: false, error: "HydraDB not configured" };
  try {
    const metrics = await request<Record<string, unknown>>("GET", "/databases/stats", {
      query: { database: getDatabase() },
    });
    return { ok: true, metrics };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Get recent memories — lists the newest entries in the memory collection.
 */
export async function getRecentMemories(
  limit: number = 5,
): Promise<{ ok: boolean; results?: RecallResultItem[]; error?: string }> {
  if (!isConfigured()) return { ok: false, error: "HydraDB not configured" };

  try {
    const result = await request<{
      user_memories?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
      memories?: Array<Record<string, unknown>>;
      sources?: Array<Record<string, unknown>>;
    }>("POST", "/context/list", {
      jsonBody: {
        database: getDatabase(),
        collection: getCollection(),
        type: "memory",
        page: 1,
        page_size: limit,
      },
    });
    // v2 returns memories under user_memories with title/description/note
    // (not the searchable body); be defensive across envelope variants.
    const items =
      result.user_memories || result.items || result.memories || result.sources || [];
    return {
      ok: true,
      results: items.map((item) => ({
        text:
          (item.title as string) ||
          (item.description as string) ||
          (item.note as string) ||
          "",
        score: (item.score as number) ?? (item.relevancy_score as number),
        metadata: (item.additional_metadata as Record<string, unknown>) || undefined,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
