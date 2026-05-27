import { HydraDBClient } from "@hydradb/sdk";

export interface MemoryEntry {
  text: string;
  title?: string;
}

export interface RecallResult {
  results: Array<{
    text: string;
    score?: number;
    metadata?: Record<string, unknown>;
  }>;
}

export interface HydraDBStatus {
  configured: boolean;
  tenantExists: boolean;
  tenantId: string | null;
  error?: string;
}

function getClient() {
  const token = process.env.HYDRA_DB_API_KEY;
  if (!token) {
    return null;
  }
  return new HydraDBClient({ token });
}

function getTenantId(): string | null {
  return process.env.HYDRA_TENANT_ID || null;
}

/**
 * Check if HydraDB is configured (has API key and tenant ID).
 */
export function isConfigured(): boolean {
  return !!process.env.HYDRA_DB_API_KEY && !!process.env.HYDRA_TENANT_ID;
}

/**
 * Get the health / status of the HydraDB integration.
 * Returns whether it's configured and the tenant status.
 */
export async function getStatus(): Promise<HydraDBStatus> {
  const tenantId = getTenantId();
  const token = process.env.HYDRA_DB_API_KEY;

  if (!token || !tenantId) {
    return {
      configured: false,
      tenantExists: false,
      tenantId,
      error: !token ? "HYDRA_DB_API_KEY not set" : "HYDRA_TENANT_ID not set",
    };
  }

  const client = getClient();
  if (!client) {
    return {
      configured: false,
      tenantExists: false,
      tenantId,
      error: "Failed to create client",
    };
  }

  try {
    // Check if tenant exists by trying to get its infra status
    await client.tenant.getInfraStatus({ tenant_id: tenantId });
    return {
      configured: true,
      tenantExists: true,
      tenantId,
    };
  } catch (err: unknown) {
    // If tenant doesn't exist, offer to create it
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("not found")) {
      return {
        configured: true,
        tenantExists: false,
        tenantId,
        error: "Tenant not found",
      };
    }
    return { configured: true, tenantExists: false, tenantId, error: msg };
  }
}

/**
 * Ensure the HydraDB tenant exists — create it if it doesn't.
 */
export async function ensureTenant(): Promise<{ ok: boolean; error?: string }> {
  const status = await getStatus();
  if (status.tenantExists) return { ok: true };

  const client = getClient();
  if (!client) return { ok: false, error: "HydraDB not configured" };

  const tenantId = getTenantId();
  if (!tenantId) return { ok: false, error: "HYDRA_TENANT_ID not set" };

  try {
    await client.tenant.create({ tenant_id: tenantId });
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Store a memory entry in HydraDB.
 * Memories represent things the OS should remember across sessions.
 */
export async function addMemory(
  text: string,
  title?: string,
): Promise<{ ok: boolean; error?: string }> {
  const tenantId = getTenantId();
  if (!tenantId) return { ok: false, error: "HYDRA_TENANT_ID not set" };

  const client = getClient();
  if (!client) return { ok: false, error: "HydraDB not configured" };

  const memory: MemoryEntry = { text, title: title || undefined };

  try {
    await client.upload.addMemory({
      tenant_id: tenantId,
      memories: [memory],
    });
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Full recall — search stored memories for relevant context.
 */
export async function fullRecall(
  query: string,
): Promise<{ ok: boolean; results?: RecallResult; error?: string }> {
  const tenantId = getTenantId();
  if (!tenantId) return { ok: false, error: "HYDRA_TENANT_ID not set" };

  const client = getClient();
  if (!client) return { ok: false, error: "HydraDB not configured" };

  try {
    const response = await client.recall.fullRecall({
      tenant_id: tenantId,
      query,
    });
    return { ok: true, results: response as unknown as RecallResult };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Preference recall — search for user/agent preferences.
 */
export async function recallPreferences(
  query: string,
): Promise<{ ok: boolean; results?: RecallResult; error?: string }> {
  const tenantId = getTenantId();
  if (!tenantId) return { ok: false, error: "HYDRA_TENANT_ID not set" };

  const client = getClient();
  if (!client) return { ok: false, error: "HydraDB not configured" };

  try {
    const response = await client.recall.recallPreferences({
      tenant_id: tenantId,
      query,
    });
    return { ok: true, results: response as unknown as RecallResult };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Q&A — ask a question against stored knowledge.
 */
export async function qna(
  question: string,
): Promise<{ ok: boolean; answer?: string; error?: string }> {
  const tenantId = getTenantId();
  if (!tenantId) return { ok: false, error: "HYDRA_TENANT_ID not set" };

  const client = getClient();
  if (!client) return { ok: false, error: "HydraDB not configured" };

  try {
    const response = await client.recall.qna({
      tenant_id: tenantId,
      question,
    });
    return { ok: true, answer: JSON.stringify(response) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Get storage metrics for the tenant.
 */
export async function getMetrics(): Promise<{
  ok: boolean;
  metrics?: Record<string, unknown>;
  error?: string;
}> {
  const client = getClient();
  if (!client) return { ok: false, error: "HydraDB not configured" };

  try {
    const metrics = await client.metricsMetricsGet();
    return { ok: true, metrics: metrics as unknown as Record<string, unknown> };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Get recent memories — uses a broad recall query to surface the most relevant entries.
 * Returns the top N memories.
 */
export async function getRecentMemories(
  limit: number = 5,
): Promise<{
  ok: boolean;
  results?: Array<{ text: string; score?: number }>;
  error?: string;
}> {
  const tenantId = getTenantId();
  if (!tenantId) return { ok: false, error: "HYDRA_TENANT_ID not set" };

  const client = getClient();
  if (!client) return { ok: false, error: "HydraDB not configured" };

  try {
    // Use a broad recall to surface recent memories
    const response = await client.recall.fullRecall({
      tenant_id: tenantId,
      query: "",
      // @ts-expect-error top_k is accepted at runtime by the API
      top_k: limit,
    });
    const results = (response as unknown as RecallResult).results || [];
    return { ok: true, results };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
